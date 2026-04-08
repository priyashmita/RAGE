import uuid
from datetime import datetime, timezone
from app.core.db import db

RESPONSE_TYPE_MAP = {
    "accept":       "accepted",
    "decline":      "declined",
    "need_context": "needs_context",
}

# Maps rager_responses.response_type → allocations.status
ALLOC_STATUS_MAP = {
    "accepted":      "rager_accepted",
    "declined":      "rager_declined",
    "needs_context": "rager_accepted",   # rager is interested — treat as available for shortlisting
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sync_allocation(enquiry_id: str, rager_id: str, response_type: str, now: str) -> None:
    """Sync the rager response back to the allocations collection."""
    new_status = ALLOC_STATUS_MAP.get(response_type)
    if not new_status:
        return

    db.allocations.update_one(
        {"enquiry_id": enquiry_id, "rager_id": rager_id, "status": "pending_rager"},
        {"$set": {"status": new_status, "rager_responded_at": now}},
    )

    # If no allocations are still pending_rager, advance enquiry to pending_founder
    remaining = db.allocations.count_documents(
        {"enquiry_id": enquiry_id, "status": "pending_rager"}
    )
    if remaining == 0:
        db.enquiries.update_one(
            {"id": enquiry_id, "status": "pending_rager"},
            {"$set": {"status": "pending_founder"}},
        )


def record_response(token_doc: dict, message: str = "") -> tuple[dict, bool]:
    """
    Upsert a rager response. Returns (response_doc, was_duplicate).
    was_duplicate is True if a response for this rager+enquiry already existed.
    """
    enquiry_id   = token_doc["enquiry_id"]
    rager_id     = token_doc["rager_id"]
    brief_id     = token_doc["brief_id"]
    response_type = RESPONSE_TYPE_MAP[token_doc["action_type"]]
    now          = _now()

    existing = db.rager_responses.find_one(
        {"enquiry_id": enquiry_id, "rager_id": rager_id},
        {"_id": 0},
    )

    if existing:
        # Same token clicked twice → update in place but flag as duplicate
        if existing.get("token_id") == token_doc["id"]:
            return existing, True

        # Different response (e.g. they previously declined and now accept) → update
        db.rager_responses.update_one(
            {"enquiry_id": enquiry_id, "rager_id": rager_id},
            {"$set": {
                "response_type": response_type,
                "message":       message,
                "responded_at":  now,
                "token_id":      token_doc["id"],
                "updated_at":    now,
            }},
        )
        updated = db.rager_responses.find_one(
            {"enquiry_id": enquiry_id, "rager_id": rager_id}, {"_id": 0}
        )
        _sync_allocation(enquiry_id, rager_id, response_type, now)
        return updated, False

    doc = {
        "id":            str(uuid.uuid4()),
        "enquiry_id":    enquiry_id,
        "rager_id":      rager_id,
        "brief_id":      brief_id,
        "response_type": response_type,
        "message":       message,
        "responded_at":  now,
        "token_id":      token_doc["id"],
        "created_at":    now,
        "updated_at":    now,
    }
    db.rager_responses.insert_one(doc)
    _sync_allocation(enquiry_id, rager_id, response_type, now)
    return doc, False
