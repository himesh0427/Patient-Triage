#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta, timezone
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models import Patient, Visit, Queue, AuditLog, User
from app.routers.triage import predict_patient
from app.routers.override import override_esi
from app.main import record_revitals
from app.schemas import (
    TriageInput, VitalsInput, OverrideInput, RevitalsInput,
)
from sqlalchemy import text

NOW = datetime.now(timezone.utc).replace(tzinfo=None)

def minutes_ago(minutes: int) -> datetime:
    return NOW - timedelta(minutes=minutes)

def clean_vital(val):
    if pd.isna(val) or val == 0:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def wipe_existing(db):
    db.execute(text("DELETE FROM audit_logs"))
    db.execute(text("DELETE FROM queue"))
    db.execute(text("DELETE FROM symptom_cc"))
    db.execute(text("DELETE FROM vitals"))
    db.execute(text("DELETE FROM visits"))
    db.execute(text("DELETE FROM patients"))
    db.commit()

def main():
    db = SessionLocal()
    print("Wiping existing database records to prepare clean queue...")
    wipe_existing(db)

    dataset_path = os.path.join(os.path.dirname(__file__), "..", "..", "dataset", "dataset.xls")
    if not os.path.exists(dataset_path):
        print(f"[ERROR] Could not find {dataset_path}")
        sys.exit(1)

    df = pd.read_csv(dataset_path, sep='\t')
    # Use first 20 patients for clean queue demonstration
    df_20 = df.head(20)
    print(f"Loaded {len(df_20)} patient records from {dataset_path}")

    created = []

    for idx, row in df_20.iterrows():
        name = str(row['Name'])
        age = int(row['Age'])
        gender = str(row['Gender'])
        has_history = bool(str(row['Has_Prior_History']).upper() == 'TRUE')
        symptoms = str(row['Chief_Complaint'])
        
        vitals = {
            'hr': clean_vital(row['HR_bpm']),
            'sbp': clean_vital(row['SBP_mmHg']),
            'dbp': clean_vital(row['DBP_mmHg']),
            'rr': clean_vital(row['RR_bpm']),
            'spo2': clean_vital(row['SpO2_percent']),
            'temp': clean_vital(row['Temp_C']),
        }

        # Stagger arrival times (2 mins ago to 60 mins ago)
        mins_ago = 2 + (idx * 3)

        result = predict_patient(
            TriageInput(
                name=name,
                age=age,
                gender=gender,
                has_history=has_history,
                symptom_text=symptoms,
                vitals=VitalsInput(**vitals),
            ),
            db,
        )

        arrival = minutes_ago(mins_ago)
        vrow = db.query(Visit).filter(Visit.id == result.visit_id).first()
        if vrow:
            vrow.arrival_time = arrival
            qrow = db.query(Queue).filter(Queue.visit_id == vrow.id).first()
            if qrow:
                qrow.last_retriage_at = arrival
            db.commit()

        created.append({
            "visit_id": result.visit_id,
            "patient_id": result.patient_id,
            "name": name,
            "age": age,
            "esi": result.esi,
            "confidence": result.confidence,
        })

    # Demonstrate Clinician Override on PAT-020 (Victoria Vance)
    vic_visit = next((c for c in created if c["name"] == "Victoria Vance"), None)
    admin_user = db.query(User).filter(User.username == "admin").first()
    if vic_visit and admin_user:
        override_esi(
            visit_id=vic_visit["visit_id"],
            input=OverrideInput(
                new_esi=2,
                reason="Nurse observation: marked facial pallor, cold diaphoresis, severe acute distress. Escalated from ESI 4 to ESI 2.",
                nurse_id="RN Sarah Jenkins",
            ),
            current_user=admin_user,
            db=db,
        )

    # Demonstrate Re-Vitals Deterioration Alert on PAT-019 (Benjamin Foster)
    ben_visit = next((c for c in created if c["name"] == "Benjamin Foster"), None)
    if ben_visit:
        record_revitals(
            visit_id=ben_visit["visit_id"],
            input=RevitalsInput(
                hr=118, sbp=100, dbp=64, rr=26, spo2=87, temp=38.8,
                nurse_id="RN Sarah Jenkins",
            ),
            db=db,
        )

    print("\n=== DATABASE SEED SUMMARY ===")
    active_count = db.query(Queue).count()
    total_patients = db.query(Patient).count()
    audit_count = db.query(AuditLog).count()

    print(f"• Total Patients in DB   : {total_patients}")
    print(f"• Active in Triage Queue : {active_count} (ALL 20 Patients Active in Queue!)")
    print(f"• Audit Logs Logged      : {audit_count}")
    print("Database seeding completed successfully.")
    db.close()

if __name__ == "__main__":
    main()
