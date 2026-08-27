from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import random
import json

from ..database import get_db
from ..models import Patient, Visit, Vitals, SymptomCC, Queue, AuditLog
from ..schemas import (
    TriageInput, TriageResponse, BypassInput,
    VitalsCheckInput, VitalsCheckResponse, SymptomsInput
)
from ..ml.model_loader import predict_esi, text_to_cc_vector
from ..ml.hard_rules import apply_hard_rules
from ..services.queue_manager import check_and_update_retriage
from ..config import settings, RURAL_TIER_MAP, RURAL_TIER_LABELS

router = APIRouter(prefix="/triage", tags=["Triage"])

# Gender encoding map (matches training pipeline)
GENDER_MAP = {"Male": 1, "Female": 0}

# =========================================================
# HELPER: Resolve or create a patient
# =========================================================
def _resolve_patient(patient_id, name, age, gender, has_history, db):
    """If patient_id is given, fetch existing. Otherwise create new."""
    if patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(404, f"Patient with ID {patient_id} not found")
        return patient
    else:
        if not name or age is None:
            raise HTTPException(400, "Name and age are required for new patients")
        patient = Patient(name=name, age=age, gender=gender, has_history=has_history)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient

def _build_action(esi):
    if esi == 1: return "Immediate Resuscitation"
    elif esi == 2: return "Immediate Bed"
    elif esi == 3: return "Urgent - Monitor Queue"
    elif esi == 4: return "Semi-Urgent - Standard Queue"
    else: return "Non-Urgent - Standard Queue"

def _build_alert(confidence, esi, source):
    if source == "bypass":
        return "CRITICAL_BYPASS"
    if confidence < settings.CONFIDENCE_THRESHOLD:
        return "LOW_CONFIDENCE"
    return "NONE"


# =========================================================
# 1. BYPASS: Immediate life-threat (unconscious, cardiac arrest)
#    Skips vitals and symptoms entirely. Assigns ESI-1.
# =========================================================
@router.post("/bypass", response_model=TriageResponse)
def bypass_critical(input: BypassInput, db: Session = Depends(get_db)):
    """Immediate ESI-1 assignment for unconscious/cardiac arrest patients.
    No vitals or symptoms needed."""
    
    patient = _resolve_patient(
        input.patient_id, input.name, input.age, input.gender, False, db
    )
    
    visit = Visit(patient_id=patient.id)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    
    reasons = [
        "BYPASS: Immediate life-threatening presentation",
        f"Condition reported: {input.condition or 'Critical'}"
    ]
    
    visit.esi_predicted = 1
    visit.esi_final = 1
    visit.confidence_score = 1.0
    visit.raw_ml_score = 1.0
    visit.top_reasons = json.dumps(reasons)
    
    queue = Queue(visit_id=visit.id, esi_level=1)
    db.add(queue)
    
    log = AuditLog(
        visit_id=visit.id,
        action="BYPASS_CRITICAL",
        old_value="N/A",
        new_value="1",
        user_id="SYSTEM",
        reason=f"Immediate bypass: {input.condition}"
    )
    db.add(log)
    db.commit()
    
    return TriageResponse(
        visit_id=visit.id,
        patient_id=patient.id,
        esi=1,
        confidence=1.0,
        raw_score=1.0,
        reasons=reasons,
        action="Immediate Resuscitation",
        alert="CRITICAL_BYPASS",
        source="bypass"
    )


