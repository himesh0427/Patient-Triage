from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from ..models import Queue, Visit, AuditLog
from ..config import settings, REASSESSMENT_WAIT, SURGE_REASSESSMENT_WAIT

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def iso_z(dt):
    return (dt.isoformat() + "Z") if dt else None

def get_thresholds():
    return SURGE_REASSESSMENT_WAIT if settings.SURGE_MODE else REASSESSMENT_WAIT

def get_retriage_deadline(queue, visit, thresholds=None):
    thresholds = thresholds or get_thresholds()
    now = utcnow()

    arrival = visit.arrival_time or now
    base = queue.last_retriage_at or arrival
    if base is None:
        base = arrival

    if base > now:
        base = now

    threshold = thresholds.get(queue.esi_level, 3600)
    deadline = base + timedelta(seconds=threshold)

    total_wait = max(0, int((now - arrival).total_seconds()))
    due_in = max(0, int((deadline - now).total_seconds()))
    overdue = now > deadline

    return {
        "total_wait_seconds": total_wait,
        "reassessment_due_in_seconds": due_in,
        "retriage_deadline_at": iso_z(deadline),
        "retriage_overdue": overdue,
        "last_retriage_at": iso_z(base) if base else None,
    }

def check_and_update_retriage(db: Session):
    thresholds = get_thresholds()

    queue_items = db.query(Queue, Visit).join(Visit).filter(Visit.is_active == True).all()

    for q, v in queue_items:
        base = q.last_retriage_at or v.arrival_time or utcnow()
        wait_since_retriage = (utcnow() - base).total_seconds()
        threshold = thresholds.get(q.esi_level, 3600)

        if wait_since_retriage > threshold:
            if settings.SURGE_MODE and q.esi_level > 1:
                old_esi = q.esi_level
                new_esi = max(1, q.esi_level - 1)

                q.esi_level = new_esi
                q.retriage_needed = True
                q.last_retriage_at = utcnow()

                visit = db.query(Visit).filter(Visit.id == q.visit_id).first()
                if visit:
                    visit.esi_final = new_esi
                    visit.is_overridden = True
                    visit.override_reason = f"Auto-escalated due to Surge Mode wait > {int(threshold/60)} min"
                    visit.overridden_by = "SYSTEM_AUTO"

                log = AuditLog(
                    visit_id=q.visit_id,
                    action="AUTO_ESCALATE_SURGE",
                    old_value=str(old_esi),
                    new_value=str(new_esi),
                    user_id="SYSTEM",
                    reason=f"Surge mode: wait time exceeded {int(threshold/60)} min"
                )
                db.add(log)
            else:
                q.retriage_needed = True

    db.commit()
