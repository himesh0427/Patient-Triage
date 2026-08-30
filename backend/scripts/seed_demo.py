#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models import Patient, Visit, Queue, AuditLog
from app.routers.triage import predict_patient, discharge_patient
from app.routers.override import override_esi
from app.main import record_revitals
from app.schemas import (
    TriageInput, VitalsInput, OverrideInput, RevitalsInput,
)
from sqlalchemy import text

NOW = datetime.now(timezone.utc).replace(tzinfo=None)

def minutes_ago(minutes: int) -> datetime:
    return NOW - timedelta(minutes=minutes)

def v(hr=80, sbp=120, dbp=78, rr=16, spo2=98, temp=37.0):
    return {"hr": hr, "sbp": sbp, "dbp": dbp, "rr": rr, "spo2": spo2, "temp": temp}

ROSTER = [
    ("Marcus Whitfield", 64, "Male", False,
     "cardiac arrest, patient unresponsive and not breathing",
     v(spo2=78, sbp=62, hr=None), 3),
    ("Elena Vasquez", 58, "Female", False,
     "found unresponsive, no pulse, CPR in progress",
     v(spo2=70, sbp=58, hr=None), 6),

    ("James Holloway", 52, "Male", True,
     "crushing chest pain radiating to the left arm, with diaphoresis",
     v(hr=112, sbp=150, rr=22, spo2=96), 12),
    ("Priya Raman", 47, "Female", False,
     "sudden onset facial droop and weakness on the left side, possible stroke",
     v(hr=98, sbp=158, dbp=92, rr=20), 18),
    ("Daniel Okafor", 4, "Male", False,
     "high fever, very lethargic and hard to wake, not drinking",
     v(hr=152, sbp=88, dbp=52, rr=34, spo2=94, temp=39.4), 22),
    ("Margaret Chen", 78, "Female", True,
     "altered mental status and confusion since this morning",
     v(hr=104, sbp=142, dbp=84, rr=20, spo2=95), 27),

    ("Robert Carter", 58, "Male", True,
     "abdominal pain and nausea for two days, worse after eating",
     v(hr=88, sbp=128, rr=18, temp=37.6), 34),
    ("Thomas Blake", 66, "Male", False,
     "fever and cough for three days, mild shortness of breath",
     v(hr=94, sbp=132, dbp=82, rr=22, spo2=95, temp=38.1), 44),

    ("Alicia Moreno", 38, "Female", False,
     "mild headache after not sleeping all night",
     v(hr=74, sbp=116, dbp=74, rr=15, spo2=99, temp=36.8), 58),
    ("David Kim", 44, "Male", False,
     "low back pain after lifting something heavy at work",
     v(hr=78, sbp=122, dbp=78, rr=16, spo2=98, temp=36.9), 66),

    ("Grace Osei", 9, "Female", False,
     "sore throat and mild fever",
     v(hr=96, sbp=102, dbp=60, rr=20, spo2=98, temp=37.9), 78),
    ("Nathan Price", 33, "Male", True,
     "urinary burning and increased frequency",
     v(hr=80, sbp=128, dbp=82, rr=16, spo2=98, temp=37.4), 86),
]

DISCHARGED = [
    ("Sofia Anders", 24, "Female", False,
     "itchy rash and hives after starting a new medication",
     v(hr=74, sbp=110, dbp=72, rr=15, spo2=99, temp=36.9), 120),
    ("Liam O'Brien", 29, "Male", False,
     "small laceration on the hand from a kitchen knife",
     v(hr=78, sbp=124, rr=16, spo2=99, temp=37.0), 140),
]

RETURNING = {
    "james": {"name": "James Holloway", "age": 52, "gender": "Male"},
    "robert": {"name": "Robert Carter", "age": 58, "gender": "Male"},
}

def wipe_existing(db):
    db.execute(text("DELETE FROM audit_logs"))
    db.execute(text("DELETE FROM queue"))
    db.execute(text("DELETE FROM symptom_cc"))
    db.execute(text("DELETE FROM vitals"))
    db.execute(text("DELETE FROM visits"))
    db.execute(text("DELETE FROM patients"))
    db.commit()

