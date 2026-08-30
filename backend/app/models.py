from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    age = Column(Integer)
    gender = Column(String(10), default="Other")
    has_history = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Visit(Base):
    __tablename__ = "visits"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    arrival_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    esi_predicted = Column(Integer)
    esi_final = Column(Integer)
    confidence_score = Column(Float)
    raw_ml_score = Column(Float)
    top_reasons = Column(Text)
    
    is_overridden = Column(Boolean, default=False)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(String(100), nullable=True)
    override_timestamp = Column(DateTime(timezone=True), nullable=True)
    discharge_time = Column(DateTime(timezone=True), nullable=True)

class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    hr = Column(Float, nullable=True)
    sbp = Column(Float, nullable=True)
    dbp = Column(Float, nullable=True)
    rr = Column(Float, nullable=True)
    temp = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

class SymptomCC(Base):
    __tablename__ = "symptom_cc"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    raw_text = Column(Text, nullable=True)
    features_json = Column(Text, nullable=True)

class Queue(Base):
    __tablename__ = "queue"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    esi_level = Column(Integer)
    wait_time_seconds = Column(Integer, default=0)
    last_retriage_at = Column(DateTime(timezone=True), server_default=func.now())
    retriage_needed = Column(Boolean, default=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
    action = Column(String(50))
    old_value = Column(String(50), nullable=True)
    new_value = Column(String(50), nullable=True)
    user_id = Column(String(100))
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class HospitalConfig(Base):
    __tablename__ = "hospital_config"
    id = Column(Integer, primary_key=True, index=True)

    profile = Column(String(50), default="community")
    hospital_name = Column(String(200), default="Community Hospital")

    wait_esi_1 = Column(Integer, default=0)
    wait_esi_2 = Column(Integer, default=600)
    wait_esi_3 = Column(Integer, default=1800)
    wait_esi_4 = Column(Integer, default=3600)
    wait_esi_5 = Column(Integer, default=7200)

    surge_wait_esi_1 = Column(Integer, default=0)
    surge_wait_esi_2 = Column(Integer, default=300)
    surge_wait_esi_3 = Column(Integer, default=900)
    surge_wait_esi_4 = Column(Integer, default=1800)
    surge_wait_esi_5 = Column(Integer, default=3600)

    confidence_threshold = Column(Float, default=0.50)

    department_capacity = Column(Integer, default=40)
    attending_physicians = Column(Integer, default=6)
    nurses_on_duty = Column(Integer, default=12)

    specialties = Column(Text, default='["Emergency Medicine","Internal Medicine","Cardiology","Orthopedics","Neurology","Pediatrics"]')

    alert_reassessment_enabled = Column(Boolean, default=True)
    alert_low_confidence_enabled = Column(Boolean, default=True)
    alert_queue_wait_threshold = Column(Integer, default=30)

    ehr_system = Column(String(50), default="none")
    ehr_endpoint = Column(String(500), default="")

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(100), default="SYSTEM")
