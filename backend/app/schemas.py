from pydantic import BaseModel
from typing import Optional, List

# 1. VITALS INPUT SCHEMA
# This defines what a packet of vitals looks like when the frontend sends it to you.
# Notice every field is Optional[...] because a nurse might not record all vitals.
class VitalsInput(BaseModel):
    hr: Optional[float] = None     # Heart Rate
    sbp: Optional[float] = None    # Systolic Blood Pressure
    dbp: Optional[float] = None    # Diastolic Blood Pressure
    rr: Optional[float] = None     # Respiratory Rate
    temp: Optional[float] = None   # Temperature
    spo2: Optional[float] = None   # Oxygen Saturation

# 2. FULL TRIAGE INPUT SCHEMA
# This is the complete packet the frontend sends when a nurse submits a new patient.
class TriageInput(BaseModel):
    name: str                      # Patient's name
    age: int                       # Patient's age (critical for pediatric/geriatric rules)
    gender: str = "Other"          # "Male", "Female", or "Other"
    has_history: bool = False      # Does the patient have previous records? (PS Requirement)
    symptom_text: str              # Free text entered by nurse (e.g., "chest pain and shortness of breath")
    vitals: VitalsInput           

# 3. TRIAGE RESPONSE SCHEMA
# This is what your backend will send back to the frontend after predicting.
class TriageResponse(BaseModel):
    visit_id: int                  # The unique ID of this ER visit
    esi: int                       # Predicted ESI level (1-5)
    confidence: float              # Confidence score (0-1). PS Requirement: "must not return a score without a confidence indicator"
    raw_score: float               # The raw regression float from the model (e.g., 2.3)
    reasons: List[str]             # Top reasons for the prediction (explainability)
    action: str                    # Human-readable action: "Immediate Bed" or "Monitor Queue"

# 4. OVERRIDE INPUT SCHEMA
# This defines what the frontend sends when a nurse overrides an ESI score.
class OverrideInput(BaseModel):
    new_esi: int                   # The new ESI level the nurse is assigning (1-5)
    reason: str                    # Why is the nurse overriding? (e.g., "Patient looks worse")
    nurse_id: str                  # Which nurse made the change (for audit trail)
