import uuid
import bcrypt as _bcrypt
from fastapi import APIRouter
from app.core.db import db
from app.core.auth import hash_password

router = APIRouter()

@router.post("/seed/admin")
def seed_admin():
    email = "admin@rage.com"
    # Delete and recreate cleanly every time
    db.users.delete_many({"email": email})
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "name": "RAGE Admin",
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "status": "active"
    })
    return {"status": "admin created fresh"}

@router.get("/debug/auth")
def debug_auth():
    email = "admin@rage.com"
    user = db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"found": False}

    stored_hash = user.get("password_hash", "")
    try:
        verified = _bcrypt.checkpw(b"admin123", stored_hash.encode("utf-8"))
    except Exception as e:
        verified = f"ERROR: {str(e)}"

    return {
        "found": True,
        "has_id": bool(user.get("id")),
        "role": user.get("role"),
        "hash_prefix": stored_hash[:7],
        "verified": verified
    }

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