# =========================================================
# 2. STEP 1: Submit vitals -> check hard rules (early termination)
#    If vitals trigger ESI 1/2, we stop here. Otherwise proceed to symptoms.
# =========================================================
@router.post("/vitals-check", response_model=VitalsCheckResponse)
def vitals_check(input: VitalsCheckInput, db: Session = Depends(get_db)):
    """Step 1 of wizard: Submit vitals, check hard rules.
    If ESI 1/2 triggered, visit is created and queued immediately.
    If not triggered, visit is created but nurse must proceed to symptoms."""
    
    patient = _resolve_patient(
        input.patient_id, input.name, input.age, input.gender, input.has_history, db
    )
    
    visit = Visit(patient_id=patient.id)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    
    # Save vitals
    vitals_data = input.vitals.model_dump()
    vitals = Vitals(visit_id=visit.id, **vitals_data)
    db.add(vitals)
    db.commit()
    
    # Run hard rules on vitals alone (no symptom text yet)
    hard_result = apply_hard_rules(
        age=float(patient.age),
        vitals=vitals_data,
        symptom_text=""  # No symptoms submitted yet
    )
    
    if hard_result["esi"] is not None:
        # EARLY TERMINATION: Vitals alone triggered ESI 1 or 2
        esi = hard_result["esi"]
        reasons = hard_result["reasons"]
        
        visit.esi_predicted = esi
        visit.esi_final = esi
        visit.confidence_score = 1.0
        visit.raw_ml_score = float(esi)
        visit.top_reasons = json.dumps(reasons)
        
        queue = Queue(visit_id=visit.id, esi_level=esi)
        db.add(queue)
        db.commit()
        
        return VitalsCheckResponse(
            visit_id=visit.id,
            patient_id=patient.id,
            hard_rule_triggered=True,
            esi=esi,
            confidence=1.0,
            reasons=reasons,
            action=_build_action(esi),
            message=f"ESI-{esi} assigned by vital signs. Patient queued immediately."
        )
    else:
        # No hard rule triggered -> nurse must proceed to symptoms page
        db.commit()
        return VitalsCheckResponse(
            visit_id=visit.id,
            patient_id=patient.id,
            hard_rule_triggered=False,
            esi=None,
            confidence=None,
            reasons=["Vitals within safe range"],
            action="",
            message="Proceed to symptoms entry."
        )


# =========================================================
# 3. STEP 2: Submit symptoms for an existing visit -> run ML model
# =========================================================
@router.post("/symptoms/{visit_id}", response_model=TriageResponse)
def submit_symptoms(visit_id: int, input: SymptomsInput, db: Session = Depends(get_db)):
    """Step 2 of wizard: Submit symptoms for a visit created in vitals-check.
    Runs the full ML pipeline and assigns ESI."""
    
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")
    if visit.esi_predicted is not None:
        raise HTTPException(400, "This visit already has an ESI prediction. Use override to change it.")
    
    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    vitals_record = db.query(Vitals).filter(Vitals.visit_id == visit_id).first()
    
    # Save symptom CC
    cc_vector = text_to_cc_vector(input.symptom_text)
    symptom_cc = SymptomCC(
        visit_id=visit.id,
        raw_text=input.symptom_text,
        features_json=json.dumps(cc_vector)
    )
    db.add(symptom_cc)
    
    # Build vitals dict from stored record
    vitals_data = {
        "hr": vitals_record.hr if vitals_record else None,
        "sbp": vitals_record.sbp if vitals_record else None,
        "dbp": vitals_record.dbp if vitals_record else None,
        "rr": vitals_record.rr if vitals_record else None,
        "spo2": vitals_record.spo2 if vitals_record else None,
        "temp": vitals_record.temp if vitals_record else None,
    }
    
    gender_encoded = GENDER_MAP.get(patient.gender, 2)
    
    esi, confidence, raw_score, reasons = predict_esi(
        vitals=vitals_data,
        age=patient.age,
        gender=gender_encoded,
        cc_vector=cc_vector,
        raw_text=input.symptom_text
    )
    
    # Save results
    visit.esi_predicted = esi
    visit.esi_final = esi
    visit.confidence_score = confidence
    visit.raw_ml_score = raw_score
    visit.top_reasons = json.dumps(reasons)
    
    queue = Queue(visit_id=visit.id, esi_level=esi)
    db.add(queue)
    db.commit()
    
    source = "hard_gate" if confidence == 1.0 and esi <= 2 else "ml"
    
    return TriageResponse(
        visit_id=visit.id,
        patient_id=patient.id,
        esi=esi,
        confidence=confidence,
        raw_score=round(raw_score, 3),
        reasons=reasons,
        action=_build_action(esi),
        alert=_build_alert(confidence, esi, source),
        source=source
    )


