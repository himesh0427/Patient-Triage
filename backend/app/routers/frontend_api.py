"""
Frontend-compatible API router.

Serves the endpoints that the React frontend (api.js / store.jsx) expects.
Uses the v2 database models and bridges to the existing ML pipeline via
the triage_service.

Endpoints:
  POST   /patients                  Create patient encounter
  GET    /patients/{id}             Get full patient details
  POST   /patients/{id}/accept      Clinician accepts AI recommendation
  POST   /patients/{id}/override    Clinician overrides ESI
  POST   /patients/{id}/reassess    Re-run triage with new vitals
  POST   /patients/{id}/discharge   Remove from queue
  GET    /queue                     All queued patients
  GET    /audit-log                 Audit trail
  POST   /dev/reset                 Clear all frontend data
  POST   /mode                      Set surge/normal mode
"""

import json
import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models_v2 import Encounter, EncounterEvent, FrontendAudit
from ..schemas_v2 import (
    PatientIntake, AcceptRequest, OverrideRequest, ReassessRequest, ModeRequest,
    TriageAssessRequest, TriageAssessResponse,
    PatientResponse, TriageResult, TriageFactor, ClinicianDecisionResponse,
    EventResponse, AuditEntryResponse,
)
from ..services.triage_service import compute_full_triage, age_group_of, MODEL_VERSION
from ..config import settings

router = APIRouter(tags=["Frontend API"])

# MRN counter
_mrn_counter = 0


def _next_mrn() -> str:
    global _mrn_counter
    _mrn_counter += 1
    import random
    return f"MRN-{random.randint(100000, 999999)}"


def _encounter_to_response(enc: Encounter, db: Session) -> dict:
    """Convert an Encounter DB row + its events into a PatientResponse dict."""

    # Fetch events
    events = db.query(EncounterEvent).filter(
        EncounterEvent.encounter_id == enc.id
    ).order_by(EncounterEvent.at.desc()).all()

    # Build vitals dict
    vitals = {
        "hr": enc.vital_hr,
        "sbp": enc.vital_sbp,
        "dbp": enc.vital_dbp,
        "rr": enc.vital_rr,
        "temp": enc.vital_temp,
        "spo2": enc.vital_spo2,
        "gcs": enc.vital_gcs,
    }

    # Build triage dict
    try:
        factors = json.loads(enc.triage_factors_json or "[]")
    except (json.JSONDecodeError, TypeError):
        factors = []

    triage = {
        "severity": enc.triage_severity,
        "confidence": enc.triage_confidence or "Medium",
        "confidence_score": enc.triage_confidence_score or 50,
        "completeness": enc.triage_completeness or 50,
        "factors": factors,
        "gate": enc.triage_gate,
        "escalated": enc.triage_escalated or False,
        "points": enc.triage_points or 0,
        "model_version": enc.triage_model_version or MODEL_VERSION,
        "computed_at": enc.triage_computed_at.isoformat() + "Z" if enc.triage_computed_at else datetime.utcnow().isoformat() + "Z",
    }

    # Build clinician decision
    clinician_decision = None
    if enc.decision_kind:
        clinician_decision = {
            "kind": enc.decision_kind,
            "level": enc.decision_level,
            "reason": enc.decision_reason,
            "clinician": enc.decision_clinician or "RN (on shift)",
            "decided_at": enc.decision_at.isoformat() + "Z" if enc.decision_at else datetime.utcnow().isoformat() + "Z",
        }

    # Build history
    try:
        comorbidities = json.loads(enc.comorbidities_json or "[]")
    except (json.JSONDecodeError, TypeError):
        comorbidities = []

    history = {
        "has_record": enc.has_history or False,
        "comorbidities": comorbidities,
    }

    # Build observed symptoms
    try:
        observed = json.loads(enc.observed_symptoms_json or "[]")
    except (json.JSONDecodeError, TypeError):
        observed = []

    # Build events list
    events_list = []
    for ev in events:
        events_list.append({
            "at": ev.at.isoformat() + "Z" if ev.at else datetime.utcnow().isoformat() + "Z",
            "type": ev.type,
            "detail": ev.detail,
        })

    return {
        "id": enc.id,
        "mrn": enc.mrn or "",
        "name": enc.name,
        "age": enc.age,
        "sex": enc.sex,
        "age_group": enc.age_group or age_group_of(enc.age),
        "complaint": enc.complaint,
        "complaint_tag": enc.complaint_tag,
        "vitals": vitals,
        "pain_score": enc.pain_score,
        "observed_symptoms": observed,
        "history": history,
        "arrived_at": enc.arrived_at.isoformat() + "Z" if enc.arrived_at else datetime.utcnow().isoformat() + "Z",
        "triage": triage,
        "clinician_decision": clinician_decision,
        "status": enc.status or "queued",
        "deteriorated": enc.deteriorated or False,
        "last_reassessed_at": enc.last_reassessed_at.isoformat() + "Z" if enc.last_reassessed_at else None,
        "events": events_list,
    }


