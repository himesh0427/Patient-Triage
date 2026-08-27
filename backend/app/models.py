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
