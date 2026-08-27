import lightgbm as lgb
import numpy as np
import pandas as pd
import yaml
from pathlib import Path
from .hard_rules import apply_hard_rules

# =========================================================
# GLOBAL VARIABLES (Loaded once at startup)
# =========================================================
_model = None
_cc_columns = []          # List of all cc_* column names (e.g., ['cc_abdominalpain', ...])
_keyword_to_cc = {}       # Mapping: "chest pain" -> "cc_chestpain"

# Vitals mapping: schema field name -> model feature name
VITALS_MAP = {
    "hr": "triage_vital_hr",
    "sbp": "triage_vital_sbp",
    "dbp": "triage_vital_dbp",
    "rr": "triage_vital_rr",
    "spo2": "triage_vital_o2",
    "temp": "triage_vital_temp",
}

# =========================================================
# 1. LOAD THE YAML CONFIGURATION (Runs when module imports)
# =========================================================
def load_mapping_config():
    global _cc_columns, _keyword_to_cc
    
    config_path = Path(__file__).parent.parent.parent / "config" / "symptom_mapping.yaml"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Mapping config not found at {config_path}")
    
    with open(config_path, 'r') as file:
        config = yaml.safe_load(file)
    
    _keyword_to_cc = {}
    cc_set = set()
    
    for item in config.get('mapping', []):
        phrase = item['phrase'].lower()
        cc_col = item['cc_column']
        _keyword_to_cc[phrase] = cc_col
        cc_set.add(cc_col)
    
    _cc_columns = sorted(list(cc_set))
    print(f"[INFO] Loaded {len(_keyword_to_cc)} symptom mappings.")
    print(f"[INFO] Found {len(_cc_columns)} unique cc_* columns.")
    
    return _keyword_to_cc, _cc_columns

# Load the YAML file immediately when this module is imported
load_mapping_config()

# =========================================================
# 2. LOAD THE LIGHTGBM MODEL
# =========================================================
def load_model():
    global _model
    if _model is None:
        model_path = Path(__file__).parent.parent.parent / "model" / "esi_triage_best_weight7.txt"
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found at {model_path}")
        
        _model = lgb.Booster(model_file=str(model_path))
        print(f"[INFO] Model loaded from {model_path}")
    
    return _model

# =========================================================
# 3. TEXT -> CC VECTOR (FAST KEYWORD MATCHING)
# =========================================================
def text_to_cc_vector(text: str):
    """
    Converts nurse free-text into binary flags using the YAML mapping.
    Uses EXACT keyword matching (runs in < 1ms).
    """
    vector = {col: 0 for col in _cc_columns}
    
    if not text or text.strip() == "":
        return vector
    
    text_lower = text.lower()
    
    for keyword, col in _keyword_to_cc.items():
        if keyword in text_lower:
            if col in vector:
                vector[col] = 1
    
    return vector

# =========================================================
# 4. MAIN PREDICTION FUNCTION
# =========================================================
def predict_esi(vitals: dict, age: int, gender: int, cc_vector: dict, raw_text: str):
    """
    Full pipeline: Hard Rules -> Feature Engineering -> ML Predict -> Confidence
    
    Args:
        vitals: dict with keys hr, sbp, dbp, rr, spo2, temp (values can be None)
        age: patient age as integer
        gender: 0=Female, 1=Male, 2=Other
        cc_vector: dict of cc_* column names -> 0/1 flags
        raw_text: original symptom text from nurse
    
    Returns: (esi_pred, confidence, raw_score, reasons_list)
    """
    
    # ----- STEP A: HARD RULES (Safety Gate) -----
    hard_result = apply_hard_rules(
        age=float(age),
        vitals=vitals,
        symptom_text=raw_text
    )
    
    if hard_result["esi"] is not None:
        return (
            hard_result["esi"],
            1.0,
            float(hard_result["esi"]),
            hard_result["reasons"]
        )

    # ----- STEP B: FEATURE ENGINEERING -----
    features = {}
    
    # 1. Age
    features['age'] = age
    
    # 2. Gender (model was trained with: Male=1, Female=0, Other=2)
    features['gender'] = gender
    
    # 3. Vitals (map schema names -> model feature names)
    for schema_key, model_key in VITALS_MAP.items():
        val = vitals.get(schema_key)
        features[model_key] = val if val is not None else np.nan
    
    # 4. Chief complaints (175 cc_* flags, sorted for consistency)
    for col in _cc_columns:
        features[col] = cc_vector.get(col, 0)
    
    # 5. Derived features (must match training pipeline)
    features['n_chief_complaints'] = sum(cc_vector.values())
    vital_values = [vitals.get(k) for k in VITALS_MAP.keys()]
    features['n_vitals_recorded'] = sum(1 for v in vital_values if v is not None)
    features['has_vitals'] = 1 if features['n_vitals_recorded'] > 0 else 0

    # ----- STEP C: PREDICT USING LIGHTGBM -----
    model = load_model()
    df = pd.DataFrame([features])
    
    raw_score = model.predict(df)[0]
    esi_pred = int(np.clip(np.round(raw_score), 1, 5))

    # ----- STEP D: CALCULATE CONFIDENCE -----
    boundaries = [1.5, 2.5, 3.5, 4.5]
    min_dist = min(abs(raw_score - b) for b in boundaries)
    confidence = round(min(1.0, min_dist * 2), 3)

    # ----- STEP E: EXPLAINABILITY (Reasons) -----
    reasons = []
    
    if vitals.get("spo2") is not None and vitals["spo2"] < 95:
        reasons.append(f"Low oxygen saturation ({vitals['spo2']}%)")
    if vitals.get("hr") is not None and vitals["hr"] > 100:
        reasons.append(f"Elevated heart rate ({vitals['hr']} bpm)")
    if vitals.get("hr") is not None and vitals["hr"] < 50:
        reasons.append(f"Low heart rate ({vitals['hr']} bpm)")
    if vitals.get("sbp") is not None and vitals["sbp"] < 100:
        reasons.append(f"Low blood pressure ({vitals['sbp']} mmHg)")
    if vitals.get("temp") is not None and vitals["temp"] > 38.5:
        reasons.append(f"Fever detected ({vitals['temp']}°C)")
    if vitals.get("rr") is not None and vitals["rr"] > 22:
        reasons.append(f"Elevated respiratory rate ({vitals['rr']}/min)")
    
    active_ccs = [col.replace("cc_", "").replace("_", " ") for col, val in cc_vector.items() if val == 1]
    if active_ccs:
        reasons.append(f"Chief complaints: {', '.join(active_ccs[:5])}")
    
    if not reasons:
        reasons.append("ML prediction based on vitals and symptoms")
    
    reasons.append(f"Raw model score: {raw_score:.2f}")

    return esi_pred, confidence, raw_score, reasons
