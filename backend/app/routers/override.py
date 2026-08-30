from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import datetime, timezone
from ..database import get_db
from ..models import Visit, Queue, AuditLog
from ..schemas import OverrideInput

router = APIRouter(prefix="/override", tags=["Override"])

def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

@router.put("/visit/{visit_id}")
def override_esi(visit_id: int, input: OverrideInput, db: Session = Depends(get_db)):
    # 1. Find the visit
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")
    
    old_esi = visit.esi_final
    
    # 2. Update Visit
    visit.esi_final = input.new_esi
    visit.is_overridden = True
    visit.override_reason = input.reason
    visit.overridden_by = input.nurse_id
    visit.override_timestamp = func.now()
    
    # 3. Update Queue
    queue = db.query(Queue).filter(Queue.visit_id == visit_id).first()
    if queue:
        queue.esi_level = input.new_esi
        queue.retriage_needed = False  # Nurse addressed it
        # Reset the reassessment clock so the timer recalculates for the NEW ESI level
        queue.last_retriage_at = _utcnow()
    
    # 4. Audit Log (PS Requirement: Must log all overrides)
    log = AuditLog(
        visit_id=visit_id,
        action="OVERRIDE",
        old_value=str(old_esi),
        new_value=str(input.new_esi),
        user_id=input.nurse_id,
        reason=input.reason
    )
    db.add(log)
    db.commit()
    
    return {"message": f"ESI updated from {old_esi} to {input.new_esi}"}