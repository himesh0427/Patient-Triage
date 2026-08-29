"""
Hospital Configuration Router
------------------------------
GET  /hospital-config              → Return current configuration
PUT  /hospital-config              → Save full configuration (syncs to triage engine)
POST /hospital-config/apply-profile → Apply a preset profile with sensible defaults
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from ..database import get_db
from ..models import HospitalConfig, AuditLog
from ..schemas import HospitalConfigInput
from .. import config as config_module

router = APIRouter(prefix="/hospital-config", tags=["Hospital Config"])

# ─── PRESET PROFILES ────────────────────────────────────────────────
PROFILES = {
    "urban_trauma": {
        "hospital_name": "Urban Trauma Center",
        "wait_esi_1": 0, "wait_esi_2": 300, "wait_esi_3": 900, "wait_esi_4": 1800, "wait_esi_5": 3600,
        "surge_wait_esi_1": 0, "surge_wait_esi_2": 180, "surge_wait_esi_3": 480, "surge_wait_esi_4": 900, "surge_wait_esi_5": 1800,
        "confidence_threshold": 0.40,
        "department_capacity": 80, "attending_physicians": 12, "nurses_on_duty": 24,
        "specialties": json.dumps([
            "Emergency Medicine", "Trauma Surgery", "Cardiology", "Neurology",
            "Orthopedics", "Radiology", "Internal Medicine", "Pediatrics",
            "Anesthesiology", "Critical Care"
        ]),
        "alert_reassessment_enabled": True, "alert_low_confidence_enabled": True,
        "alert_queue_wait_threshold": 15,
        "ehr_system": "epic", "ehr_endpoint": "",
    },
    "community": {
        "hospital_name": "Community Hospital",
        "wait_esi_1": 0, "wait_esi_2": 600, "wait_esi_3": 1800, "wait_esi_4": 3600, "wait_esi_5": 7200,
        "surge_wait_esi_1": 0, "surge_wait_esi_2": 300, "surge_wait_esi_3": 900, "surge_wait_esi_4": 1800, "surge_wait_esi_5": 3600,
        "confidence_threshold": 0.50,
        "department_capacity": 40, "attending_physicians": 6, "nurses_on_duty": 12,
        "specialties": json.dumps([
            "Emergency Medicine", "Internal Medicine", "Cardiology",
            "Orthopedics", "Neurology", "Pediatrics"
        ]),
        "alert_reassessment_enabled": True, "alert_low_confidence_enabled": True,
        "alert_queue_wait_threshold": 30,
        "ehr_system": "cerner", "ehr_endpoint": "",
    },
    "rural_ed": {
        "hospital_name": "Rural Emergency Department",
        "wait_esi_1": 0, "wait_esi_2": 900, "wait_esi_3": 2400, "wait_esi_4": 5400, "wait_esi_5": 10800,
        "surge_wait_esi_1": 0, "surge_wait_esi_2": 480, "surge_wait_esi_3": 1200, "surge_wait_esi_4": 2700, "surge_wait_esi_5": 5400,
        "confidence_threshold": 0.60,
        "department_capacity": 12, "attending_physicians": 2, "nurses_on_duty": 4,
        "specialties": json.dumps([
            "Emergency Medicine", "Internal Medicine", "General Surgery"
        ]),
        "alert_reassessment_enabled": True, "alert_low_confidence_enabled": True,
        "alert_queue_wait_threshold": 45,
        "ehr_system": "none", "ehr_endpoint": "",
    },
}


def _get_or_create_config(db: Session) -> HospitalConfig:
    """Fetch the singleton config row (id=1), creating it with defaults if missing."""
    cfg = db.query(HospitalConfig).filter(HospitalConfig.id == 1).first()
    if not cfg:
        cfg = HospitalConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _sync_to_runtime(cfg: HospitalConfig):
    """Push DB values into the in-memory settings and threshold dicts
    so the triage engine, queue manager, and alerts use them immediately."""
    config_module.settings.CONFIDENCE_THRESHOLD = cfg.confidence_threshold

    # Map profile to HOSPITAL_TYPE for existing consumers
    profile_to_type = {
        "urban_trauma": "URBAN",
        "community": "URBAN",
        "rural_ed": "RURAL",
    }
    config_module.settings.HOSPITAL_TYPE = profile_to_type.get(cfg.profile, "URBAN")

    # Update reassessment wait dicts (consumed by queue_manager.get_thresholds)
    config_module.REASSESSMENT_WAIT[1] = cfg.wait_esi_1
    config_module.REASSESSMENT_WAIT[2] = cfg.wait_esi_2
    config_module.REASSESSMENT_WAIT[3] = cfg.wait_esi_3
    config_module.REASSESSMENT_WAIT[4] = cfg.wait_esi_4
    config_module.REASSESSMENT_WAIT[5] = cfg.wait_esi_5

    config_module.SURGE_REASSESSMENT_WAIT[1] = cfg.surge_wait_esi_1
    config_module.SURGE_REASSESSMENT_WAIT[2] = cfg.surge_wait_esi_2
    config_module.SURGE_REASSESSMENT_WAIT[3] = cfg.surge_wait_esi_3
    config_module.SURGE_REASSESSMENT_WAIT[4] = cfg.surge_wait_esi_4
    config_module.SURGE_REASSESSMENT_WAIT[5] = cfg.surge_wait_esi_5


def _config_to_dict(cfg: HospitalConfig) -> dict:
    """Serialize the config row to a frontend-friendly dict."""
    try:
        specs = json.loads(cfg.specialties) if cfg.specialties else []
    except (json.JSONDecodeError, TypeError):
        specs = []

    return {
        "profile": cfg.profile,
        "hospital_name": cfg.hospital_name,
        "wait_thresholds": {
            "esi_1": cfg.wait_esi_1, "esi_2": cfg.wait_esi_2, "esi_3": cfg.wait_esi_3,
            "esi_4": cfg.wait_esi_4, "esi_5": cfg.wait_esi_5,
        },
        "surge_wait_thresholds": {
            "esi_1": cfg.surge_wait_esi_1, "esi_2": cfg.surge_wait_esi_2, "esi_3": cfg.surge_wait_esi_3,
            "esi_4": cfg.surge_wait_esi_4, "esi_5": cfg.surge_wait_esi_5,
        },
        "confidence_threshold": cfg.confidence_threshold,
        "department_capacity": cfg.department_capacity,
        "attending_physicians": cfg.attending_physicians,
        "nurses_on_duty": cfg.nurses_on_duty,
        "specialties": specs,
        "alert_reassessment_enabled": cfg.alert_reassessment_enabled,
        "alert_low_confidence_enabled": cfg.alert_low_confidence_enabled,
        "alert_queue_wait_threshold": cfg.alert_queue_wait_threshold,
        "ehr_system": cfg.ehr_system,
        "ehr_endpoint": cfg.ehr_endpoint,
        "updated_at": str(cfg.updated_at) if cfg.updated_at else None,
        "updated_by": cfg.updated_by,
    }


# ─── ENDPOINTS ──────────────────────────────────────────────────────

@router.get("/")
def get_hospital_config(db: Session = Depends(get_db)):
    """Return the current hospital configuration."""
    cfg = _get_or_create_config(db)
    return _config_to_dict(cfg)


@router.put("/")
def save_hospital_config(input: HospitalConfigInput, db: Session = Depends(get_db)):
    """Save the full hospital configuration. Immediately syncs to the triage engine."""
    cfg = _get_or_create_config(db)

    old_profile = cfg.profile

    # Apply all fields
    cfg.profile = input.profile
    cfg.hospital_name = input.hospital_name
    cfg.wait_esi_1 = max(0, input.wait_esi_1)
    cfg.wait_esi_2 = max(0, input.wait_esi_2)
    cfg.wait_esi_3 = max(0, input.wait_esi_3)
    cfg.wait_esi_4 = max(0, input.wait_esi_4)
    cfg.wait_esi_5 = max(0, input.wait_esi_5)
    cfg.surge_wait_esi_1 = max(0, input.surge_wait_esi_1)
    cfg.surge_wait_esi_2 = max(0, input.surge_wait_esi_2)
    cfg.surge_wait_esi_3 = max(0, input.surge_wait_esi_3)
    cfg.surge_wait_esi_4 = max(0, input.surge_wait_esi_4)
    cfg.surge_wait_esi_5 = max(0, input.surge_wait_esi_5)
    cfg.confidence_threshold = max(0.0, min(1.0, input.confidence_threshold))
    cfg.department_capacity = max(1, input.department_capacity)
    cfg.attending_physicians = max(0, input.attending_physicians)
    cfg.nurses_on_duty = max(0, input.nurses_on_duty)
    cfg.specialties = json.dumps(input.specialties)
    cfg.alert_reassessment_enabled = input.alert_reassessment_enabled
    cfg.alert_low_confidence_enabled = input.alert_low_confidence_enabled
    cfg.alert_queue_wait_threshold = max(1, input.alert_queue_wait_threshold)
    cfg.ehr_system = input.ehr_system
    cfg.ehr_endpoint = input.ehr_endpoint
    cfg.updated_by = input.updated_by

    db.commit()
    db.refresh(cfg)

    # Sync to runtime
    _sync_to_runtime(cfg)

    # Audit log
    log = AuditLog(
        visit_id=None,
        action="CONFIG_UPDATE",
        old_value=old_profile,
        new_value=cfg.profile,
        user_id=cfg.updated_by,
        reason=f"Hospital configuration saved: profile={cfg.profile}, threshold={cfg.confidence_threshold}"
    )
    db.add(log)
    db.commit()

    return {
        "message": "Hospital configuration saved and applied to triage engine.",
        "config": _config_to_dict(cfg),
    }


@router.post("/apply-profile")
def apply_profile(profile: str = "community", db: Session = Depends(get_db)):
    """Apply a preset hospital profile with sensible defaults."""
    if profile not in PROFILES:
        raise HTTPException(400, f"Unknown profile '{profile}'. Must be one of: {list(PROFILES.keys())}")

    preset = PROFILES[profile]
    cfg = _get_or_create_config(db)
    old_profile = cfg.profile

    cfg.profile = profile
    for key, value in preset.items():
        setattr(cfg, key, value)
    cfg.updated_by = "SYSTEM_PROFILE"

    db.commit()
    db.refresh(cfg)

    # Sync to runtime
    _sync_to_runtime(cfg)

    # Audit log
    log = AuditLog(
        visit_id=None,
        action="CONFIG_PROFILE_APPLY",
        old_value=old_profile,
        new_value=profile,
        user_id="SYSTEM",
        reason=f"Applied preset profile: {profile}"
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Profile '{profile}' applied successfully.",
        "config": _config_to_dict(cfg),
    }
