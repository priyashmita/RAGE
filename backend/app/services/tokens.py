import uuid
import secrets
from datetime import datetime, timezone, timedelta
from app.core.db import db

TOKEN_TTL_DAYS = 7
ACTION_TYPES   = ("accept", "decline", "need_context")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_outreach_tokens(enquiry_id: str, rager_id: str, brief_id: str) -> dict:
    """
    Create 3 tokens (accept / decline / need_context) for one rager + enquiry.
    Returns {"accept": token_str, "decline": token_str, "need_context": token_str}.
    """
    expires_at = (datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)).isoformat()
    tokens = {}

    for action in ACTION_TYPES:
        token = secrets.token_urlsafe(32)
        doc = {
            "id":          str(uuid.uuid4()),
            "token":       token,
            "enquiry_id":  enquiry_id,
            "rager_id":    rager_id,
            "brief_id":    brief_id,
            "action_type": action,
            "status":      "active",
            "expires_at":  expires_at,
            "used_at":     None,
            "created_at":  _now(),
        }
        db.outreach_tokens.insert_one(doc)
        tokens[action] = token

    return tokens


def validate_token(token: str) -> tuple[dict | None, str | None]:
    """
    Validate a token. Returns (token_doc, error_message).
    error_message is None if valid.
    """
    doc = db.outreach_tokens.find_one({"token": token}, {"_id": 0})

    if not doc:
        return None, "invalid"

    if doc["status"] == "used":
        return doc, "used"

    if doc["status"] == "expired":
        return doc, "expired"

    expires_at = datetime.fromisoformat(doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        db.outreach_tokens.update_one({"token": token}, {"$set": {"status": "expired"}})
        return doc, "expired"

    return doc, None


def mark_token_used(token: str) -> None:
    db.outreach_tokens.update_one(
        {"token": token},
        {"$set": {"status": "used", "used_at": _now()}},
    )
