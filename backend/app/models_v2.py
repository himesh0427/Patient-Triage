"""
Frontend-compatible database models.

These tables serve the new frontend API layer (/patients, /queue, /audit-log).
The existing tables (patients, visits, vitals, etc.) remain untouched for
backward compatibility with the original /triage/* endpoints.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base


class Encounter(Base):
    """
    Denormalized patient encounter — one row per ED visit.

    Combines patient identity, vitals, triage results, and clinician decision
    into a single table so each API response can be built from one DB row
    plus its events.
    """
    __tablename__ = "encounters"

    # ── Identity ──
    id = Column(Integer, primary_key=True, index=True)
    mrn = Column(String(20))
    name = Column(String(100))
    age = Column(Integer)
    sex = Column(String(10))          # "M" / "F"
    age_group = Column(String(20))    # "pediatric" / "adult" / "geriatric"

    # ── Complaint ──
    complaint = Column(Text)
    complaint_tag = Column(String(50), nullable=True)
    pain_score = Column(Integer, nullable=True)
    observed_symptoms_json = Column(Text, default="[]")   # JSON array of strings

    # ── Vitals (inline for simplicity) ──
    vital_hr = Column(Float, nullable=True)
    vital_sbp = Column(Float, nullable=True)
    vital_dbp = Column(Float, nullable=True)
    vital_rr = Column(Float, nullable=True)
    vital_temp = Column(Float, nullable=True)
    vital_spo2 = Column(Float, nullable=True)
    vital_gcs = Column(Float, nullable=True)

    # ── History ──
    has_history = Column(Boolean, default=False)
    comorbidities_json = Column(Text, default="[]")       # JSON array of strings

    # ── Triage ML results ──
    triage_severity = Column(Integer)                     # ESI 1-5
    triage_confidence = Column(String(10))                # "High" / "Medium" / "Low"
    triage_confidence_score = Column(Integer)             # 0-100
    triage_completeness = Column(Integer)                 # 0-100
    triage_factors_json = Column(Text, default="[]")      # JSON array of {label, weight, type}
    triage_gate = Column(Text, nullable=True)             # Hard-gate text or null
    triage_escalated = Column(Boolean, default=False)
    triage_points = Column(Integer, default=0)
    triage_raw_score = Column(Float, nullable=True)
    triage_model_version = Column(String(50), default="PT-Triage v0.9.2-hackathon")
    triage_computed_at = Column(DateTime(timezone=True))

    # ── Clinician decision ──
    decision_kind = Column(String(20), nullable=True)     # "accept" / "override"
    decision_level = Column(Integer, nullable=True)
    decision_reason = Column(Text, nullable=True)
    decision_clinician = Column(String(100), nullable=True)
    decision_at = Column(DateTime(timezone=True), nullable=True)

    # ── Status ──
    status = Column(String(20), default="queued")         # "queued" / "routed" / "discharged"
    deteriorated = Column(Boolean, default=False)
    arrived_at = Column(DateTime(timezone=True))
    last_reassessed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EncounterEvent(Base):
    """Timeline events for an encounter (arrival, vitals re-check, reassessment alerts)."""
    __tablename__ = "encounter_events"

    id = Column(Integer, primary_key=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"))
    type = Column(String(50))         # "arrival", "vitals", "reassess-alert"
    detail = Column(Text)
    at = Column(DateTime(timezone=True), server_default=func.now())


class FrontendAudit(Base):
    """
    Audit log entries in the format the frontend expects.

    Different schema from the existing audit_logs table — this one includes
    patient_name, ai_severity, ai_confidence, model_version, etc.
    """
    __tablename__ = "frontend_audit"

    id = Column(Integer, primary_key=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"))
    patient_name = Column(String(100))
    action = Column(String(50))               # "ai_recommendation", "clinician_accept", "clinician_override", "ai_reassessment"
    ai_severity = Column(Integer)
    ai_confidence = Column(String(10))
    override_level = Column(Integer, nullable=True)
    override_reason = Column(Text, nullable=True)
    clinician = Column(String(100), default="RN (on shift)")
    model_version = Column(String(50), default="PT-Triage v0.9.2-hackathon")
    at = Column(DateTime(timezone=True), server_default=func.now())
