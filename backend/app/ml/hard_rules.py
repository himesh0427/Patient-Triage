from typing import Optional


def apply_hard_rules(
    age: Optional[float],
    vitals: dict,
    symptom_text: str
):
    """
    ESI-inspired deterministic safety gate.

    Purpose:
        Catch obvious ESI-1 / ESI-2 presentations BEFORE
        the LightGBM model runs.

    Returns:
        {
            "esi": 1 or 2 or None,
            "source": "hard_gate" or "ml",
            "model_probability": None,
            "reasons": [...]
        }

    Important:
        - Missing vitals remain missing.
        - Missing != normal.
        - This is NOT a replacement for clinician ESI assessment.
        - ESI-3/4/5 are handled by the ML/resource workflow.
    """

    text = (symptom_text or "").lower().strip()

    # =========================================================
    # 0. SAFELY READ VITALS
    # =========================================================

    spo2 = vitals.get("spo2")
    hr = vitals.get("hr")
    rr = vitals.get("rr")
    sbp = vitals.get("sbp")
    dbp = vitals.get("dbp")
    temp = vitals.get("temp")

    # Convert numeric strings safely
    def to_float(value):
        try:
            if value is None or value == "":
                return None
            return float(value)
        except (ValueError, TypeError):
            return None

    spo2 = to_float(spo2)
    hr = to_float(hr)
    rr = to_float(rr)
    sbp = to_float(sbp)
    dbp = to_float(dbp)
    temp = to_float(temp)

    # =========================================================
    # 1. ESI-1: IMMEDIATE LIFE-SAVING SITUATION
    # =========================================================
    #
    # These are obvious situations where the ML model should
    # NOT be allowed to downgrade the patient.
    #
    # ESI-1 examples include cardiac/respiratory arrest and
    # patients requiring immediate lifesaving intervention.
    # =========================================================

    esi_1_keywords = [
        "cardiac arrest",
        "respiratory arrest",
        "cardiopulmonary arrest",
        "not breathing",
        "no pulse",
        "pulseless",
        "unresponsive",
        "unconscious",
    ]

    matched_esi_1 = [
        keyword
        for keyword in esi_1_keywords
        if keyword in text
    ]

    if matched_esi_1:
        return {
            "esi": 1,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                "Immediate life-threatening presentation",
                f"Detected: {', '.join(matched_esi_1)}"
            ]
        }

    # =========================================================
    # 2. ESI-1: EXTREME PHYSIOLOGICAL INSTABILITY
    # =========================================================
    #
    # Conservative safety thresholds.
    #
    # IMPORTANT:
    # These are safety gates for the prototype, not a complete
    # reproduction of every ESI vital-sign rule.
    # =========================================================

    if spo2 is not None and spo2 < 85:
        return {
            "esi": 1,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                f"Critically low SpO2 ({spo2}%)"
            ]
        }

    if sbp is not None and sbp < 70:
        return {
            "esi": 1,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                f"Critically low systolic BP ({sbp} mmHg)"
            ]
        }

    # =========================================================
    # 3. ESI-2: HIGH-RISK / TIME-SENSITIVE PRESENTATION
    # =========================================================
    #
    # ESI-2 is not simply "abnormal vital sign".
    #
    # It includes patients with high-risk presentations,
    # severe distress/pain, or conditions where waiting could
    # cause significant harm.
    # =========================================================

    esi_2_keywords = [
        # Cardiovascular
        "chest pain",
        "pressure in chest",
        "crushing chest pain",

        # Respiratory
        "severe shortness of breath",
        "severe respiratory distress",
        "respiratory distress",
        "difficulty breathing",

        # Neurologic
        "stroke",
        "facial droop",
        "sudden weakness",
        "altered mental status",
        "altered consciousness",
        "decreased consciousness",
        "severe confusion",
        "active seizure",
        "ongoing seizure",

        # Bleeding
        "heavy bleeding",
        "severe bleeding",
        "uncontrolled bleeding",
        "vomiting blood",
        "blood vomiting",

        # Trauma
        "major trauma",
        "amputation",

        # Allergy
        "anaphylaxis",
        "severe allergic reaction",

        # Severe distress
        "severe pain",
        "unbearable pain",
    ]

    matched_esi_2 = [
        keyword
        for keyword in esi_2_keywords
        if keyword in text
    ]

    if matched_esi_2:
        return {
            "esi": 2,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                "High-risk or time-sensitive presentation",
                f"Detected: {', '.join(matched_esi_2)}"
            ]
        }

    # =========================================================
    # 4. ESI-2: CONCERNING PHYSIOLOGY
    # =========================================================
    #
    # Don't make one mild abnormality automatically ESI-2.
    # These are conservative escalation triggers.
    # =========================================================

    if spo2 is not None and spo2 < 92:
        return {
            "esi": 2,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                f"Significantly low SpO2 ({spo2}%)"
            ]
        }

    if sbp is not None and sbp < 90:
        return {
            "esi": 2,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                f"Hypotension (SBP {sbp} mmHg)"
            ]
        }

    if rr is not None and rr > 30:
        return {
            "esi": 2,
            "source": "hard_gate",
            "model_probability": None,
            "reasons": [
                f"Marked tachypnea (RR {rr}/min)"
            ]
        }

    # =========================================================
    # 5. PEDIATRIC SAFETY CHECK
    # =========================================================
    #
    # IMPORTANT:
    # We DO NOT say:
    #
    #     child + fever = ESI-2
    #
    # Pediatric ESI requires age-specific assessment of
    # vital signs and clinical presentation.
    #
    # A fever by itself should NOT automatically force ESI-2.
    #
    # Therefore this prototype only escalates when fever is
    # accompanied by concerning symptoms/physiology.
    # =========================================================

    if age is not None and age < 18:

        pediatric_concerning_terms = [
            "lethargy",
            "very lethargic",
            "poor responsiveness",
            "unresponsive",
            "severe difficulty breathing",
            "respiratory distress",
            "poor perfusion",
            "bluish",
            "blue lips",
            "seizure",
        ]

        matched_pediatric = [
            term
            for term in pediatric_concerning_terms
            if term in text
        ]

        if matched_pediatric:
            return {
                "esi": 2,
                "source": "hard_gate",
                "model_probability": None,
                "reasons": [
                    "Pediatric high-risk presentation",
                    f"Detected: {', '.join(matched_pediatric)}"
                ]
            }

    # =========================================================
    # 6. NO HARD GATE
    # =========================================================
    #
    # Let LightGBM evaluate the patient.
    #
    # The ML model will consider:
    #     age
    #     gender
    #     HR
    #     SBP
    #     DBP
    #     RR
    #     SpO2
    #     temperature
    #     oxygen device
    #     cc_* symptoms
    # =========================================================

    return {
        "esi": None,
        "source": "ml",
        "model_probability": None,
        "reasons": [
            "No ESI-1/ESI-2 hard gate triggered",
            "Proceed to LightGBM prediction"
        ]
    }