def seed_prior_visit(db, patient, symptom_text, vitals, hours_ago=48):
    prior = predict_patient(
        TriageInput(
            patient_id=patient.id,
            name=patient.name,
            age=patient.age,
            gender=patient.gender,
            has_history=patient.has_history,
            symptom_text=symptom_text,
            vitals=VitalsInput(**vitals),
        ),
        db,
    )
    vrow = db.query(Visit).filter(Visit.id == prior.visit_id).first()
    vrow.arrival_time = NOW - timedelta(hours=hours_ago)
    vrow.is_active = False
    vrow.discharge_time = vrow.arrival_time + timedelta(hours=2)
    qrow = db.query(Queue).filter(Queue.visit_id == vrow.id).first()
    if qrow:
        db.delete(qrow)
    log = AuditLog(
        visit_id=vrow.id,
        action="DISCHARGE",
        old_value=str(vrow.esi_final),
        new_value="DISCHARGED",
        user_id="SYSTEM",
        reason="Prior visit (simulated history) completed and discharged.",
    )
    db.add(log)
    db.commit()

def seed_patient(db, entry, returning_ids, record_time=True):
    name, age, gender, has_history, symptom_text, vitals, mins_ago = entry
    patient_id = returning_ids.get(name)
    result = predict_patient(
        TriageInput(
            patient_id=patient_id,
            name=name,
            age=age,
            gender=gender,
            has_history=has_history,
            symptom_text=symptom_text,
            vitals=VitalsInput(**vitals),
        ),
        db,
    )
    if record_time:
        arrival = minutes_ago(mins_ago)
        vrow = db.query(Visit).filter(Visit.id == result.visit_id).first()
        vrow.arrival_time = arrival
        qrow = db.query(Queue).filter(Queue.visit_id == vrow.id).first()
        if qrow:
            qrow.last_retriage_at = arrival
        db.commit()
    return {
        "visit_id": result.visit_id,
        "patient_id": result.patient_id,
        "name": name,
        "age": age,
        "esi": result.esi,
        "confidence": result.confidence,
    }

def main():
    db = SessionLocal()
    print("Wiping existing demo records...")
    wipe_existing(db)

    created = []
    returning_ids = {}

    for key in ("james", "robert"):
        r = RETURNING[key]
        patient = Patient(name=r["name"], age=r["age"], gender=r["gender"], has_history=True)
        db.add(patient); db.commit(); db.refresh(patient)
        returning_ids[r["name"]] = patient.id

    james = db.query(Patient).filter_by(id=returning_ids["James Holloway"]).first()
    seed_prior_visit(db, james,
                     "episode of palpitations and chest discomfort",
                     v(hr=108, sbp=146, rr=20), hours_ago=96)

    robert = db.query(Patient).filter_by(id=returning_ids["Robert Carter"]).first()
    seed_prior_visit(db, robert, "mild abdominal discomfort and reflux", v(hr=80, sbp=124, rr=16), hours_ago=72)
    seed_prior_visit(db, robert, "sore throat and sinus pressure", v(hr=76, sbp=118, rr=15), hours_ago=240)

    print("Seeding active patients through the real triage pipeline...")
    for entry in ROSTER:
        created.append(seed_patient(db, entry, returning_ids))

    print("Seeding discharged (history-retained) patients...")
    for entry in DISCHARGED:
        rec = seed_patient(db, entry, returning_ids)
        discharge_patient(rec["visit_id"], db)

    robert_rec = next(c for c in created if c["name"] == "Robert Carter")
    override_esi(
        robert_rec["visit_id"],
        OverrideInput(
            new_esi=2,
            reason="Patient has significant abdominal tenderness with guarding on exam; escalating to ESI-2 for surgical evaluation.",
            nurse_id="RN A. Collins",
        ),
        db,
    )

    thomas = next(c for c in created if c["name"] == "Thomas Blake")
    record_revitals(
        thomas["visit_id"],
        RevitalsInput(
            hr=128, sbp=98, dbp=60, rr=30, spo2=87, temp=38.4,
            nurse_id="RN A. Collins",
        ),
        db,
    )

    print("\n=== SEED SUMMARY (active) ===")
    for c in sorted(created, key=lambda x: (x["esi"], x["name"])):
        print(
            f"  ESI-{c['esi']}  conf={c['confidence']:.2f}  {c['name']} (age {c['age']})"
        )
    print(f"\n  Active: {len(created)}  Discharged (history retained): {len(DISCHARGED)}")
    print("Demo reseed complete.")
    db.close()

if __name__ == "__main__":
    main()
