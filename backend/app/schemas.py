from pydantic import BaseModel, Field
from typing import Optional, List

# Input-SAFETY bounds (hard limits), NOT clinical "normal" ranges.
# Values outside these are rejected outright as impossible/invalid input.
# Clinical abnormal warnings are handled separately (see hard_rules.py / frontend).
VITAL_HR = Field(None, ge=20, le=250, description="20–250 bpm")
VITAL_SBP = Field(None, ge=50, le=300, description="50–300 mmHg")
VITAL_DBP = Field(None, ge=20, le=200, description="20–200 mmHg")
VITAL_RR = Field(None, ge=4, le=80, description="4–80 breaths/min")
VITAL_SPO2 = Field(None, ge=50, le=100, description="50–100 %")
VITAL_TEMP = Field(None, ge=25, le=45, description="25–45 °C")

# 1. VITALS INPUT SCHEMA
class VitalsInput(BaseModel):
    hr: Optional[float] = VITAL_HR     # Heart Rate
    sbp: Optional[float] = VITAL_SBP   # Systolic Blood Pressure
    dbp: Optional[float] = VITAL_DBP   # Diastolic Blood Pressure
    rr: Optional[float] = VITAL_RR     # Respiratory Rate
    temp: Optional[float] = VITAL_TEMP # Temperature
    spo2: Optional[float] = VITAL_SPO2 # Oxygen Saturation

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
    hr: Optional[float] = VITAL_HR
    sbp: Optional[float] = VITAL_SBP
    dbp: Optional[float] = VITAL_DBP
    rr: Optional[float] = VITAL_RR
    temp: Optional[float] = VITAL_TEMP
    spo2: Optional[float] = VITAL_SPO2
    nurse_id: str = "SYSTEM"

# 9b. CLINICIAN ACCEPT INPUT (nurse accepts the AI ESI recommendation)
class AcceptInput(BaseModel):
    nurse_id: str = "RN-Shift"
    reason: str = "Clinician reviewed and accepted the AI ESI recommendation."

# 10. HOSPITAL CONFIGURATION INPUT SCHEMA
class HospitalConfigInput(BaseModel):
    profile: str = "community"
    hospital_name: str = "Community Hospital"

    # Normal wait thresholds (seconds)
    wait_esi_1: int = 0
    wait_esi_2: int = 600
    wait_esi_3: int = 1800
    wait_esi_4: int = 3600
    wait_esi_5: int = 7200

    # Surge wait thresholds (seconds)
    surge_wait_esi_1: int = 0
    surge_wait_esi_2: int = 300
    surge_wait_esi_3: int = 900
    surge_wait_esi_4: int = 1800
    surge_wait_esi_5: int = 3600

    # AI threshold
    confidence_threshold: float = Field(0.50, ge=0.0, le=1.0)

    # Staffing
    department_capacity: int = Field(40, ge=1, le=500)
    attending_physicians: int = Field(6, ge=0, le=100)
    nurses_on_duty: int = Field(12, ge=0, le=200)

    # Specialties (JSON string array)
    specialties: List[str] = ["Emergency Medicine", "Internal Medicine", "Cardiology", "Orthopedics", "Neurology", "Pediatrics"]

    # Alert policy
    alert_reassessment_enabled: bool = True
    alert_low_confidence_enabled: bool = True
    alert_queue_wait_threshold: int = Field(30, ge=1, le=480)

    # Integration
    ehr_system: str = "none"
    ehr_endpoint: str = ""

    # Who is saving
    updated_by: str = "Admin"

