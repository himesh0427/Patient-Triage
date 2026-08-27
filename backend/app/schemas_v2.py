"""
Pydantic schemas for the frontend-compatible API.

These match the exact request/response shapes that the React frontend
(store.jsx, api.js) expects.
"""

from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# ══════════════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ══════════════════════════════════════════════════════════════════════

class PatientVitals(BaseModel):
    hr: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    rr: Optional[float] = None
    temp: Optional[float] = None
    spo2: Optional[float] = None
    gcs: Optional[float] = 15

class PatientHistory(BaseModel):
    has_record: bool = False
    comorbidities: List[str] = []

class PatientIntake(BaseModel):
    """Request body for POST /patients — matches what store.jsx sends."""
    name: str
    age: int
    sex: str                                  # "M" / "F"
    complaint: str
    complaint_tag: Optional[str] = None
    vitals: PatientVitals
    pain_score: Optional[int] = None
    observed_symptoms: List[str] = []
    history: PatientHistory = PatientHistory()
    arrived_at: Optional[str] = None          # ISO datetime string

class AcceptRequest(BaseModel):
    """Request body for POST /patients/{id}/accept"""
    clinician: str = "RN (on shift)"

class OverrideRequest(BaseModel):
    """Request body for POST /patients/{id}/override"""
    level: int
    reason: str
    clinician: str = "RN (on shift)"

class ReassessRequest(BaseModel):
    """Request body for POST /patients/{id}/reassess"""
    vitals: PatientVitals
    pain_score: Optional[int] = None
    observed_symptoms: List[str] = []

class ModeRequest(BaseModel):
    """Request body for POST /mode"""
    mode: str                                 # "surge" or "normal"


class TriageAssessRequest(BaseModel):
    immediate_critical: bool
    age: Optional[int] = None
    sex: Optional[str] = None
    vitals: Optional[PatientVitals] = None
    complaint: Optional[str] = None
    symptoms: List[str] = []
    complaint_tag: Optional[str] = None

class TriageAssessResponse(BaseModel):
    decision: str
    stage: str
    esi_level: Optional[int] = None
    prediction: Optional[str] = None
    model_called: bool
    reason: str
    triggered_rules: List[dict] = []
    missing_features: List[str] = []


# ══════════════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ══════════════════════════════════════════════════════════════════════

class TriageFactor(BaseModel):
    label: str
    weight: int
    type: str                                 # "up", "warn", "info"

class TriageResult(BaseModel):
    """Nested triage object — matches what mapTriage() in store.jsx expects."""
    severity: int                             # ESI 1-5
    confidence: str                           # "High" / "Medium" / "Low"
    confidence_score: int                     # 0-100
    completeness: int                         # 0-100
    factors: List[TriageFactor]
    gate: Optional[str] = None               # Hard-gate text or null
    escalated: bool = False
    points: int = 0
    model_version: str = "PT-Triage v0.9.2-hackathon"
    computed_at: str                          # ISO datetime

class ClinicianDecisionResponse(BaseModel):
    kind: str                                 # "accept" / "override"
    level: int
    reason: Optional[str] = None
    clinician: str
    decided_at: str                           # ISO datetime

class EventResponse(BaseModel):
    at: str                                   # ISO datetime
    type: str
    detail: str

class PatientResponse(BaseModel):
    """
    Full patient response — matches what mapPatient() in store.jsx expects.

    This is returned by POST /patients, GET /patients/{id}, GET /queue items,
    and POST /patients/{id}/override, /accept, /reassess.
    """
    id: int
    mrn: str
    name: str
    age: int
    sex: str
    age_group: str
    complaint: str
    complaint_tag: Optional[str] = None
    vitals: dict
    pain_score: Optional[int] = None
    observed_symptoms: List[str] = []
    history: dict
    arrived_at: str
    triage: TriageResult
    clinician_decision: Optional[ClinicianDecisionResponse] = None
    status: str
    deteriorated: bool = False
    last_reassessed_at: Optional[str] = None
    events: List[EventResponse] = []

class AuditEntryResponse(BaseModel):
    """Matches what mapAudit() in store.jsx expects."""
    id: str
    at: str
    patient_id: int
    patient_name: str
    action: str
    ai_severity: int
    ai_confidence: Optional[str] = None
    override_level: Optional[int] = None
    override_reason: Optional[str] = None
    clinician: str
    model_version: str
