from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, text, inspect
from datetime import datetime
import json

from .services.queue_manager import utcnow, iso_z
from .database import engine, Base, get_db, SessionLocal
from .routers import triage, override, patients, hospital_config, auth
from .config import settings, load_config_from_db
from .models import Visit, Queue, Patient, AuditLog, Vitals, HospitalConfig, User
from .schemas import RevitalsInput
from .services.auth_service import seed_demo_users, require_role, get_optional_user

Base.metadata.create_all(bind=engine)

def _run_migrations():
    inspector = inspect(engine)
    if "visits" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("visits")}
        if "discharge_time" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE visits ADD COLUMN discharge_time DATETIME"))
    if "queue" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("queue")}
        if "last_retriage_at" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE queue ADD COLUMN last_retriage_at DATETIME"))
    if "audit_logs" in inspector.get_table_names():
        with SessionLocal() as db:
            seed_demo_users(db)

_run_migrations()
load_config_from_db()

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

app.include_router(auth.router)
app.include_router(triage.router)
app.include_router(override.router)
app.include_router(patients.router)
app.include_router(hospital_config.router)

@app.get("/", tags=["System"])
def root():
    return {
        "message": "PatientTriage.ai API is running.",
        "docs": "/docs",
        "surge_mode": settings.SURGE_MODE,
        "hospital_type": settings.HOSPITAL_TYPE,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD
    }

@app.post("/config/surge", tags=["Config"])
def toggle_surge(
    current_user: User = Depends(require_role(["nurse", "admin"])),
    db: Session = Depends(get_db)
):
    settings.SURGE_MODE = not settings.SURGE_MODE
    from .services.auth_service import record_audit
    record_audit(
        db=db,
        action="AUTO_ESCALATE_SURGE" if settings.SURGE_MODE else "SURGE_DEACTIVATED",
        user_id=current_user.username,
        reason=f"Surge mode {'ACTIVATED' if settings.SURGE_MODE else 'DEACTIVATED'} by {current_user.full_name} ({current_user.role}).",
    )
    return {
        "surge_mode": settings.SURGE_MODE,
        "message": f"Surge mode {'ACTIVATED' if settings.SURGE_MODE else 'DEACTIVATED'}"
    }

