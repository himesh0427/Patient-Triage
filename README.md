# 🏥 Patient Triage System

**Intelligent, Explainable & Safe Emergency Department Clinical Decision Support System**  
*Accenture Innovation Challenge 2026 — Round 2: Prototype Development (Problem Track 2: PatientTriage.ai)*

---

## 📌 Problem Statement

Emergency Departments worldwide process **100 to 500+ patient arrivals daily** under severe time pressure, fluctuating volume, and incomplete patient histories. Clinical triage—deciding who receives immediate resuscitation versus who waits—carries severe **asymmetric risk**:

* **Under-Triage (Type II Error)**: Misses a deteriorating patient (e.g., mistaking a silent heart attack for indigestion), leading to waiting room collapse or death.
* **Over-Triage (Type I Error)**: Over-prioritizes a lower-risk patient, causing minor bed delays but preserving human life.
* **Population Heterogeneity**: Physiological norms vary wildly—a 38.5°C fever in a 3-month-old infant or 80-year-old indicates critical sepsis risk, whereas it may be benign in a young adult.
* **Data Incompleteness**: ~50% of arriving emergency patients are first-time arrivals with zero prior health records.

Existing black-box AI tools either fail under missing data, introduce unsafe delay via slow models, or lack clinician accountability.

---

## 💡 Solution

**PatientTriage.ai** is a human-in-the-loop clinical decision support platform designed to **augment—never replace—clinical judgment**. Built on the Emergency Severity Index (ESI) standard, it safeguards patients through a multi-stage hybrid engine:

* **Safety-First Hard Gate**: Instantly routes life-threatening conditions (SpO₂ < 85%, SBP < 70 mmHg, pediatric distress) to ESI 1 or ESI 2 before machine learning even runs.
* **Sub-Millisecond Symptom Vectorizer**: Maps unstructured free-text chief complaints to standard clinical flags in under 1 millisecond.
* **Safety-Biased Ordinal ML Engine**: Evaluates complex presentations using LightGBM ordinal regression, mathematically penalized to favor over-triage over under-triage.
* **Mathematical Uncertainty Communication**: Computes decision-boundary confidence scores, triggering prominent amber warnings when presentations are borderline.
* **Dynamic Waiting Room Safeguard**: Continuously tracks wait times and detects physiological vital sign deterioration in real time.
* **Surge Mode Auto-Escalation**: Automatically halves safe wait thresholds and escalates long-waiting patients during mass-casualty or high-volume surges.

---

## 🏗️ System Architecture

PatientTriage.ai is architected with a decoupled, high-performance modular design:

* **Clinical Frontend**: React 18 single-page application built with Vite and Tailwind CSS. Provides an intuitive 5-step intake wizard, real-time priority queue dashboard, surge simulator, and clinician override modal.
* **FastAPI Gateway**: Python backend service handling intake routing, continuous wait-clock monitoring, serial vitals drift detection, and immutable audit logging.
* **Hybrid Clinical Decision Engine**: Multi-tiered decision pipeline combining deterministic safety rules, instant YAML keyword vectorization, LightGBM ordinal regression, confidence calibration, and automated rationale generation.
* **Data & Audit Layer**: Relational database storing patient profiles, active visits, vital sign trends, chief complaints, real-time priority queues, and tamper-evident clinician override audit logs.

---

## 🔄 Workflow

```
                     PATIENT DATA INGESTION
                                │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       [CRITICAL BYPASS]               [STANDARD INTAKE]
               │                               │
        Immediate ESI-1                        ▼
                                     [STAGE 1: HARD RULES]
                                     (Deterministic Safety)
                                               │
                                ┌──────────────┴──────────────┐
                                ▼                             ▼
                        Triggered (ESI 1/2)             Passed (Safe)
                                │                             │
                           Immediate Bed                      ▼
                                                    [STAGE 2: NLP PARSER]
                                                    (356 YAML Terms -> 175 CC)
                                                               │
                                                               ▼
                                                    [STAGE 3: LIGHTGBM]
                                                    (Ordinal Regression)
                                                               │
                                                               ▼
                                                    [STAGE 4: UNCERTAINTY]
                                                    (Boundary Distance)
                                                               │
                                                               ▼
                                                    [STAGE 5: EXPLAINABILITY]
                                                    (Clinical Rationale)
```

### Stage 0: Emergency Critical Bypass Gate
For patients presenting with catastrophic life threats (e.g., cardiopulmonary arrest, severe hemorrhage), entering vitals or typing sentences causes unneeded delay. Instantly assigns **ESI-1 (Immediate Resuscitation)** with 100% confidence, logs a critical bypass audit event, and routes directly to resuscitation beds.

### Stage 1: Deterministic Safety Hard Gate & Pediatric Rules
The safety gate executes before machine learning to eliminate severe under-triage:
* **Physiological Critical Thresholds (ESI-1)**: SpO₂ < 85%, SBP < 70 mmHg, or critical keywords (cardiac arrest, unconscious, not breathing).
* **High-Risk Time-Sensitive Triggers (ESI-2)**: SpO₂ < 92%, SBP < 90 mmHg, RR > 30, or acute complaint keywords (chest pain, stroke, altered mental status, anaphylaxis).
* **Pediatric Guardrails (Age < 18)**: Inspects pediatric distress cues (lethargy, poor responsiveness, respiratory distress) to prevent age-related under-triage.