# =========================================================
# 4. ONE-SHOT PREDICT (legacy: all data in one request)
# =========================================================
@router.post("/predict", response_model=TriageResponse)
def predict_patient(input: TriageInput, db: Session = Depends(get_db)):
    """Full triage in one shot (vitals + symptoms together)."""
    
    patient = _resolve_patient(
        input.patient_id, input.name, input.age, input.gender, input.has_history, db
    )
    
    visit = Visit(patient_id=patient.id)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    
    vitals_data = input.vitals.model_dump()
    vitals = Vitals(visit_id=visit.id, **vitals_data)
    db.add(vitals)
    
    cc_vector = text_to_cc_vector(input.symptom_text)
    symptom_cc = SymptomCC(
        visit_id=visit.id,
        raw_text=input.symptom_text,
        features_json=json.dumps(cc_vector)
    )
    db.add(symptom_cc)
    
    gender_encoded = GENDER_MAP.get(input.gender, 2)
    
    esi, confidence, raw_score, reasons = predict_esi(
        vitals=vitals_data,
        age=patient.age,
        gender=gender_encoded,
        cc_vector=cc_vector,
        raw_text=input.symptom_text
    )
    
    visit.esi_predicted = esi
    visit.esi_final = esi
    visit.confidence_score = confidence
    visit.raw_ml_score = raw_score
    visit.top_reasons = json.dumps(reasons)
    
    queue = Queue(visit_id=visit.id, esi_level=esi)
    db.add(queue)
    db.commit()
    db.refresh(visit)
    
    source = "hard_gate" if confidence == 1.0 and esi <= 2 else "ml"
    
    return TriageResponse(
        visit_id=visit.id,
        patient_id=patient.id,
        esi=esi,
        confidence=confidence,
        raw_score=round(raw_score, 3),
        reasons=reasons,
        action=_build_action(esi),
        alert=_build_alert(confidence, esi, source),
        source=source
    )


# =========================================================
# 5. QUEUE (with Rural 3-tier support)
# =========================================================
@router.get("/queue")
def get_queue(db: Session = Depends(get_db)):
    """Get the live patient queue. Adapts to URBAN (5-level) or RURAL (3-tier) mode."""
    check_and_update_retriage(db)
    
    queue_items = db.query(Queue, Visit, Patient).join(
        Visit, Queue.visit_id == Visit.id
    ).join(
        Patient, Visit.patient_id == Patient.id
    ).filter(
        Visit.is_active == True
    ).order_by(
        Queue.esi_level.asc(), Visit.arrival_time.asc()
    ).all()
    
    result = []
    for q, v, p in queue_items:
        wait_time = (datetime.now() - v.arrival_time).total_seconds()
        
        entry = {
            "queue_id": q.id,
            "visit_id": v.id,
            "patient_id": p.id,
            "patient_name": p.name,
            "patient_age": p.age,
            "esi_level": q.esi_level,
            "wait_time_seconds": int(wait_time),
            "retriage_needed": q.retriage_needed,
            "confidence": v.confidence_score,
            "raw_ml_score": v.raw_ml_score,
            "is_overridden": v.is_overridden,
            "alert": _build_alert(
                v.confidence_score or 1.0,
                q.esi_level,
                "ml"
            ),
        }
        
        # Add rural tier if in RURAL mode
        if settings.HOSPITAL_TYPE == "RURAL":
            tier = RURAL_TIER_MAP.get(q.esi_level, 2)
            entry["rural_tier"] = tier
            entry["rural_tier_label"] = RURAL_TIER_LABELS.get(tier, "Unknown")
        
        result.append(entry)
    
    return {
        "hospital_type": settings.HOSPITAL_TYPE,
        "surge_mode": settings.SURGE_MODE,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "queue": result
    }


