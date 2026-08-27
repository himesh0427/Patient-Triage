from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from datetime import datetime
import json

from .database import engine, Base, get_db
from .routers import triage, override, patients
from .config import settings
from .models import Visit, Queue, Patient, AuditLog, Vitals
from .schemas import RevitalsInput

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PatientTriage.ai API",
    version="2.0.0",
    description="AI-powered Emergency Department Triage System using LightGBM ordinal regression."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(triage.router)
app.include_router(override.router)
app.include_router(patients.router)


# =========================================================
# ROOT / HEALTH CHECK
# =========================================================
@app.get("/", tags=["System"])
def root():
    return {
        "message": "PatientTriage.ai API is running.",
        "docs": "/docs",
        "surge_mode": settings.SURGE_MODE,
        "hospital_type": settings.HOSPITAL_TYPE,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD
    }


# =========================================================
# SYSTEM CONFIGURATION ENDPOINTS
# =========================================================
@app.post("/config/surge", tags=["Config"])
def toggle_surge():
    """Toggle surge mode on/off."""
    settings.SURGE_MODE = not settings.SURGE_MODE
    return {
        "surge_mode": settings.SURGE_MODE,
        "message": f"Surge mode {'ACTIVATED' if settings.SURGE_MODE else 'DEACTIVATED'}"
    }

@app.post("/config/hospital-type", tags=["Config"])
def set_hospital_type(hospital_type: str = "URBAN"):
    """Set hospital type: URBAN (5-level ESI) or RURAL (3-tier merged)."""
    hospital_type = hospital_type.upper()
    if hospital_type not in ("URBAN", "RURAL"):
        from fastapi import HTTPException
        raise HTTPException(400, "hospital_type must be 'URBAN' or 'RURAL'")
    settings.HOSPITAL_TYPE = hospital_type
    return {
        "hospital_type": settings.HOSPITAL_TYPE,
        "message": f"Hospital type set to {settings.HOSPITAL_TYPE}"
    }

@app.post("/config/confidence-threshold", tags=["Config"])
def set_confidence_threshold(threshold: float = 0.50):
    """Set the confidence threshold below which the yellow alert appears."""
    settings.CONFIDENCE_THRESHOLD = max(0.0, min(1.0, threshold))
    return {
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "message": f"Confidence threshold set to {settings.CONFIDENCE_THRESHOLD}"
    }

@app.get("/config", tags=["Config"])
def get_config():
    """Get all current system configuration."""
    return {
        "surge_mode": settings.SURGE_MODE,
        "hospital_type": settings.HOSPITAL_TYPE,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD
    }


# =========================================================
# DASHBOARD STATS
# =========================================================
@app.get("/stats", tags=["Dashboard"])
def get_stats(db: Session = Depends(get_db)):
    """Dashboard stats for the nurse overview screen."""
    total_active = db.query(Visit).filter(Visit.is_active == True).count()
    total_discharged = db.query(Visit).filter(Visit.is_active == False).count()
    total_patients = db.query(Patient).count()
    
    # ESI distribution of active patients
    esi_counts = {}
    for esi_level in range(1, 6):
        count = db.query(Queue).join(Visit).filter(
            Visit.is_active == True,
            Queue.esi_level == esi_level
        ).count()
        esi_counts[f"esi_{esi_level}"] = count
    
    # Retriage needed count
    retriage_count = db.query(Queue).join(Visit).filter(
        Visit.is_active == True,
        Queue.retriage_needed == True
    ).count()
    
    # Override count (today)
    override_count = db.query(AuditLog).filter(
        AuditLog.action == "OVERRIDE"
    ).count()
    
    # Low confidence count (active patients with confidence < threshold)
    low_confidence = db.query(Visit).filter(
        Visit.is_active == True,
        Visit.confidence_score < settings.CONFIDENCE_THRESHOLD
    ).count()
    
    return {
        "total_active": total_active,
        "total_discharged": total_discharged,
        "total_patients_registered": total_patients,
        "esi_distribution": esi_counts,
        "retriage_needed": retriage_count,
        "overrides_logged": override_count,
        "low_confidence_active": low_confidence,
        "surge_mode": settings.SURGE_MODE,
        "hospital_type": settings.HOSPITAL_TYPE,
    }


# =========================================================
# RE-VITALS (Vital Drift Detection)
# =========================================================
@app.post("/triage/revitals/{visit_id}", tags=["Triage"])
def record_revitals(visit_id: int, input: RevitalsInput, db: Session = Depends(get_db)):
    """Record updated vitals during a patient's wait.
    Compares against baseline vitals to detect clinical deterioration."""
    
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        from fastapi import HTTPException
        raise HTTPException(404, "Visit not found")
    
    # Get baseline vitals (the first recorded set)
    baseline = db.query(Vitals).filter(Vitals.visit_id == visit_id).order_by(Vitals.id.asc()).first()
    
    # Save new vitals record
    new_vitals = Vitals(
        visit_id=visit_id,
        hr=input.hr, sbp=input.sbp, dbp=input.dbp,
        rr=input.rr, temp=input.temp, spo2=input.spo2
    )
    db.add(new_vitals)
    
    # Drift detection
    alerts = []
    if baseline:
        if baseline.spo2 and input.spo2 and (baseline.spo2 - input.spo2) > 5:
            alerts.append(f"SpO2 dropped from {baseline.spo2}% to {input.spo2}% (>{5}% drop)")
        if baseline.hr and input.hr and (input.hr - baseline.hr) > 20:
            alerts.append(f"HR increased from {baseline.hr} to {input.hr} bpm (>{20} bpm rise)")
        if baseline.sbp and input.sbp and (baseline.sbp - input.sbp) > 15:
            alerts.append(f"SBP dropped from {baseline.sbp} to {input.sbp} mmHg (>{15} mmHg drop)")
    
    drift_detected = len(alerts) > 0
    
    if drift_detected:
        # Flag for retriage
        queue = db.query(Queue).filter(Queue.visit_id == visit_id).first()
        if queue:
            queue.retriage_needed = True
        
        # Audit log
        log = AuditLog(
            visit_id=visit_id,
            action="VITAL_DRIFT_ALERT",
            old_value="baseline",
            new_value="deteriorated",
            user_id=input.nurse_id,
            reason="; ".join(alerts)
        )
        db.add(log)
    
    db.commit()
    
    return {
        "visit_id": visit_id,
        "drift_detected": drift_detected,
        "alerts": alerts,
        "message": "ALERT: Patient vitals deteriorating. Immediate reassessment recommended." if drift_detected else "Vitals stable. No drift detected."
    }


# =========================================================
# AUDIT LOG VIEWER
# =========================================================
@app.get("/audit/{visit_id}", tags=["Audit"])
def get_audit_log(visit_id: int, db: Session = Depends(get_db)):
    """Get the full audit trail for a visit."""
    logs = db.query(AuditLog).filter(
        AuditLog.visit_id == visit_id
    ).order_by(AuditLog.timestamp.desc()).all()
    
    return {
        "visit_id": visit_id,
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "user_id": log.user_id,
                "reason": log.reason,
                "timestamp": str(log.timestamp)
            }
            for log in logs
        ]
    }