### Stage 2: Sub-Millisecond NLP Chief Complaint Mapping
Maps unstructured free-text chief complaints against 356 clinical phrases directly to 175 standard binary features in under 1 millisecond with zero token delay.

### Stage 3: LightGBM Ordinal Risk Scoring
Evaluates demographics, vitals, and complaint features using a LightGBM ordinal regressor, outputting a continuous acuity score (ESI 1 to 5).

### Stage 4: Mathematical Uncertainty & Confidence Calibration
Derives decision-boundary confidence score based on proximity to class limits (1.5, 2.5, 3.5, 4.5). Proximity to class boundaries triggers an amber warning for borderline cases.

### Stage 5: Transparent Explainability & Rationale Generation
Pairs every recommendation with plain-language clinical rationale detailing abnormal vitals, identified chief complaints, and raw risk scores.

---

## 🤖 ML Model

### Dataset & Imbalance-Conscious Sampling
In standard hospital triage datasets, class distributions are severely skewed (~50% ESI 3, <1% ESI 1). A naive classifier learns to predict ESI 3 for everyone, failing critical cases.

To resolve this, we implemented an **imbalance-conscious capped sampling strategy**:
* **ESI 1**: All available instances (~5,271 records) included without downsampling.
* **ESI 5**: All available instances (~27,992 records) included.
* **ESI 2, 3, 4**: Capped at 50,000 records each.
* **Total Training Set**: ~183,000 patient encounters stratified into 80% train / 20% test.

### Training Formulation & Loss Objectives
* **Algorithm**: LightGBM Gradient Boosted Regressor (objective="regression", metric="rmse").
* **Critical Class Sample Weighting**: Multiplier of **7.0× applied to ESI-1**, forcing the optimizer to incur severe penalties for any under-prediction on critical patients.
* **Granularity Hyperparameters**: num_leaves=63, min_child_samples=120, max_bin=255, learning_rate=0.05.

### Clinical Evaluation Metrics & Validation Results
Evaluated on **36,653 independent test patients**:

| Metric | Result | Clinical Significance |
|---|---|---|
| **Quadratic Weighted Kappa (QWK)** | **0.718** | **Exceptional agreement** across ordered triage categories. |
| **Over-Triage Rate** | **21.6%** | Intentionally elevated: safety bias towards escalation. |
| **Critical Under-Triage Rate** | **~1.9%** | Kept extremely low (<2%) for critical ESI-1 cases to prevent waiting room collapse. |
| **Critical Sensitivity (ESI-1 Recall)** | **88.5%** | 50% exact ESI-1 + 38.5% assigned to immediate care ESI-2 beds. |
| **Catastrophic Miss Rate (ESI 1 → 4/5)** | **< 0.5%** | Virtually zero severe distance-3 under-triage errors. |
| **Critical Alarm Precision** | **94.0%** | 94% of ESI-1 alarms represent true ESI-1 or ESI-2 patients (low alert fatigue). |


> **Advantage — Low-Risk Acuity Shifts**  
> Over **90% of all under-triage occurrences** are shifted by only 1 tier (e.g., ESI 1 → ESI 2 or ESI 3 → ESI 4). This represents a **low-risk shift**, ensuring that critical patients assigned ESI 2 are still immediately placed into acute care beds without delayed treatment.
rres
---

## ✨ Features

### Safe Wait Thresholds
The system defines clinical wait thresholds tailored to patient acuity:

| ESI Acuity Level | Clinical Urgency | Normal Mode Max Safe Wait | Surge Mode Max Safe Wait (50%) |
|---|---|---|---|
| **ESI 1** | Resuscitation (Life-Threatening) | **0 min (Immediate)** | **0 min (Immediate)** |
| **ESI 2** | Emergent (High-Risk / Unstable) | **10 min (600 s)** | **5 min (300 s)** |
| **ESI 3** | Urgent (Moderate Risk) | **30 min (1800 s)** | **15 min (900 s)** |
| **ESI 4** | Semi-Urgent | **60 min (3600 s)** | **30 min (1800 s)** |
| **ESI 5** | Non-Urgent (0 Resources Needed) | **120 min (7200 s)** | **60 min (3600 s)** |

### Continuous Vital Drift Deterioration Detection
Patients waiting in the ED can physiologically decompensate over time. The serial vitals engine calculates real-time delta drift against baseline vitals:
* **SpO₂ Drop**: $\Delta \text{SpO}_2 > 5\%$
* **Heart Rate Spike**: $\Delta \text{HR} > 20\text{ bpm}$
* **Blood Pressure Drop**: $\Delta \text{SBP} > 15\text{ mmHg}$

When drift is detected, the engine sets retriage needed to true, records a vital drift alert audit event, and triggers a flashing red alert on the nurse interface.

