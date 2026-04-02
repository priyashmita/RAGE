import os
import uuid
import bcrypt as _bcrypt
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from app.core.db import db
from app.core.auth import hash_password

router = APIRouter()

ADMIN_EMAIL    = "forchangerage@gmail.com"
ADMIN_PASSWORD = "R@ge2025!"

@router.post("/seed/admin")
def seed_admin():
    # Delete old admin@rage.com if present (migration)
    db.users.delete_many({"email": "admin@rage.com"})
    db.users.delete_many({"email": ADMIN_EMAIL})
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL,
        "name": "RAGE Admin",
        "password_hash": hash_password(ADMIN_PASSWORD),
        "role": "admin",
        "status": "active"
    })
    return {"status": "admin created fresh"}

@router.get("/debug/auth")
def debug_auth():
    user = db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not user:
        return {"found": False}

    stored_hash = user.get("password_hash", "")
    try:
        verified = _bcrypt.checkpw(ADMIN_PASSWORD.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception as e:
        verified = f"ERROR: {str(e)}"

    return {
        "found": True,
        "has_id": bool(user.get("id")),
        "role": user.get("role"),
        "hash_prefix": stored_hash[:7],
        "verified": verified
    }

class TestEmailRequest(BaseModel):
    to_email: EmailStr

@router.post("/debug/test-email")
def test_email(payload: TestEmailRequest):
    """
    Send a test email and return the raw result.
    Use this to verify Resend API key and domain configuration.
    """
    api_key = os.getenv("RESEND_API_KEY")
    result = {
        "resend_api_key_set": bool(api_key),
        "resend_api_key_prefix": (api_key[:8] + "...") if api_key else None,
        "from_email": "R.A.G.E. <noreply@rageforchange.com>",
        "to_email": payload.to_email,
        "sent": False,
        "message_id": None,
        "error": None,
        "raw_response": None,
    }

    if not api_key:
        result["error"] = "RESEND_API_KEY env var is not set on Railway"
        return result

    try:
        import resend
        resend.api_key = api_key
        resp = resend.Emails.send({
            "from":    "R.A.G.E. <noreply@rageforchange.com>",
            "to":      payload.to_email,
            "subject": "RAGE email test",
            "html":    "<p>This is a test email from the RAGE platform.</p>",
        })
        result["raw_response"] = repr(resp)
        result["message_id"] = (
            resp.get("id") if isinstance(resp, dict) else getattr(resp, "id", None)
        )
        result["sent"] = True
    except Exception as exc:
        result["error"] = str(exc)

    return result


@router.get("/seed")
def seed():
    exists = db.enquiries.find_one({"id": "1"})
    if not exists:
        db.enquiries.insert_one({
            "id": "1",
            "name": "Test Enquiry",
            "status": "unassigned"
        })
    return {"status": "seeded"}
