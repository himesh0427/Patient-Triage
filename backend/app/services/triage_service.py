"""
Triage service — bridges the LightGBM ML pipeline to the rich triage
format the frontend expects.

Wraps predict_esi() + apply_hard_rules() and produces structured factors,
completeness scores, and confidence labels.
"""

import json
from datetime import datetime
from ..ml.hard_rules import apply_hard_rules
from ..ml.model_loader import predict_esi, text_to_cc_vector

MODEL_VERSION = "PT-Triage v0.9.2-hackathon"

# Age-stratified thresholds (matching frontend's esi.js AGE_GROUPS)
AGE_THRESHOLDS = {
    "pediatric": {"hr": (80, 140), "rr": (20, 32), "spo2_min": 95, "fever": 38.5},
    "adult":     {"hr": (60, 100), "rr": (12, 20), "spo2_min": 94, "fever": 38.0},
    "geriatric": {"hr": (60, 100), "rr": (12, 20), "spo2_min": 92, "fever": 37.8},
}


def age_group_of(age: int) -> str:
    """Matches frontend ageGroupOf()."""
    if age < 12:
        return "pediatric"
    if age >= 65:
        return "geriatric"
    return "adult"


def _generate_factors(vitals: dict, age_group: str, cc_vector: dict, pain_score, observed_symptoms: list) -> list:
    """
    Generate structured factor objects from patient data.
    Matches the frontend's {label, weight, type} format.
    """
    factors = []
    th = AGE_THRESHOLDS.get(age_group, AGE_THRESHOLDS["adult"])
    points = 0

    # ── Vitals scoring (age-stratified) ──

    hr = vitals.get("hr")
    if hr is not None:
        lo, hi = th["hr"]
        if hr < lo or hr > hi:
            mid = (lo + hi) / 2
            half = (hi - lo) / 2 or 1
            dev = abs(hr - mid) / half
            w = 2 if dev > 1.6 else 1
            points += w
            factors.append({
                "label": f"Heart rate outside age-adjusted normal range ({hr} bpm; expected {lo}–{hi} bpm)",
                "weight": w,
                "type": "up" if w >= 2 else "warn",
            })

    rr = vitals.get("rr")
    if rr is not None:
        lo, hi = th["rr"]
        if rr < lo or rr > hi:
            mid = (lo + hi) / 2
            half = (hi - lo) / 2 or 1
            dev = abs(rr - mid) / half
            w = 2 if dev > 1.6 else 1
            points += w
            factors.append({
                "label": f"Respiratory rate outside age-adjusted normal range ({rr}/min; expected {lo}–{hi}/min)",
                "weight": w,
                "type": "up" if w >= 2 else "warn",
            })

    spo2 = vitals.get("spo2")
    if spo2 is not None and spo2 < th["spo2_min"]:
        dev = (th["spo2_min"] - spo2) / th["spo2_min"]
        w = 2 if dev > 0.15 else 1
        points += w
        factors.append({
            "label": f"SpO₂ below age-adjusted threshold ({spo2}%; expected ≥ {th['spo2_min']}%)",
            "weight": w,
            "type": "up" if w >= 2 else "warn",
        })

    temp = vitals.get("temp")
    if temp is not None and temp >= th["fever"]:
        w = 2 if temp >= th["fever"] + 1.5 else 1
        points += w
        factors.append({
            "label": f"Fever — {temp}°C (age-adjusted threshold {th['fever']}°C)",
            "weight": w,
            "type": "up" if w >= 2 else "warn",
        })

    gcs = vitals.get("gcs")
    if gcs is not None and 9 <= gcs < 15:
        points += 1
        factors.append({
            "label": f"Reduced consciousness — GCS {gcs}/15",
            "weight": 1,
            "type": "warn",
        })

    sbp = vitals.get("sbp")
    if sbp is not None and sbp < 100:
        w = 2 if sbp < 90 else 1
        points += w
        factors.append({
            "label": f"Low blood pressure ({sbp} mmHg)",
            "weight": w,
            "type": "up" if w >= 2 else "warn",
        })

    # ── Pain ──
    if pain_score is not None and pain_score >= 4:
        points += 1
        factors.append({
            "label": f"Severe self-reported pain — {pain_score}/5",
            "weight": 1,
            "type": "warn",
        })

    # ── Observed symptoms ──
    OBSERVED_LABELS = {
        "altered": "Altered mental status (observed)",
        "respDistress": "Severe respiratory distress (observed)",
        "petechiae": "Petechial rash (observed)",
        "lethargy": "Lethargy / poor responsiveness (observed)",
        "chestPainDiaphoresis": "Chest pain with diaphoresis (observed)",
        "bleeding": "Active uncontrolled bleeding (observed)",
        "nausea": "Nausea (observed)",
        "limp": "Limping / guarding an injury (observed)",
    }
    OBSERVED_WEIGHTS = {
        "altered": 2, "respDistress": 2, "petechiae": 2,
        "lethargy": 1, "nausea": 0, "limp": 0,
    }

    for s in observed_symptoms:
        if s in ("bleeding", "chestPainDiaphoresis"):
            continue  # handled by hard gates
        w = OBSERVED_WEIGHTS.get(s, 0)
        label = OBSERVED_LABELS.get(s, s)
        if w > 0:
            points += w
            factors.append({"label": label, "weight": w, "type": "up" if w >= 2 else "warn"})
        else:
            factors.append({"label": label, "weight": 0, "type": "info"})

    # ── Chief complaints from ML ──
    active_ccs = [col.replace("cc_", "").replace("_", " ") for col, val in cc_vector.items() if val == 1]
    if active_ccs:
        factors.append({
            "label": f"Chief complaints: {', '.join(active_ccs[:5])}",
            "weight": 1,
            "type": "warn",
        })

    return factors, points


