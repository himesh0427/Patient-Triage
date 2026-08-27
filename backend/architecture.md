# PatientTriage.ai — Backend Architecture

## System Overview

A FastAPI backend that provides real-time ESI (Emergency Severity Index) predictions
using a LightGBM ordinal regression model, with a safety-first hard-rules gate,
nurse override tracking, dynamic queue management, and surge mode auto-escalation.

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP/JSON
┌───────────────────────▼─────────────────────────────┐
│                  FastAPI Backend                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Triage   │  │ Override │  │   Surge Toggle    │  │
│  │  Router   │  │  Router  │  │   (POST /surge)   │  │
│  └─────┬─────┘  └─────┬────┘  └───────────────────┘  │
│        │               │                              │
│  ┌─────▼───────────────▼──────────────────────────┐  │
│  │              Service Layer                      │  │
│  │  ┌──────────────┐  ┌────────────────────────┐   │  │
│  │  │  ML Pipeline  │  │   Queue Manager        │   │  │
│  │  │  (predict_esi)│  │   (retriage/escalate)  │   │  │
│  │  └──────┬───────┘  └────────────────────────┘   │  │
│  │         │                                        │  │
│  │  ┌──────▼───────┐  ┌────────────────────────┐   │  │
│  │  │  Hard Rules   │  │   LightGBM Booster     │   │  │
│  │  │  (Safety Gate)│  │   (Ordinal Regression) │   │  │
│  │  └──────────────┘  └────────────────────────┘   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │              SQLite Database                    │   │
│  │  patients │ visits │ vitals │ symptom_cc │      │   │
│  │  queue    │ audit_logs                          │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── config.py            # Settings (DB URL, model path, surge flag)
│   ├── database.py          # SQLAlchemy engine, session, Base
│   ├── models.py            # 6 ORM tables (Patient, Visit, Vitals, SymptomCC, Queue, AuditLog)
│   ├── schemas.py           # Pydantic request/response models
│   ├── routers/
│   │   ├── triage.py        # POST /triage/predict, GET /triage/queue, GET /triage/visit/{id},
│   │   │                    # POST /triage/discharge/{id}, POST /triage/surge/simulate
│   │   └── override.py      # PUT /override/visit/{visit_id}
│   ├── ml/
│   │   ├── model_loader.py  # LightGBM loading, YAML symptom mapping, predict_esi()
│   │   └── hard_rules.py    # Deterministic ESI-1/ESI-2 safety gate
│   └── services/
│       └── queue_manager.py # Retriage clock, surge auto-escalation
├── config/
│   └── symptom_mapping.yaml # 356 phrase → 175 cc_* column mappings
├── model/
│   └── esi_triage_best_weight7.txt  # Exported LightGBM Booster (text format)
├── requirements.txt
└── .env
```

---

## API Endpoints

### Triage

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/triage/predict` | Submit a new patient → returns ESI, confidence, reasons, action |
| `GET` | `/triage/queue` | Get the live queue (sorted by ESI asc, arrival asc) |
| `GET` | `/triage/visit/{id}` | Full detail for a specific visit (patient, vitals, symptoms, ML output) |
| `POST` | `/triage/discharge/{id}` | Remove a patient from the active queue |
| `POST` | `/triage/surge/simulate` | Generate fake patients for surge testing |

### Override

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/override/visit/{id}` | Nurse overrides ESI score (logged to audit trail) |

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check + surge mode status |
| `POST` | `/surge/toggle` | Toggle surge mode on/off |

---

## Prediction Pipeline (predict_esi)

```
Patient Input
     │
     ▼
