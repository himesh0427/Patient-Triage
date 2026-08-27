from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import random

from ..database import get_db
from ..models import Patient, Visit, Vitals, SymptomCC, Queue
from ..schemas import TriageInput, TriageResponse
from ..ml.model_loader import predict_esi, text_to_cc_vector
from ..services.queue_manager import check_and_update_retriage

router = APIRouter(prefix="/triage", tags=["Triage"])

# Gender encoding map (matches training pipeline)
GENDER_MAP = {"Male": 1, "Female": 0}

@router.post("/predict", response_model=TriageResponse)
def predict_patient(input: TriageInput, db: Session = Depends(get_db)):
    # 1. Create Patient
    patient = Patient(
        name=input.name,
        age=input.age,
        gender=input.gender,
        has_history=input.has_history
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    
    # 2. Create Visit
    visit = Visit(patient_id=patient.id)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    
    # 3. Save Vitals
    vitals_data = input.vitals.model_dump()
    vitals = Vitals(visit_id=visit.id, **vitals_data)
    db.add(vitals)
    
    # 4. Map Free Text to CC vector
    cc_vector = text_to_cc_vector(input.symptom_text)
    symptom_cc = SymptomCC(
        visit_id=visit.id, 
        raw_text=input.symptom_text,
        features_json=str(cc_vector)
    )
    db.add(symptom_cc)
    
    # 5. Encode gender for the ML model
    gender_encoded = GENDER_MAP.get(input.gender, 2)
    
    # 6. Get ML Prediction
    esi, confidence, raw_score, reasons = predict_esi(
        vitals=vitals_data,
        age=input.age,
        gender=gender_encoded,
        cc_vector=cc_vector,
        raw_text=input.symptom_text
    )
    
    # 7. Save to Queue
    queue = Queue(visit_id=visit.id, esi_level=esi)
    db.add(queue)
    
    # 8. Update Visit
    visit.esi_predicted = esi
    visit.esi_final = esi
    visit.confidence_score = confidence
    visit.raw_ml_score = raw_score
    visit.top_reasons = str(reasons)
    
    db.commit()
    db.refresh(visit)
    
    # Determine action based on ESI level
    if esi == 1:
        action = "Immediate Resuscitation"
    elif esi == 2:
        action = "Immediate Bed"
    elif esi == 3:
        action = "Urgent - Monitor Queue"
    elif esi == 4:
        action = "Semi-Urgent - Standard Queue"
    else:
        action = "Non-Urgent - Standard Queue"
    
    return TriageResponse(
        visit_id=visit.id,
        esi=esi,
        confidence=confidence,
        raw_score=round(raw_score, 3),
        reasons=reasons,
        action=action
    )

@router.get("/queue")
def get_queue(db: Session = Depends(get_db)):
    # 1. RUN THE RETRIAGE CHECK (The Clock)
    check_and_update_retriage(db)
    
    # 2. FETCH THE SORTED QUEUE
    queue_items = db.query(Queue, Visit).join(Visit).filter(Visit.is_active == True).order_by(
        Queue.esi_level.asc(), Visit.arrival_time.asc()
    ).all()
    
    # 3. FORMAT RESPONSE
    result = []
    for q, v in queue_items:
        wait_time = (datetime.now() - v.arrival_time).total_seconds()
        result.append({
            "queue_id": q.id,
            "visit_id": v.id,
            "patient_id": v.patient_id,
            "esi_level": q.esi_level,
            "wait_time_seconds": int(wait_time),
            "retriage_needed": q.retriage_needed,
            "confidence": v.confidence_score,
            "raw_ml_score": v.raw_ml_score,
            "is_overridden": v.is_overridden
        })
    return result

@router.get("/visit/{visit_id}")
def get_visit(visit_id: int, db: Session = Depends(get_db)):
    """Get full details for a specific visit."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        from fastapi import HTTPException
        raise HTTPException(404, "Visit not found")
    
    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    vitals = db.query(Vitals).filter(Vitals.visit_id == visit_id).first()
    symptom = db.query(SymptomCC).filter(SymptomCC.visit_id == visit_id).first()
    queue = db.query(Queue).filter(Queue.visit_id == visit_id).first()
    
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
        "esi_predicted": visit.esi_predicted,
        "esi_final": visit.esi_final,
        "confidence": visit.confidence_score,
        "raw_ml_score": visit.raw_ml_score,
        "reasons": visit.top_reasons,
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
    }

@router.post("/discharge/{visit_id}")
def discharge_patient(visit_id: int, db: Session = Depends(get_db)):
    """Remove a patient from the active queue."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        from fastapi import HTTPException
        raise HTTPException(404, "Visit not found")
    
    visit.is_active = False
    db.commit()
    return {"message": f"Visit {visit_id} discharged from queue"}

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
