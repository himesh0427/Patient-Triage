from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Patient, Visit

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    """Fetch an existing patient by ID (for auto-fill in the frontend)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, f"Patient {patient_id} not found")
    
    # Count prior visits
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

@router.get("/search/")
def search_patients(q: str = "", db: Session = Depends(get_db)):
    """Search patients by name (for the 'Existing Patient' flow)."""
    if not q or len(q) < 2:
        return {"results": []}
    
    patients = db.query(Patient).filter(
        Patient.name.ilike(f"%{q}%")
    ).limit(20).all()
    
    return {
        "results": [
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

@router.get("/")
def list_patients(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """List all patients with pagination."""
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