@app.post("/config/hospital-type", tags=["Config"])
def set_hospital_type(
    hospital_type: str = "URBAN",
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    hospital_type = hospital_type.upper()
    if hospital_type not in ("URBAN", "RURAL"):
        from fastapi import HTTPException
        raise HTTPException(400, "hospital_type must be 'URBAN' or 'RURAL'")
    old_type = settings.HOSPITAL_TYPE
    settings.HOSPITAL_TYPE = hospital_type
    from .services.auth_service import record_audit
    record_audit(
        db=db,
        action="CONFIG_UPDATE",
        user_id=current_user.username,
        old_value=old_type,
        new_value=hospital_type,
        reason=f"Hospital operational type changed from {old_type} to {hospital_type} by Admin {current_user.full_name}.",
    )
    return {
        "hospital_type": settings.HOSPITAL_TYPE,
        "message": f"Hospital type set to {settings.HOSPITAL_TYPE}"
    }

@app.post("/config/confidence-threshold", tags=["Config"])
def set_confidence_threshold(
    threshold: float = 0.50,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    old_thresh = settings.CONFIDENCE_THRESHOLD
    settings.CONFIDENCE_THRESHOLD = max(0.0, min(1.0, threshold))
    from .services.auth_service import record_audit
    record_audit(
        db=db,
        action="CONFIG_UPDATE",
        user_id=current_user.username,
        old_value=str(old_thresh),
        new_value=str(settings.CONFIDENCE_THRESHOLD),
        reason=f"AI confidence warning threshold updated from {old_thresh} to {settings.CONFIDENCE_THRESHOLD} by Admin {current_user.full_name}.",
    )
    return {
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "message": f"Confidence threshold set to {settings.CONFIDENCE_THRESHOLD}"
    }

@app.get("/config", tags=["Config"])
def get_config():
    return {
        "surge_mode": settings.SURGE_MODE,
        "hospital_type": settings.HOSPITAL_TYPE,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD
    }

@app.get("/stats", tags=["Dashboard"])
def get_stats(db: Session = Depends(get_db)):
    total_active = db.query(Visit).filter(Visit.is_active == True).count()
    total_discharged = db.query(Visit).filter(Visit.is_active == False).count()
    total_patients = db.query(Patient).count()
    
    esi_counts = {}
    for esi_level in range(1, 6):
        count = db.query(Queue).join(Visit).filter(
            Visit.is_active == True,
            Queue.esi_level == esi_level
        ).count()
        esi_counts[f"esi_{esi_level}"] = count
    
    from .services.queue_manager import get_retriage_deadline
    retriage_count = 0
    active_queue_rows = db.query(Queue).join(Visit).filter(
        Visit.is_active == True
    ).all()
    for q in active_queue_rows:
        v = db.query(Visit).filter(Visit.id == q.visit_id).first()
        if v and get_retriage_deadline(q, v)["retriage_overdue"]:
            retriage_count += 1
    
    override_count = db.query(AuditLog).filter(
        AuditLog.action == "OVERRIDE"
    ).count()
    
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

@app.get("/alerts", tags=["Alerts"])
def get_alerts(db: Session = Depends(get_db)):
    from .services.queue_manager import get_retriage_deadline

    threshold = settings.CONFIDENCE_THRESHOLD
    now = utcnow()

    drift_visit_ids = {
        r[0]
        for r in db.query(AuditLog.visit_id)
        .filter(AuditLog.action == "VITAL_DRIFT_ALERT", AuditLog.visit_id.isnot(None))
        .all()
    }

    queue_items = db.query(Queue, Visit, Patient).join(
        Visit, Queue.visit_id == Visit.id
    ).join(
        Patient, Visit.patient_id == Patient.id
    ).filter(Visit.is_active == True).all()

    alerts = []
    counts = {
        "critical": 0,
        "reassessment_overdue": 0,
        "low_confidence": 0,
        "vital_deterioration": 0,
        "surge": 1 if settings.SURGE_MODE else 0,
    }

    alert_id = 0

    def _add(alert_type, severity, title, message, p, visit_id, esi, action):
        nonlocal alert_id
        alert_id += 1
        alerts.append({
            "id": alert_id,
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "patient_id": p.id,
            "visit_id": visit_id,
            "patient_name": p.name,
            "age": p.age,
            "esi_level": esi,
            "action": action,
            "timestamp": iso_z(now),
        })
        counts[alert_type.lower().replace(" ", "_")] = counts.get(
            alert_type.lower().replace(" ", "_"), 0
        ) + 1

    for q, v, p in queue_items:
        esi = q.esi_level
        deadline = get_retriage_deadline(q, v)
        overdue = deadline.get("retriage_overdue", False)
        is_esi1 = esi == 1
        low_conf = v.confidence_score is not None and v.confidence_score < threshold
        drift = v.id in drift_visit_ids

        if is_esi1:
            _add(
                "CRITICAL", "critical",
                f"{p.name} requires immediate care (ESI-1)",
                "ESI-1 critical presentation. Reassess vitals immediately and move to resuscitation.",
                p, v.id, esi, "View Patient",
            )
        if not is_esi1 and overdue:
            _add(
                "REASSESSMENT_OVERDUE", "warning",
                f"{p.name} is overdue for reassessment",
                f"Safe reassessment interval for ESI-{esi} has elapsed. Record re-vitals and re-evaluate acuity.",
                p, v.id, esi, "Re-Vitals",
            )
        if low_conf:
            _add(
                "LOW_CONFIDENCE", "warning",
                f"{p.name} has a low-confidence AI prediction ({(v.confidence_score or 0) * 100:.0f}%)",
                "AI recommendation below the institutional confidence threshold. Clinician review required before finalizing ESI.",
                p, v.id, esi, "Review & Override",
            )
        if drift:
            _add(
                "VITAL_DETERIORATION", "critical",
                f"{p.name} shows vital deterioration",
                "Vital sign drift was detected since triage. Repeat vitals now and consider escalation.",
                p, v.id, esi, "Re-Vitals",
            )

    surge_alert = None
    if settings.SURGE_MODE:
        surge_alert = {
            "id": alert_id + 1,
            "type": "SURGE",
            "severity": "critical",
            "title": "3× Surge Protocol Active",
            "message": (
                "Hospital operating in 3× Surge Mode. Safe reassessment intervals are "
                "reduced and patients auto-escalate when their reduced wait is exceeded."
            ),
            "patient_id": None,
            "visit_id": None,
            "patient_name": None,
            "age": None,
            "esi_level": None,
            "action": "Manage Queue",
            "timestamp": iso_z(now),
        }
        alerts.insert(0, surge_alert)

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_rank.get(a["severity"], 2))

    return {
        "alerts": alerts,
        "counts": counts,
        "total": len(alerts),
        "surge_mode": settings.SURGE_MODE,
        "confidence_threshold": threshold,
        "generated_at": iso_z(now),
    }

@app.post("/triage/revitals/{visit_id}", tags=["Triage"])
def record_revitals(visit_id: int, input: RevitalsInput, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        from fastapi import HTTPException
        raise HTTPException(404, "Visit not found")
    
    baseline = db.query(Vitals).filter(Vitals.visit_id == visit_id).order_by(Vitals.id.asc()).first()
    
    new_vitals = Vitals(
        visit_id=visit_id,
        hr=input.hr, sbp=input.sbp, dbp=input.dbp,
        rr=input.rr, temp=input.temp, spo2=input.spo2
    )
    db.add(new_vitals)
    
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
        queue = db.query(Queue).filter(Queue.visit_id == visit_id).first()
        if queue:
            queue.retriage_needed = True
        
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

@app.get("/audit", tags=["Audit"])
def get_all_audit_logs(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(150).all()
    
    result = []
    for log in logs:
        visit = db.query(Visit).filter(Visit.id == log.visit_id).first() if log.visit_id else None
        patient = db.query(Patient).filter(Patient.id == visit.patient_id).first() if visit else None
        
        display_name = patient.name if patient else (f"Visit #{log.visit_id}" if log.visit_id else "System / Auth Event")
        
        result.append({
            "id": log.id,
            "visit_id": log.visit_id,
            "patient_name": display_name,
            "action": log.action,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "user_id": log.user_id,
            "reason": log.reason,
            "timestamp": (str(log.timestamp) + "Z") if log.timestamp else None
        })
    return {"logs": result}

@app.get("/audit/{visit_id}", tags=["Audit"])
def get_audit_log(visit_id: int, db: Session = Depends(get_db)):
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
                "timestamp": (str(log.timestamp) + "Z") if log.timestamp else None
            }
            for log in logs
        ]
    }

