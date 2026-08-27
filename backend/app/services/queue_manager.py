from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Queue, Visit, AuditLog
from ..config import settings

# Safe wait thresholds (in seconds)
NORMAL_WAIT = {1: 0, 2: 600, 3: 1800, 4: 3600, 5: 7200}
SURGE_WAIT = {1: 0, 2: 300, 3: 900, 4: 1800, 5: 3600}

def get_thresholds():
    """Returns the active thresholds based on Surge Mode toggle."""
    return SURGE_WAIT if settings.SURGE_MODE else NORMAL_WAIT

def check_and_update_retriage(db: Session):
    """
    This is the HEART of your queue logic. 
    It runs every 30 seconds (or on queue refresh).
    - Normal Mode: Flags patients for nurse review.
    - Surge Mode: Auto-escalates patients UP one level (e.g., 2->1) if they wait too long.
    """
    thresholds = get_thresholds()
    
    # Get all active patients in the queue, ordered by ESI (we sort it here just in case)
    queue_items = db.query(Queue, Visit).join(Visit).filter(Visit.is_active == True).all()
    
    for q, v in queue_items:
        # Calculate how long they've been waiting
        wait_time = (datetime.now() - v.arrival_time).total_seconds()
        threshold = thresholds.get(q.esi_level, 3600)
        
        if wait_time > threshold:
            # -----------------------------------------
            # 1. SURGE MODE: AUTO-ESCALATE
            # -----------------------------------------
            if settings.SURGE_MODE and q.esi_level > 1:
                old_esi = q.esi_level
                new_esi = max(1, q.esi_level - 1)  # Move UP one level (2->1, 3->2)
                
                # Update Queue
                q.esi_level = new_esi
                q.retriage_needed = True
                
                # Update the Visit record
                visit = db.query(Visit).filter(Visit.id == q.visit_id).first()
                if visit:
                    visit.esi_final = new_esi
                    visit.is_overridden = True
                    visit.override_reason = f"Auto-escalated due to Surge Mode wait > {int(threshold/60)} min"
                    visit.overridden_by = "SYSTEM_AUTO"
                
                # Audit Log (Critical for PS compliance)
                log = AuditLog(
                    visit_id=q.visit_id,
                    action="AUTO_ESCALATE_SURGE",
                    old_value=str(old_esi),
                    new_value=str(new_esi),
                    user_id="SYSTEM",
                    reason=f"Surge mode: wait time exceeded {int(threshold/60)} min"
                )
                db.add(log)
            
            # -----------------------------------------
            # 2. NORMAL MODE: FLAG FOR NURSE REVIEW
            # -----------------------------------------
            else:
                q.retriage_needed = True
    
    db.commit()