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

settings = Settings()

# Rural tier mapping: collapses 5-level ESI into 3 tiers
# ESI 1&2 -> Tier 1 (Critical), ESI 3&4 -> Tier 2 (Urgent), ESI 5 -> Tier 3 (Non-Urgent)
RURAL_TIER_MAP = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3}
RURAL_TIER_LABELS = {
    1: "Critical - Immediate / Transfer",
    2: "Urgent - Stabilize",
    3: "Non-Urgent - Standard Care"
}