### Surge Mode Auto-Escalation Engine
During mass casualty incidents or seasonal epidemics, the ED can activate **Surge Mode**:
1. All safe wait thresholds are **halved** across all ESI levels.
2. If any waiting patient exceeds their surge threshold, the queue engine **automatically promotes the patient up one ESI tier** (e.g., ESI-4 to ESI-3).
3. Auto-escalations are committed with SYSTEM user identification and an auto-escalate surge audit log.

### Adaptive Hospital Modality (Urban 5-Level ESI vs Rural 3-Tier)
Supports configurable operational modalities:
* **Urban Setting (URBAN)**: Standard 5-level Emergency Severity Index for multi-specialty trauma centers.
* **Rural Setting (RURAL)**: Simplified 3-tier resource model for community and remote healthcare facilities:
  * **Tier 1 (Critical)**: Merges ESI 1 & 2 for Immediate Care or Inter-facility Transport.
  * **Tier 2 (Urgent)**: Merges ESI 3 & 4 for Stabilization & Local Monitoring.
  * **Tier 3 (Non-Urgent)**: ESI 5 for Standard Outpatient / Clinic Care.

### Safety-First Hard Gate Guardrails
Prevents AI downgrades on critical presentations like cardiac arrest, stroke, severe hypotension, or pediatric hypoxia.

### Mandatory Clinician Override & Audit Trail
Requires nurse identification and clinical rationale for any score modification, logged into an immutable audit table.

### Regulatory Compliance & Privacy
Designed for HIPAA and GDPR data privacy standards with on-premise local inference and zero external PII exposure.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Axios
* **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic, SQLAlchemy, SQLite
* **Machine Learning & NLP**: LightGBM, Scikit-learn, PyYAML, Pandas, NumPy
* **Documentation & Visualization**: Mermaid.js, KaTeX, Marked.js

---

## 📂 Project Structure

* **Patient-Triage/**
  * **backend/**: FastAPI application, database ORM models, Pydantic schemas, ML pipeline, hard rules safety gate, and queue management services.
  * **frontend/**: React 18 user interface, clinical intake wizard, priority queue, surge simulator, and setting panels.
  * **dataset/**: Dataset generation scripts for imbalance-conscious stratified sampling.
  * **model/**: Machine learning training scripts, model benchmarks, and exported LightGBM booster weights.
  * **README.md**: System documentation and setup guide.
  * **README_preview.html**: Interactive web viewer for rendering system documentation, flowcharts, and math equations.

---

## ⚙️ Installation & Setup

### Prerequisites
Ensure Python 3.10+ and Node.js 18+ are installed on your machine.

### Step 1: Clone Repository
1. Open your terminal or command line.
2. Run the git clone command to clone the project repository.
3. Change directory into the Patient-Triage folder.

### Step 2: Backend Setup
1. Navigate to the backend directory.
2. Create a Python virtual environment.
3. Activate the virtual environment (Scripts\activate on Windows or source bin/activate on Linux/macOS).
4. Install backend dependencies using pip install with requirements.txt.
5. Start the backend server using uvicorn app.main:app --reload --port 8000.
6. The backend API will be live at http://localhost:8000 with interactive documentation at http://localhost:8000/docs.

### Step 3: Frontend Setup
1. Open a second terminal window and navigate to the frontend directory.
2. Install Node dependencies using npm install.
3. Launch the Vite development server using npm run dev.
4. Open your browser and navigate to http://localhost:5173 to access the PatientTriage.ai clinical interface.

---

## 🔐 Environment Variables

The system operates with sensible defaults out of the box and can be configured using environment variables in a backend .env file:

* **DATABASE_URL**: Connection string for the database (Default: sqlite:///./triage.db).
* **MODEL_PATH**: Relative filepath to the trained LightGBM booster model (Default: ../model/esi_triage_best_weight7.txt).
* **SURGE_MODE**: Operational flag to activate surge thresholds and auto-escalation (Default: False).
* **HOSPITAL_TYPE**: Modality toggle set to URBAN (5-level ESI) or RURAL (3-tier resource mode) (Default: URBAN).
* **CONFIDENCE_THRESHOLD**: Numerical threshold below which borderline amber warnings are triggered for nurses (Default: 0.50).

---

## 🔮 Future Improvements

* **EHR & FHIR Integration**: Direct two-way sync with HL7 FHIR standards for automatic patient record pre-population.
* **Multilingual Intake Support**: Speech-to-text NLP intake for multilingual patient populations.
* **Continuous Wearable Vital Streams**: Real-time integration with ICU bedside monitors and wearable telemetry units.
* **Edge ML Deployment**: Lightweight ONNX runtime execution for disconnected or offline rural deployment.

---

## 👥 Team

**Accenture Innovation Challenge 2026 — Round 2 (Problem Track 2: PatientTriage.ai)**

* **Himesh Chandrakar**
* **Siddhi Pogakwar**
* **Yogesh Kumar**

*Designed with a safety-first ethos: AI that assists, explains, and safeguards—keeping clinicians firmly in command.*
