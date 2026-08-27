from pydantic import BaseModel
from typing import Optional, List

# 1. VITALS INPUT SCHEMA
class VitalsInput(BaseModel):
    hr: Optional[float] = None     # Heart Rate
    sbp: Optional[float] = None    # Systolic Blood Pressure
    dbp: Optional[float] = None    # Diastolic Blood Pressure
    rr: Optional[float] = None     # Respiratory Rate
    temp: Optional[float] = None   # Temperature
    spo2: Optional[float] = None   # Oxygen Saturation

# 2. FULL TRIAGE INPUT SCHEMA
class TriageInput(BaseModel):
    patient_id: Optional[int] = None  # If provided, link to existing patient (skip creation)
    name: Optional[str] = None        # Required only for new patients
    age: Optional[int] = None         # Required only for new patients
    gender: str = "Other"             # "Male", "Female", or "Other"
    has_history: bool = False          # PS Requirement
    symptom_text: str = ""             # Free text entered by nurse
    vitals: VitalsInput = VitalsInput()

# 3. TRIAGE RESPONSE SCHEMA
class TriageResponse(BaseModel):
    visit_id: int                  # The unique ID of this ER visit
    patient_id: int                # The patient ID (useful for existing patient flow)
    esi: int                       # Predicted ESI level (1-5)
    confidence: float              # Confidence score (0-1)
    raw_score: float               # The raw regression float from the model
    reasons: List[str]             # Top reasons for the prediction
    action: str                    # "Immediate Resuscitation", "Immediate Bed", etc.
    alert: str                     # "NONE", "LOW_CONFIDENCE", "CRITICAL_BYPASS"
    source: str                    # "hard_gate", "ml", "bypass"

# 4. OVERRIDE INPUT SCHEMA
class OverrideInput(BaseModel):
    new_esi: int                   # The new ESI level (1-5)
    reason: str                    # Why the nurse is overriding
    nurse_id: str                  # Which nurse made the change (audit trail)

# 5. BYPASS INPUT SCHEMA (Immediate Life-Threat)
class BypassInput(BaseModel):
    patient_id: Optional[int] = None  # Existing patient
    name: Optional[str] = None        # New patient name
    age: Optional[int] = None         # New patient age
    gender: str = "Other"
    condition: str = ""               # "cardiac_arrest", "unresponsive", "heavy_bleeding"

# 6. VITALS-ONLY INPUT (for step-by-step flow: submit vitals first, check hard rules)
class VitalsCheckInput(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Other"
    has_history: bool = False
    vitals: VitalsInput

# 7. VITALS CHECK RESPONSE
class VitalsCheckResponse(BaseModel):
    visit_id: int
    patient_id: int
    hard_rule_triggered: bool      # Did the vitals alone trigger ESI 1 or 2?
    esi: Optional[int] = None      # ESI if hard rule triggered, else None
    confidence: Optional[float] = None
    reasons: List[str] = []
    action: str = ""               # "" if not triggered, else action string
    message: str                   # "Proceed to symptoms" or "ESI assigned by vitals"

# 8. SYMPTOMS-ONLY INPUT (step 2 of the wizard: add symptoms to existing visit)
class SymptomsInput(BaseModel):
    symptom_text: str              # Free text chief complaints

# 9. RE-VITALS INPUT (for vital drift detection during wait)
class RevitalsInput(BaseModel):
    hr: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    rr: Optional[float] = None
    temp: Optional[float] = None
    spo2: Optional[float] = None
    nurse_id: str = "SYSTEM"
