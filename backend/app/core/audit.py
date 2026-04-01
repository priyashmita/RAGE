import uuid
from datetime import datetime, timezone
from app.core.db import db


def write_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: dict,
    actor: dict | None = None,
):
    """
    Write an immutable audit log entry.

    action      — dot-namespaced constant, e.g. "invite.sent"
    entity_type — "contact" | "user" | "match_candidate"
    entity_id   — id of the affected record
    metadata    — action-specific context dict
    actor       — admin user dict, or None for system / self-serve actions
    """
    db.audit_logs.insert_one({
        "id":           str(uuid.uuid4()),
        "actor_id":     actor.get("id") if actor else None,
        "actor_email":  actor.get("email") if actor else None,
        "action":       action,
        "entity_type":  entity_type,
        "entity_id":    entity_id,
        "metadata":     metadata,
        "created_at":   datetime.now(timezone.utc).isoformat(),
    })