┌─────────────────────┐
│   1. HARD RULES     │  Deterministic safety gate
│   (hard_rules.py)   │  Catches: cardiac arrest, SpO2<85, SBP<70,
│                     │  stroke, anaphylaxis, pediatric red flags
│   ESI 1 or 2?       │
│     YES → return    │  confidence=1.0, source="hard_gate"
│     NO  → continue  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. FEATURE BUILD   │  Map vitals: hr→triage_vital_hr, spo2→triage_vital_o2
│                     │  Encode gender: Male=1, Female=0, Other=2
│                     │  Build 175 cc_* flags from YAML keyword matching
│                     │  Add: n_chief_complaints, has_vitals, n_vitals_recorded
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  3. LIGHTGBM        │  Ordinal regression (objective="regression")
│     PREDICT         │  Returns raw float (e.g., 2.31)
│                     │  Round + clip to [1,5] → ESI prediction
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  4. CONFIDENCE      │  distance = min(|raw - boundary|) for boundaries [1.5, 2.5, 3.5, 4.5]
│     SCORE           │  confidence = min(1.0, distance × 2)
│                     │  → 0.0 = exactly on boundary (uncertain)
│                     │  → 1.0 = center of class (very confident)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  5. EXPLAINABILITY  │  List abnormal vitals (low SpO2, high HR, fever, etc.)
│     (Reasons)       │  List matched chief complaints
│                     │  Include raw model score
└─────────────────────┘
```

---

## Database Schema (SQLite)

### patients
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | VARCHAR(100) | Patient name |
| age | INTEGER | Age in years |
| gender | VARCHAR(10) | "Male", "Female", "Other" |
| has_history | BOOLEAN | Previous visit history flag |
| created_at | DATETIME | Registration timestamp |

### visits
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| patient_id | FK → patients.id | Links to patient |
| arrival_time | DATETIME | When patient arrived |
| is_active | BOOLEAN | Still in queue? |
| esi_predicted | INTEGER | Original ML prediction (1-5) |
| esi_final | INTEGER | Current ESI (may be overridden) |
| confidence_score | FLOAT | 0.0-1.0 confidence |
| raw_ml_score | FLOAT | Raw regression output (e.g., 2.31) |
| top_reasons | TEXT | JSON array of explanation strings |
| is_overridden | BOOLEAN | Was ESI changed by nurse? |
| override_reason | TEXT | Why nurse changed it |
| overridden_by | VARCHAR(100) | Nurse ID |
| override_timestamp | DATETIME | When override happened |

### vitals
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| visit_id | FK → visits.id | Links to visit |
| hr, sbp, dbp, rr, temp, spo2 | FLOAT (nullable) | 6 vital signs |
| recorded_at | DATETIME | When vitals were taken |

### symptom_cc
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| visit_id | FK → visits.id | Links to visit |
| raw_text | TEXT | Original nurse free-text |
| features_json | TEXT | 175 cc_* flags as JSON |

### queue
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| visit_id | FK → visits.id | Links to visit |
| esi_level | INTEGER | Current ESI in queue |
| retriage_needed | BOOLEAN | Yellow flag for nurse |

### audit_logs
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| visit_id | FK → visits.id | Links to visit |
| action | VARCHAR(50) | "OVERRIDE", "AUTO_ESCALATE_SURGE" |
| old_value | VARCHAR(50) | Previous ESI |
| new_value | VARCHAR(50) | New ESI |
| user_id | VARCHAR(100) | "nurse_001" or "SYSTEM" |
| reason | TEXT | Why the change was made |
| timestamp | DATETIME | When it happened |

---

## Queue Manager & Surge Mode

### Normal Mode
- On every `/triage/queue` request, the queue manager checks wait times.
- If a patient exceeds the safe wait threshold for their ESI level, `retriage_needed` is flagged `true`.
- The nurse sees a yellow flag and can manually re-assess.

### Surge Mode (Toggle via `POST /surge/toggle`)
- Thresholds are halved (e.g., ESI-3 normal=30min → surge=15min).
- Patients exceeding their threshold are **automatically escalated** up one ESI level (e.g., ESI-4 → ESI-3).
- Every auto-escalation is logged in `audit_logs` with `action="AUTO_ESCALATE_SURGE"` and `user_id="SYSTEM"`.

### Wait Thresholds

| ESI Level | Normal (seconds) | Surge (seconds) |
|-----------|-----------------|-----------------|
| 1 | 0 (immediate) | 0 (immediate) |
| 2 | 600 (10 min) | 300 (5 min) |
| 3 | 1800 (30 min) | 900 (15 min) |
| 4 | 3600 (60 min) | 1800 (30 min) |
| 5 | 7200 (120 min) | 3600 (60 min) |

---

## How to Run

```bash
cd backend/
# Activate your virtual environment
source ../myenv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000

# Open Swagger UI
open http://localhost:8000/docs
```

---

## Example Request & Response

### POST /triage/predict
```json
// REQUEST
{
  "name": "Jane Smith",
  "age": 45,
  "gender": "Female",
  "has_history": false,
  "symptom_text": "headache and nausea",
  "vitals": {
    "hr": 82, "sbp": 125, "dbp": 80,
    "rr": 16, "spo2": 98, "temp": 37.0
  }
}

// RESPONSE
{
  "visit_id": 2,
  "esi": 4,
  "confidence": 0.488,
  "raw_score": 3.744,
  "reasons": [
    "Chief complaints: headache, nausea",
    "Raw model score: 3.74"
  ],
  "action": "Semi-Urgent - Standard Queue"
}
```

### PUT /override/visit/2
```json
// REQUEST
{
  "new_esi": 3,
  "reason": "Patient appears more distressed",
  "nurse_id": "nurse_001"
}

// RESPONSE
{
  "message": "ESI updated from 4 to 3"
}
```