# =========================================================
# 6. VISIT DETAIL
# =========================================================
@router.get("/visit/{visit_id}")
def get_visit(visit_id: int, db: Session = Depends(get_db)):
    """Get full details for a specific visit."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")
    
    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    vitals = db.query(Vitals).filter(Vitals.visit_id == visit_id).first()
    symptom = db.query(SymptomCC).filter(SymptomCC.visit_id == visit_id).first()
    queue = db.query(Queue).filter(Queue.visit_id == visit_id).first()
    audit_logs = db.query(AuditLog).filter(
        AuditLog.visit_id == visit_id
    ).order_by(AuditLog.timestamp.desc()).all()
    
    # Parse reasons from JSON
    try:
        reasons = json.loads(visit.top_reasons) if visit.top_reasons else []
    except (json.JSONDecodeError, TypeError):
        reasons = [visit.top_reasons] if visit.top_reasons else []
    
    return {
        "visit_id": visit.id,
        "patient": {
            "id": patient.id if patient else None,
            "name": patient.name if patient else None,
            "age": patient.age if patient else None,
            "gender": patient.gender if patient else None,
            "has_history": patient.has_history if patient else None,
        },
        "arrival_time": str(visit.arrival_time),
        "is_active": visit.is_active,
        "esi_predicted": visit.esi_predicted,
        "esi_final": visit.esi_final,
        "confidence": visit.confidence_score,
        "raw_ml_score": visit.raw_ml_score,
        "reasons": reasons,
        "is_overridden": visit.is_overridden,
        "override_reason": visit.override_reason,
        "overridden_by": visit.overridden_by,
        "vitals": {
            "hr": vitals.hr if vitals else None,
            "sbp": vitals.sbp if vitals else None,
            "dbp": vitals.dbp if vitals else None,
            "rr": vitals.rr if vitals else None,
            "temp": vitals.temp if vitals else None,
            "spo2": vitals.spo2 if vitals else None,
        },
        "symptom_text": symptom.raw_text if symptom else None,
        "queue_position": queue.esi_level if queue else None,
        "retriage_needed": queue.retriage_needed if queue else False,
        "alert": _build_alert(
            visit.confidence_score or 1.0,
            visit.esi_final or 3,
            "ml"
        ),
        "audit_trail": [
            {
                "action": log.action,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "user_id": log.user_id,
                "reason": log.reason,
                "timestamp": str(log.timestamp)
            }
            for log in audit_logs
        ]
    }


# =========================================================
# 7. DISCHARGE
# =========================================================
@router.post("/discharge/{visit_id}")
def discharge_patient(visit_id: int, db: Session = Depends(get_db)):
    """Remove a patient from the active queue."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")
    
    visit.is_active = False
    
    log = AuditLog(
        visit_id=visit_id,
        action="DISCHARGE",
        old_value=str(visit.esi_final),
        new_value="DISCHARGED",
        user_id="SYSTEM",
        reason="Patient discharged from queue"
    )
    db.add(log)
    db.commit()
    return {"message": f"Visit {visit_id} discharged from queue"}


# =========================================================
# 8. SURGE SIMULATION
# =========================================================
@router.post("/surge/simulate")
def simulate_surge(scale: int = 3, db: Session = Depends(get_db)):
    """Generates fake patients to test the 3x surge workflow."""
    count = 0
    first_names = ["John", "Jane", "Alex", "Maria", "Sam", "Lisa", "Tom", "Sarah", "Mike", "Emma"]
    
    for _ in range(scale * 30):
        age = random.choice([2, 8, 25, 35, 55, 75, 82])
        gender = random.choice(["Male", "Female"])
        vitals_data = {
            "hr": random.randint(60, 180),
            "sbp": random.randint(80, 160),
            "dbp": random.randint(50, 100),
            "rr": random.randint(12, 35),
            "spo2": random.randint(88, 100),
            "temp": round(36.5 + random.random() * 3, 1)
        }
        texts = [
            "chest pain", "abdominal pain", "shortness of breath",
            "fever", "headache", "back pain", "nausea vomiting",
            "dizziness", "cough", "fall", "laceration", "rash"
        ]
        
        fake_input = TriageInput(
            name=random.choice(first_names),
            age=age,
            gender=gender,
            has_history=random.choice([True, False]),
            symptom_text=random.choice(texts),
            vitals=vitals_data
        )
        predict_patient(fake_input, db)
        count += 1
    
    return {"message": f"Simulated {count} patients in surge mode"}