@app.get("/reports/analytics", tags=["Reports"])
def get_reports_analytics(db: Session = Depends(get_db)):
    from .models import SymptomCC, Queue, Visit, Patient, AuditLog
    from sqlalchemy import func, or_
    
    total_patients = db.query(Patient).count()
    all_visits = db.query(Visit).all()
    total_visits = len(all_visits)
    
    active_visits = db.query(Visit).filter(Visit.is_active == True).all()
    active_queue_count = len(active_visits)
    
    esi1_cases = db.query(Visit).filter(
        or_(Visit.esi_final == 1, Visit.esi_predicted == 1)
    ).count()
    
    esi_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    
    active_queue_items = db.query(Queue, Visit).join(
        Visit, Queue.visit_id == Visit.id
    ).filter(Visit.is_active == True).all()
    
    for q, v in active_queue_items:
        lvl = q.esi_level or v.esi_final or v.esi_predicted or 3
        if 1 <= lvl <= 5:
            esi_counts[lvl] += 1
            
    for v in all_visits:
        if not v.is_active:
            lvl = v.esi_final or v.esi_predicted or 3
            if 1 <= lvl <= 5:
                esi_counts[lvl] += 1
                
    total_recorded = sum(esi_counts.values())
    
    esi_dist_data = [
        {"level": 1, "label": "ESI 1", "count": esi_counts[1], "pct": round((esi_counts[1] / total_recorded) * 100, 1) if total_recorded > 0 else 0, "color": "#ef4444"},
        {"level": 2, "label": "ESI 2", "count": esi_counts[2], "pct": round((esi_counts[2] / total_recorded) * 100, 1) if total_recorded > 0 else 0, "color": "#f97316"},
        {"level": 3, "label": "ESI 3", "count": esi_counts[3], "pct": round((esi_counts[3] / total_recorded) * 100, 1) if total_recorded > 0 else 0, "color": "#eab308"},
        {"level": 4, "label": "ESI 4", "count": esi_counts[4], "pct": round((esi_counts[4] / total_recorded) * 100, 1) if total_recorded > 0 else 0, "color": "#22c55e"},
        {"level": 5, "label": "ESI 5", "count": esi_counts[5], "pct": round((esi_counts[5] / total_recorded) * 100, 1) if total_recorded > 0 else 0, "color": "#38bdf8"},
    ]
    
    now = datetime.now()
    if active_queue_items:
        total_wait_sec = sum((now - v.arrival_time).total_seconds() for q, v in active_queue_items if v.arrival_time)
        avg_wait_min = max(0, round(total_wait_sec / (len(active_queue_items) * 60)))
    else:
        avg_wait_min = 0
        
    reassessments = db.query(AuditLog).filter(
        AuditLog.action.in_(["RETRIAGE", "VITAL_DRIFT_ALERT", "AUTO_ESCALATE_SURGE", "OVERRIDE"])
    ).count() + db.query(Queue).filter(Queue.retriage_needed == True).count()
    
    trend_rows = db.query(
        func.date(Visit.arrival_time).label("visit_date"),
        func.avg(Visit.confidence_score).label("avg_confidence"),
        func.count(Visit.id).label("visit_count")
    ).filter(Visit.confidence_score.isnot(None)).group_by(func.date(Visit.arrival_time)).order_by("visit_date").all()
    
    confidence_trend = [
        {
            "date": str(row.visit_date),
            "confidence_pct": round((row.avg_confidence or 0.0) * 100, 1),
            "visit_count": row.visit_count
        }
        for row in trend_rows
    ]
    
    symptoms = db.query(SymptomCC).all()
    categories = {}
    
    for s in symptoms:
        txt = (s.raw_text or "").strip()
        if not txt:
            continue
        txt_lower = txt.lower()
        
        cat = "Other Presentation"
        if any(k in txt_lower for k in ["chest", "angina", "cardiac"]): cat = "Chest Pain"
        elif any(k in txt_lower for k in ["breath", "dyspnea", "sob", "wheez"]): cat = "Shortness of Breath"
        elif any(k in txt_lower for k in ["abdom", "stomach", "belly", "nausea", "vomit"]): cat = "Abdominal Pain"
        elif any(k in txt_lower for k in ["head", "migraine"]): cat = "Headache"
        elif any(k in txt_lower for k in ["fever", "cough", "chill", "cold", "flu"]): cat = "Fever / Infection"
        elif any(k in txt_lower for k in ["fall", "fracture", "trauma", "cut", "wound", "laceration"]): cat = "Trauma / Injury"
        elif any(k in txt_lower for k in ["dizz", "syncope", "faint"]): cat = "Dizziness / Syncope"
        
        categories[cat] = categories.get(cat, 0) + 1
        
    top_complaints = []
    total_complaints = sum(categories.values())
    if total_complaints > 0:
        for name, cnt in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]:
            pct_val = round((cnt / total_complaints) * 100)
            top_complaints.append({
                "name": name,
                "count": cnt,
                "pct": f"{pct_val}%",
                "width": f"{min(100, max(10, pct_val))}%"
            })
            
    high_volume_alerts = db.query(AuditLog).filter(AuditLog.action == "AUTO_ESCALATE_SURGE").count() + (1 if settings.SURGE_MODE else 0)
    model_alerts = db.query(Visit).filter(Visit.is_active == True, Visit.confidence_score < settings.CONFIDENCE_THRESHOLD).count()
    reassessment_alerts = db.query(Queue).filter(Queue.retriage_needed == True).count()
    
    return {
        "total_patients": total_patients,
        "total_visits": total_visits,
        "active_queue_count": active_queue_count,
        "esi1_cases": esi1_cases,
        "avg_wait_minutes": avg_wait_min,
        "reassessments_count": reassessments,
        "esi_distribution": esi_dist_data,
        "total_recorded_distribution": total_recorded,
        "confidence_trend": confidence_trend,
        "top_chief_complaints": top_complaints,
        "alerts_summary": {
            "high_volume_alerts": high_volume_alerts,
            "model_performance_alerts": model_alerts,
            "reassessment_alerts": reassessment_alerts,
        }
    }