# ══════════════════════════════════════════════════════════════════════
# POST /patients — Create a new patient encounter
# ══════════════════════════════════════════════════════════════════════

@router.post("/patients")
def create_patient(intake: PatientIntake, db: Session = Depends(get_db)):
    """
    Create a new patient encounter, run the ML triage pipeline,
    and return a rich patient response.
    """

    # Parse arrival time
    try:
        arrived_at = datetime.fromisoformat(intake.arrived_at.replace("Z", "+00:00")) if intake.arrived_at else datetime.utcnow()
    except (ValueError, AttributeError):
        arrived_at = datetime.utcnow()

    age_group = age_group_of(intake.age)

    # Build vitals dict
    vitals_dict = intake.vitals.model_dump()

    # Run the ML triage pipeline
    mode = "surge" if settings.SURGE_MODE else "normal"
    triage_result = compute_full_triage(
        age=intake.age,
        sex=intake.sex,
        complaint=intake.complaint,
        vitals=vitals_dict,
        pain_score=intake.pain_score,
        observed_symptoms=intake.observed_symptoms,
        has_history=intake.history.has_record,
        comorbidities=intake.history.comorbidities,
        complaint_tag=intake.complaint_tag,
        mode=mode,
    )

    # Create encounter
    enc = Encounter(
        mrn=_next_mrn(),
        name=intake.name,
        age=intake.age,
        sex=intake.sex,
        age_group=age_group,
        complaint=intake.complaint,
        complaint_tag=intake.complaint_tag,
        pain_score=intake.pain_score,
        observed_symptoms_json=json.dumps(intake.observed_symptoms),
        vital_hr=intake.vitals.hr,
        vital_sbp=intake.vitals.sbp,
        vital_dbp=intake.vitals.dbp,
        vital_rr=intake.vitals.rr,
        vital_temp=intake.vitals.temp,
        vital_spo2=intake.vitals.spo2,
        vital_gcs=intake.vitals.gcs,
        has_history=intake.history.has_record,
        comorbidities_json=json.dumps(intake.history.comorbidities),
        triage_severity=triage_result["severity"],
        triage_confidence=triage_result["confidence"],
        triage_confidence_score=triage_result["confidence_score"],
        triage_completeness=triage_result["completeness"],
        triage_factors_json=json.dumps(triage_result["factors"]),
        triage_gate=triage_result["gate"],
        triage_escalated=triage_result["escalated"],
        triage_points=triage_result["points"],
        triage_raw_score=triage_result["raw_score"],
        triage_model_version=triage_result["model_version"],
        triage_computed_at=datetime.utcnow(),
        status="queued",
        deteriorated=False,
        arrived_at=arrived_at,
    )
    db.add(enc)
    db.commit()
    db.refresh(enc)

    # Create arrival event
    event = EncounterEvent(
        encounter_id=enc.id,
        type="arrival",
        detail="Patient arrived and intake data recorded.",
        at=arrived_at,
    )
    db.add(event)

    # Create audit entry
    audit = FrontendAudit(
        encounter_id=enc.id,
        patient_name=enc.name,
        action="ai_recommendation",
        ai_severity=triage_result["severity"],
        ai_confidence=triage_result["confidence"],
        clinician="RN (on shift)",
        model_version=triage_result["model_version"],
        at=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()

    return _encounter_to_response(enc, db)


# ══════════════════════════════════════════════════════════════════════
# GET /patients/{id} — Get full patient details
# ══════════════════════════════════════════════════════════════════════

@router.get("/patients/{encounter_id}")
def get_patient(encounter_id: int, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(404, "Patient not found")
    return _encounter_to_response(enc, db)


# ══════════════════════════════════════════════════════════════════════
# POST /patients/{id}/accept — Clinician accepts AI recommendation
# ══════════════════════════════════════════════════════════════════════

@router.post("/patients/{encounter_id}/accept")
def accept_patient(encounter_id: int, req: AcceptRequest, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(404, "Patient not found")

    enc.decision_kind = "accept"
    enc.decision_level = enc.triage_severity
    enc.decision_reason = None
    enc.decision_clinician = req.clinician
    enc.decision_at = datetime.utcnow()

    # Audit
    audit = FrontendAudit(
        encounter_id=enc.id,
        patient_name=enc.name,
        action="clinician_accept",
        ai_severity=enc.triage_severity,
        ai_confidence=enc.triage_confidence,
        override_level=None,
        override_reason=None,
        clinician=req.clinician,
        model_version=enc.triage_model_version or MODEL_VERSION,
        at=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    db.refresh(enc)

    return _encounter_to_response(enc, db)


# ══════════════════════════════════════════════════════════════════════
# POST /patients/{id}/override — Clinician overrides ESI
# ══════════════════════════════════════════════════════════════════════

@router.post("/patients/{encounter_id}/override")
def override_patient(encounter_id: int, req: OverrideRequest, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(404, "Patient not found")

    old_severity = enc.triage_severity

    enc.decision_kind = "override"
    enc.decision_level = req.level
    enc.decision_reason = req.reason
    enc.decision_clinician = req.clinician
    enc.decision_at = datetime.utcnow()

    # Audit
    audit = FrontendAudit(
        encounter_id=enc.id,
        patient_name=enc.name,
        action="clinician_override",
        ai_severity=enc.triage_severity,
        ai_confidence=enc.triage_confidence,
        override_level=req.level,
        override_reason=req.reason,
        clinician=req.clinician,
        model_version=enc.triage_model_version or MODEL_VERSION,
        at=datetime.utcnow(),
    )
    db.add(audit)

    # Event
    event = EncounterEvent(
        encounter_id=enc.id,
        type="override",
        detail=f"Clinician {req.clinician} overrode ESI {old_severity} → {req.level}: {req.reason}",
        at=datetime.utcnow(),
    )
    db.add(event)

    db.commit()
    db.refresh(enc)

    return _encounter_to_response(enc, db)


# ══════════════════════════════════════════════════════════════════════
# POST /patients/{id}/reassess — Re-run triage with new vitals
# ══════════════════════════════════════════════════════════════════════

@router.post("/patients/{encounter_id}/reassess")
def reassess_patient(encounter_id: int, req: ReassessRequest, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(404, "Patient not found")

    # Determine previous effective level
    prev_level = enc.decision_level if enc.decision_kind else enc.triage_severity

    # Update vitals
    new_vitals = req.vitals.model_dump()
    enc.vital_hr = new_vitals.get("hr")
    enc.vital_sbp = new_vitals.get("sbp")
    enc.vital_dbp = new_vitals.get("dbp")
    enc.vital_rr = new_vitals.get("rr")
    enc.vital_temp = new_vitals.get("temp")
    enc.vital_spo2 = new_vitals.get("spo2")
    enc.vital_gcs = new_vitals.get("gcs")

    if req.pain_score is not None:
        enc.pain_score = req.pain_score

    if req.observed_symptoms:
        enc.observed_symptoms_json = json.dumps(req.observed_symptoms)

    # Load comorbidities
    try:
        comorbidities = json.loads(enc.comorbidities_json or "[]")
    except (json.JSONDecodeError, TypeError):
        comorbidities = []

    # Re-run triage
    mode = "surge" if settings.SURGE_MODE else "normal"
    try:
        observed = json.loads(enc.observed_symptoms_json or "[]")
    except (json.JSONDecodeError, TypeError):
        observed = []

    triage_result = compute_full_triage(
        age=enc.age,
        sex=enc.sex,
        complaint=enc.complaint,
        vitals=new_vitals,
        pain_score=enc.pain_score,
        observed_symptoms=observed,
        has_history=enc.has_history,
        comorbidities=comorbidities,
        complaint_tag=enc.complaint_tag,
        mode=mode,
    )

    # Update triage
    enc.triage_severity = triage_result["severity"]
    enc.triage_confidence = triage_result["confidence"]
    enc.triage_confidence_score = triage_result["confidence_score"]
    enc.triage_completeness = triage_result["completeness"]
    enc.triage_factors_json = json.dumps(triage_result["factors"])
    enc.triage_gate = triage_result["gate"]
    enc.triage_escalated = triage_result["escalated"]
    enc.triage_points = triage_result["points"]
    enc.triage_raw_score = triage_result["raw_score"]
    enc.triage_model_version = triage_result["model_version"]
    enc.triage_computed_at = datetime.utcnow()
    enc.last_reassessed_at = datetime.utcnow()

    # Detect deterioration
    worsened = triage_result["severity"] < prev_level
    if worsened:
        enc.deteriorated = True
        enc.decision_kind = None  # Clear clinician decision on deterioration
        enc.decision_level = None
        enc.decision_reason = None
        enc.decision_clinician = None
        enc.decision_at = None

    # Vitals event
    hr_str = f"HR {new_vitals.get('hr', '—')}" if new_vitals.get("hr") else ""
    rr_str = f"RR {new_vitals.get('rr', '—')}" if new_vitals.get("rr") else ""
    spo2_str = f"SpO₂ {new_vitals.get('spo2', '—')}%" if new_vitals.get("spo2") else ""
    temp_str = f"Temp {new_vitals.get('temp', '—')}°C" if new_vitals.get("temp") else ""
    vital_parts = [s for s in [hr_str, rr_str, spo2_str, temp_str] if s]
    detail_str = f"Vitals re-recorded: {', '.join(vital_parts)}." if vital_parts else "Vitals re-recorded."

    event = EncounterEvent(
        encounter_id=enc.id,
        type="vitals",
        detail=detail_str,
        at=datetime.utcnow(),
    )
    db.add(event)

    # Reassessment alert event if deteriorated
    if worsened:
        alert_event = EncounterEvent(
            encounter_id=enc.id,
            type="reassess-alert",
            detail=f"Automatic reassessment: severity escalated L{prev_level} → L{triage_result['severity']}. Clinician review required.",
            at=datetime.utcnow(),
        )
        db.add(alert_event)

    # Audit
    action = "ai_reassessment" if worsened else "ai_recheck"
    audit = FrontendAudit(
        encounter_id=enc.id,
        patient_name=enc.name,
        action=action,
        ai_severity=triage_result["severity"],
        ai_confidence=triage_result["confidence"],
        clinician="SYSTEM",
        model_version=triage_result["model_version"],
        at=datetime.utcnow(),
    )
    db.add(audit)

    db.commit()
    db.refresh(enc)

    return _encounter_to_response(enc, db)


# ══════════════════════════════════════════════════════════════════════
# POST /patients/{id}/discharge — Remove from queue
# ══════════════════════════════════════════════════════════════════════

@router.post("/patients/{encounter_id}/discharge")
def discharge_patient(encounter_id: int, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(404, "Patient not found")

    enc.status = "discharged"

    event = EncounterEvent(
        encounter_id=enc.id,
        type="discharge",
        detail="Patient discharged from queue.",
        at=datetime.utcnow(),
    )
    db.add(event)

    db.commit()
    return {"message": f"Patient {encounter_id} discharged"}


# ══════════════════════════════════════════════════════════════════════
# GET /queue — All queued patients
# ══════════════════════════════════════════════════════════════════════

@router.get("/queue")
def get_queue(db: Session = Depends(get_db)):
    """Return all queued encounters sorted by severity then arrival time."""
    encounters = db.query(Encounter).filter(
        Encounter.status == "queued"
    ).order_by(
        Encounter.triage_severity.asc(),
        Encounter.arrived_at.asc(),
    ).all()

    return [_encounter_to_response(enc, db) for enc in encounters]


# ══════════════════════════════════════════════════════════════════════
# GET /audit-log — Audit trail
# ══════════════════════════════════════════════════════════════════════

@router.get("/audit-log")
def get_audit_log(db: Session = Depends(get_db)):
    """Return all audit entries sorted by most recent first."""
    entries = db.query(FrontendAudit).order_by(FrontendAudit.at.desc()).all()

    return [
        {
            "id": f"AUD-{entry.id}",
            "at": entry.at.isoformat() + "Z" if entry.at else datetime.utcnow().isoformat() + "Z",
            "patient_id": entry.encounter_id,
            "patient_name": entry.patient_name,
            "action": entry.action,
            "ai_severity": entry.ai_severity,
            "ai_confidence": entry.ai_confidence,
            "override_level": entry.override_level,
            "override_reason": entry.override_reason,
            "clinician": entry.clinician,
            "model_version": entry.model_version or MODEL_VERSION,
        }
        for entry in entries
    ]


# ══════════════════════════════════════════════════════════════════════
# POST /dev/reset — Clear all frontend data
# ══════════════════════════════════════════════════════════════════════

@router.post("/dev/reset")
def reset_data(db: Session = Depends(get_db)):
    """Clear all encounters, events, and audit entries. Called by frontend on startup."""
    db.query(EncounterEvent).delete()
    db.query(FrontendAudit).delete()
    db.query(Encounter).delete()
    db.commit()
    return {"message": "All frontend data cleared"}


# ══════════════════════════════════════════════════════════════════════
# POST /mode — Set surge/normal mode
# ══════════════════════════════════════════════════════════════════════

@router.post("/mode")
def set_mode(req: ModeRequest, db: Session = Depends(get_db)):
    """Set the triage mode to 'surge' or 'normal'."""
    if req.mode == "surge":
        settings.SURGE_MODE = True
    else:
        settings.SURGE_MODE = False

    return {
        "mode": req.mode,
        "surge_mode": settings.SURGE_MODE,
        "message": f"Mode set to {req.mode}",
    }


# ══════════════════════════════════════════════════════════════════════
# POST /api/triage/assess — Live AI assessment for TriageFlowPage
# ══════════════════════════════════════════════════════════════════════

from ..schemas_v2 import PatientHistory

@router.post("/api/triage/assess", response_model=TriageAssessResponse)
def assess_patient(req: TriageAssessRequest, db: Session = Depends(get_db)):
    if req.immediate_critical:
        return TriageAssessResponse(
            decision="IMMEDIATE_TREATMENT",
            stage="immediate_check",
            esi_level=1,
            prediction="Immediate",
            model_called=False,
            reason="Patient is critically serious — immediate treatment required.",
            triggered_rules=[],
            missing_features=[],
        )
    
    vitals_data = req.vitals.model_dump() if req.vitals else {}
    symptoms_text = (req.complaint or "") + " " + " ".join(req.symptoms)
    
    triage_result = compute_full_triage(
        age=req.age or 35,
        sex=req.sex or "M",
        complaint=req.complaint or "",
        vitals=vitals_data,
        pain_score=None,
        observed_symptoms=req.symptoms,
        has_history=False,
        comorbidities=[],
        complaint_tag=req.complaint_tag,
    )
    triggered = []
    for f in triage_result["factors"]:
        if f["type"] == "up":
            triggered.append({
                "severity": "CRITICAL" if triage_result["severity"] == 1 else "URGENT",
                "rule_id": "clinical_rule",
                "message": f["label"]
            })
            
    esi = triage_result["severity"]
    
    esi_map = {1: "Immediate", 2: "Emergent", 3: "Urgent", 4: "Less Urgent", 5: "Non-Urgent"}
    prediction_label = esi_map.get(esi, "Unknown")
    
    if triage_result["gate"]:
        decision = "CRITICAL_ESCALATION" if esi == 1 else "URGENT_ESCALATION"
        return TriageAssessResponse(
            decision=decision,
            stage="stage2",
            esi_level=esi,
            prediction=prediction_label,
            model_called=False,
            reason=triage_result["gate"],
            triggered_rules=triggered,
            missing_features=[],
        )
    else:
        return TriageAssessResponse(
            decision="MODEL_PREDICTION",
            stage="stage2",
            esi_level=esi,
            prediction=prediction_label,
            model_called=True,
            reason="AI-assisted triage assessment completed.",
            triggered_rules=triggered,
            missing_features=[],
        )

@router.get("/api/triage/health")
def get_triage_health():
    return {"status": "ok", "service": "triage_engine"}