def _compute_completeness(vitals: dict, pain_score) -> int:
    """Calculate data completeness percentage (0-100)."""
    expected_fields = ["hr", "sbp", "rr", "spo2", "temp", "gcs"]
    present = sum(1 for f in expected_fields if vitals.get(f) is not None)
    total = len(expected_fields) + 2  # +2 for pain_score and history
    numerator = present + (1 if pain_score is not None else 0) + 1  # +1 for always-present complaint
    return round(numerator / total * 100)


def _compute_confidence(completeness: int, ml_confidence: float, has_history: bool, missing_count: int) -> tuple:
    """
    Compute confidence label and score.

    Combines data completeness with ML model certainty.
    Matches the frontend's confidence computation pattern.
    """
    # Start from completeness
    conf_score = completeness
    # Penalize missing history
    if not has_history:
        conf_score -= 8
    # Penalize missing vitals
    conf_score -= missing_count * 3
    # Factor in ML model certainty (0-1 float → 0-40 penalty for uncertainty)
    ml_penalty = max(0, int((1.0 - ml_confidence) * 40))
    conf_score -= ml_penalty
    # Clamp
    conf_score = max(8, min(97, round(conf_score)))

    if conf_score >= 75:
        label = "High"
    elif conf_score >= 50:
        label = "Medium"
    else:
        label = "Low"

    return label, conf_score


def compute_full_triage(
    age: int,
    sex: str,
    complaint: str,
    vitals: dict,
    pain_score=None,
    observed_symptoms: list = None,
    has_history: bool = False,
    comorbidities: list = None,
    complaint_tag: str = None,
    mode: str = "normal",
) -> dict:
    """
    Run the full triage pipeline and return a result dict matching the
    frontend's expected triage format.

    Returns dict with keys: severity, confidence, confidence_score,
    completeness, factors, gate, escalated, points, model_version, computed_at
    """
    if observed_symptoms is None:
        observed_symptoms = []
    if comorbidities is None:
        comorbidities = []

    age_group = age_group_of(age)

    # ── Step 1: Map complaint text to cc_vector ──
    cc_vector = text_to_cc_vector(complaint)

    # ── Step 2: Gender encoding ──
    gender_map = {"M": 1, "Male": 1, "F": 0, "Female": 0}
    gender_encoded = gender_map.get(sex, 2)

    # ── Step 3: Prepare vitals dict for ML ──
    ml_vitals = {
        "hr": vitals.get("hr"),
        "sbp": vitals.get("sbp"),
        "dbp": vitals.get("dbp"),
        "rr": vitals.get("rr"),
        "spo2": vitals.get("spo2"),
        "temp": vitals.get("temp"),
    }

    # ── Step 4: Run the ML pipeline (includes hard rules) ──
    esi_pred, ml_confidence, raw_score, ml_reasons = predict_esi(
        vitals=ml_vitals,
        age=age,
        gender=gender_encoded,
        cc_vector=cc_vector,
        raw_text=complaint,
    )

    # ── Step 5: Check if hard rules triggered ──
    hard_result = apply_hard_rules(
        age=float(age),
        vitals=ml_vitals,
        symptom_text=complaint,
    )

    gate_text = None
    if hard_result["esi"] is not None:
        gate_text = hard_result["reasons"][0] if hard_result["reasons"] else "Hard safety gate triggered"

    # ── Step 6: Generate structured factors ──
    factors, points = _generate_factors(vitals, age_group, cc_vector, pain_score, observed_symptoms)

    # Add history info
    if has_history and comorbidities:
        COMORBIDITY_LABELS = {
            "diabetes": "Diabetes", "htn": "Hypertension", "copd": "COPD",
            "anticoag": "Anticoagulant therapy", "cardiac": "Cardiac history",
            "dementia": "Dementia / baseline confusion",
        }
        labels = ", ".join(COMORBIDITY_LABELS.get(c, c) for c in comorbidities)
        factors.append({"label": f"Relevant history on file: {labels}", "weight": 0, "type": "info"})
    elif not has_history:
        factors.append({"label": "No prior medical record on file — first presentation", "weight": 0, "type": "info"})

    # Add raw ML score as informational factor
    factors.append({"label": f"Raw ML score: {raw_score:.2f}", "weight": 0, "type": "info"})

    # ── Step 7: Compute completeness and confidence ──
    expected_fields = ["hr", "sbp", "rr", "spo2", "temp", "gcs"]
    missing_count = sum(1 for f in expected_fields if vitals.get(f) is None)
    completeness = _compute_completeness(vitals, pain_score)
    confidence_label, confidence_score = _compute_confidence(
        completeness, ml_confidence, has_history, missing_count
    )

    # ── Step 8: Safety-first escalation under uncertainty ──
    severity = esi_pred
    escalated = False
    if gate_text is None:  # Only apply safety escalation if no hard gate
        if confidence_label == "Low" and severity > 1:
            severity -= 1
            escalated = True
        elif mode == "surge" and confidence_label == "Medium" and severity > 2:
            severity -= 1
            escalated = True

    return {
        "severity": severity,
        "confidence": confidence_label,
        "confidence_score": confidence_score,
        "completeness": completeness,
        "factors": factors,
        "gate": gate_text,
        "escalated": escalated,
        "points": points,
        "raw_score": raw_score,
        "model_version": MODEL_VERSION,
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }
