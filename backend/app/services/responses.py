import uuid
from datetime import datetime, timezone
from app.core.db import db

RESPONSE_TYPE_MAP = {
    "accept":       "accepted",
    "decline":      "declined",
    "need_context": "needs_context",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    return doc, False
