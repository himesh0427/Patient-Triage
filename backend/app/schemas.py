from pydantic import BaseModel, Field
from typing import Optional, List

VITAL_HR = Field(None, ge=20, le=250, description="20–250 bpm")
VITAL_SBP = Field(None, ge=50, le=300, description="50–300 mmHg")
VITAL_DBP = Field(None, ge=20, le=200, description="20–200 mmHg")
VITAL_RR = Field(None, ge=4, le=80, description="4–80 breaths/min")
VITAL_SPO2 = Field(None, ge=50, le=100, description="50–100 %")
VITAL_TEMP = Field(None, ge=25, le=45, description="25–45 °C")

class VitalsInput(BaseModel):
    hr: Optional[float] = VITAL_HR
    sbp: Optional[float] = VITAL_SBP
    dbp: Optional[float] = VITAL_DBP
    rr: Optional[float] = VITAL_RR
    temp: Optional[float] = VITAL_TEMP
    spo2: Optional[float] = VITAL_SPO2

class TriageInput(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Other"
    has_history: bool = False
    symptom_text: str = ""
    vitals: VitalsInput = VitalsInput()

class TriageResponse(BaseModel):
    visit_id: int
    patient_id: int
    esi: int
    confidence: float
    raw_score: float
    reasons: List[str]
    action: str
    alert: str
    source: str

class OverrideInput(BaseModel):
    new_esi: int
    reason: str
    nurse_id: str

class BypassInput(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Other"
    condition: str = ""

class VitalsCheckInput(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Other"
    has_history: bool = False
    vitals: VitalsInput

class VitalsCheckResponse(BaseModel):
    visit_id: int
    patient_id: int
    hard_rule_triggered: bool
    esi: Optional[int] = None
    confidence: Optional[float] = None
    reasons: List[str] = []
    action: str = ""
    message: str

class SymptomsInput(BaseModel):
    symptom_text: str

class RevitalsInput(BaseModel):
    hr: Optional[float] = VITAL_HR
    sbp: Optional[float] = VITAL_SBP
    dbp: Optional[float] = VITAL_DBP
    rr: Optional[float] = VITAL_RR
    temp: Optional[float] = VITAL_TEMP
    spo2: Optional[float] = VITAL_SPO2
    nurse_id: str = "SYSTEM"

class AcceptInput(BaseModel):
    nurse_id: str = "RN-Shift"
    reason: str = "Clinician reviewed and accepted the AI ESI recommendation."

class HospitalConfigInput(BaseModel):
    profile: str = "community"
    hospital_name: str = "Community Hospital"

    wait_esi_1: int = 0
    wait_esi_2: int = 600
    wait_esi_3: int = 1800
    wait_esi_4: int = 3600
    wait_esi_5: int = 7200

    surge_wait_esi_1: int = 0
    surge_wait_esi_2: int = 300
    surge_wait_esi_3: int = 900
    surge_wait_esi_4: int = 1800
    surge_wait_esi_5: int = 3600

    confidence_threshold: float = Field(0.50, ge=0.0, le=1.0)

    department_capacity: int = Field(40, ge=1, le=500)
    attending_physicians: int = Field(6, ge=0, le=100)
    nurses_on_duty: int = Field(12, ge=0, le=200)

    specialties: List[str] = ["Emergency Medicine", "Internal Medicine", "Cardiology", "Orthopedics", "Neurology", "Pediatrics"]

    alert_reassessment_enabled: bool = True
    alert_low_confidence_enabled: bool = True
    alert_queue_wait_threshold: int = Field(30, ge=1, le=480)

    ehr_system: str = "none"
    ehr_endpoint: str = ""

    updated_by: str = "Admin"
