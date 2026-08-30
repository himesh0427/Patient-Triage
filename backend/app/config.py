import os
from dotenv import load_dotenv

# This loads the .env file
load_dotenv()

class Settings:
    # If DATABASE_URL isn't found in .env, default to SQLite.
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./triage.db")
    MODEL_PATH = os.getenv("MODEL_PATH", "../model/esi_triage_best_weight7.txt")
    
    # Surge mode flag
    SURGE_MODE = False
    
    # Hospital type: "URBAN" (5-level ESI) or "RURAL" (3-tier merged)
    HOSPITAL_TYPE = "URBAN"
    
    # Confidence threshold: below this, show yellow warning to nurse
    CONFIDENCE_THRESHOLD = 0.50

    # Vitals input-safety limits (hard bounds, NOT clinical warning ranges).
    # Values outside these bounds are rejected at input time.
    VITAL_LIMITS = {
        "hr":   {"min": 20, "max": 250},
        "sbp":  {"min": 50, "max": 300},
        "dbp":  {"min": 20, "max": 200},
        "rr":   {"min": 4,  "max": 80},
        "temp": {"min": 25, "max": 45},
        "spo2": {"min": 50, "max": 100},
    }

settings = Settings()

# Safe reassessment wait thresholds per ESI level (in seconds).
# The countdown for a patient is measured from their LAST triage/retriage
# timestamp, so it is anchored to real DB time and survives page refreshes.
REASSESSMENT_WAIT = {1: 0, 2: 600, 3: 1800, 4: 3600, 5: 7200}
SURGE_REASSESSMENT_WAIT = {1: 0, 2: 300, 3: 900, 4: 1800, 5: 3600}

# Rural tier mapping: collapses 5-level ESI into 3 tiers
# ESI 1&2 -> Tier 1 (Critical), ESI 3&4 -> Tier 2 (Urgent), ESI 5 -> Tier 3 (Non-Urgent)
RURAL_TIER_MAP = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3}
RURAL_TIER_LABELS = {
    1: "Critical - Immediate / Transfer",
    2: "Urgent - Stabilize",
    3: "Non-Urgent - Standard Care"
}

def load_config_from_db(session=None):
    """
    Hydrate settings and threshold dictionaries from the database on startup.
    Lazy imports avoid circular dependencies.
    """
    try:
        from .database import SessionLocal
        from .models import HospitalConfig

        db = session or SessionLocal()
        cfg = db.query(HospitalConfig).filter(HospitalConfig.id == 1).first()
        if cfg:
            settings.CONFIDENCE_THRESHOLD = cfg.confidence_threshold
            profile_to_type = {
                "urban_trauma": "URBAN",
                "community": "URBAN",
                "rural_ed": "RURAL",
            }
            settings.HOSPITAL_TYPE = profile_to_type.get(cfg.profile, "URBAN")
            
            REASSESSMENT_WAIT[1] = cfg.wait_esi_1
            REASSESSMENT_WAIT[2] = cfg.wait_esi_2
            REASSESSMENT_WAIT[3] = cfg.wait_esi_3
            REASSESSMENT_WAIT[4] = cfg.wait_esi_4
            REASSESSMENT_WAIT[5] = cfg.wait_esi_5

            SURGE_REASSESSMENT_WAIT[1] = cfg.surge_wait_esi_1
            SURGE_REASSESSMENT_WAIT[2] = cfg.surge_wait_esi_2
            SURGE_REASSESSMENT_WAIT[3] = cfg.surge_wait_esi_3
            SURGE_REASSESSMENT_WAIT[4] = cfg.surge_wait_esi_4
            SURGE_REASSESSMENT_WAIT[5] = cfg.surge_wait_esi_5
        if not session:
            db.close()
    except Exception as e:
        print(f"[WARN] Failed to load config from database: {e}")

