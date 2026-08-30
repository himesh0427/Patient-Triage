from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models import Patient, Visit

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("/search/")
def search_patients(q: str = "", db: Session = Depends(get_db)):
    if not q or len(q.strip()) == 0:
        return {"results": []}
    
    clean_q = q.strip()
    
    id_num = None
    cleaned_digits = "".join([c for c in clean_q if c.isdigit()])
    if cleaned_digits:
        try:
            id_num = int(cleaned_digits)
        except ValueError:
            pass

    query = db.query(Patient)
    if id_num is not None:
        query = query.filter(or_(Patient.id == id_num, Patient.name.ilike(f"%{clean_q}%")))
    else:
        query = query.filter(Patient.name.ilike(f"%{clean_q}%"))
        
    patients = query.limit(20).all()
    
    results = []
    for p in patients:
        latest_visit = db.query(Visit).filter(Visit.patient_id == p.id).order_by(Visit.arrival_time.desc()).first()
        results.append({
            "id": p.id,
            "patient_code": f"P-{p.id}",
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "has_history": p.has_history,
            "latest_visit_id": latest_visit.id if latest_visit else None,
            "latest_arrival_time": str(latest_visit.arrival_time) if latest_visit else None
        })
        
    return {"results": results}

@router.get("/{patient_id:int}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, f"Patient {patient_id} not found")
    
    visit_count = db.query(Visit).filter(Visit.patient_id == patient_id).count()
    
    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "has_history": patient.has_history,
        "prior_visits": visit_count,
        "created_at": str(patient.created_at)
    }

@router.get("/")
def list_patients(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    patients = db.query(Patient).offset(skip).limit(limit).all()
    total = db.query(Patient).count()
    
    return {
        "total": total,
        "patients": [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "has_history": p.has_history,
            }
            for p in patients
        ]
    }
