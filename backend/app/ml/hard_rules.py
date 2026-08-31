from typing import Optional

def apply_hard_rules(
    age: Optional[float],
    vitals: dict,
    symptom_text: str
):
    text = (symptom_text or "").lower().strip()

    spo2 = vitals.get("spo2")
    hr = vitals.get("hr")
    rr = vitals.get("rr")
    sbp = vitals.get("sbp")
    dbp = vitals.get("dbp")
    temp = vitals.get("temp")

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

    esi_2_keywords = [
        "chest pain",
        "pressure in chest",
        "crushing chest pain",
        "severe shortness of breath",
        "severe respiratory distress",
        "respiratory distress",
        "difficulty breathing",
        "stroke",
        "facial droop",
        "sudden weakness",
        "altered mental status",
        "altered consciousness",
        "decreased consciousness",
        "severe confusion",
        "active seizure",
        "ongoing seizure",
        "heavy bleeding",
        "severe bleeding",
        "uncontrolled bleeding",
        "vomiting blood",
        "blood vomiting",
        "major trauma",
        "amputation",
        "anaphylaxis",
        "severe allergic reaction",
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

    return {
        "esi": None,
        "source": "ml",
        "model_probability": None,
        "reasons": [
            "No ESI-1/ESI-2 hard gate triggered",
            "Proceed to LightGBM prediction"
        ]
    }