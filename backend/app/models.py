from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base

# 1. PATIENT TABLE
# Stores permanent patient info. Split from Visit because a patient can come multiple times.
class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    age = Column(Integer)  # Critical for pediatric/geriatric rules
    gender = Column(String(10), default="Other")  # "Male", "Female", "Other"
    has_history = Column(Boolean, default=False)  # PS Requirement
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# 2. VISIT TABLE
# Stores one specific trip to the ER. Connects to Patient via ForeignKey.
class Visit(Base):
    __tablename__ = "visits"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    arrival_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)  # Still in the queue or discharged?
    
    # Triage Results (from ML model)
    esi_predicted = Column(Integer)   # Raw ML score (1-5)
    esi_final = Column(Integer)       # After override (may be changed by nurse)
    confidence_score = Column(Float)  # Distance-to-boundary (0 to 1)
    raw_ml_score = Column(Float)      # The regression float (e.g., 1.8)
    top_reasons = Column(Text)        # Why did the ML predict this?
    
    # Override Tracking (PS Requirement: Audit Trail)
    is_overridden = Column(Boolean, default=False)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(String(100), nullable=True)
    override_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Discharge tracking
    discharge_time = Column(DateTime(timezone=True), nullable=True)

# 3. VITALS TABLE
# Stores the 6 vitals entered at triage. Linked to the Visit.
class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    hr = Column(Float, nullable=True)     # Heart Rate
    sbp = Column(Float, nullable=True)    # Systolic BP
    dbp = Column(Float, nullable=True)    # Diastolic BP
    rr = Column(Float, nullable=True)     # Respiratory Rate
    temp = Column(Float, nullable=True)   # Temperature
    spo2 = Column(Float, nullable=True)   # Oxygen Saturation
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

# 4. SYMPTOM CC TABLE
# Stores the mapped chief complaints (cc_*) and the original free text.
class SymptomCC(Base):
    __tablename__ = "symptom_cc"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    raw_text = Column(Text, nullable=True)          # The free text nurse typed
    features_json = Column(Text, nullable=True)     # The 175 cc_* flags as JSON string

# 5. QUEUE TABLE
# The actual waiting room line. Sorted by ESI level and arrival time.
class Queue(Base):
    __tablename__ = "queue"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    esi_level = Column(Integer)                     # Current ESI (changes on override)
    wait_time_seconds = Column(Integer, default=0)  # Calculated dynamically
    last_retriage_at = Column(DateTime(timezone=True), server_default=func.now())
    retriage_needed = Column(Boolean, default=False) # Yellow flag for nurse

# 6. AUDIT LOG TABLE
# PS Requirement: Every change must be logged.
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    action = Column(String(50))   # "OVERRIDE", "AUTO_ESCALATE", "RETRIAGE"
    old_value = Column(String(50))
    new_value = Column(String(50))
    user_id = Column(String(100)) # "SYSTEM" or "nurse_001"
    reason = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

# 7. HOSPITAL CONFIGURATION TABLE
# Singleton row (id=1) storing the full hospital operational configuration.
# Updated via the admin Hospital Configuration page. Changes are synced into
# the in-memory settings/REASSESSMENT_WAIT dicts on save so the running
# triage engine, queue manager, and alerts reflect them immediately.
class HospitalConfig(Base):
    __tablename__ = "hospital_config"
    id = Column(Integer, primary_key=True, index=True)

    # Hospital Profile
    profile = Column(String(50), default="community")           # "urban_trauma", "community", "rural_ed"
    hospital_name = Column(String(200), default="Community Hospital")

    # Per-ESI Reassessment Wait Thresholds (seconds)
    wait_esi_1 = Column(Integer, default=0)
    wait_esi_2 = Column(Integer, default=600)       # 10 min
    wait_esi_3 = Column(Integer, default=1800)      # 30 min
    wait_esi_4 = Column(Integer, default=3600)       # 60 min
    wait_esi_5 = Column(Integer, default=7200)       # 120 min

    # Surge-mode per-ESI thresholds (seconds)
    surge_wait_esi_1 = Column(Integer, default=0)
    surge_wait_esi_2 = Column(Integer, default=300)  # 5 min
    surge_wait_esi_3 = Column(Integer, default=900)  # 15 min
    surge_wait_esi_4 = Column(Integer, default=1800) # 30 min
    surge_wait_esi_5 = Column(Integer, default=3600) # 60 min

    # AI Confidence Threshold (0.0 – 1.0)
    confidence_threshold = Column(Float, default=0.50)

    # Staffing & Capacity
    department_capacity = Column(Integer, default=40)
    attending_physicians = Column(Integer, default=6)
    nurses_on_duty = Column(Integer, default=12)

    # Available Specialties (JSON array string)
    specialties = Column(Text, default='["Emergency Medicine","Internal Medicine","Cardiology","Orthopedics","Neurology","Pediatrics"]')

    # Alert Policy
    alert_reassessment_enabled = Column(Boolean, default=True)
    alert_low_confidence_enabled = Column(Boolean, default=True)
    alert_queue_wait_threshold = Column(Integer, default=30)  # minutes

    # Integration / EHR
    ehr_system = Column(String(50), default="none")            # "epic", "cerner", "none"
    ehr_endpoint = Column(String(500), default="")

    # Metadata
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(100), default="SYSTEM")

