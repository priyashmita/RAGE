import uuid
from fastapi import APIRouter
from app.core.db import db
from app.core.auth import hash_password

router = APIRouter()

@router.post("/seed/admin")
def seed_admin():
    email = "admin@rage.com"
    existing = db.users.find_one({"email": email})

    if existing:
        # Always fix the existing record: reset password hash and ensure id exists
        db.users.update_one(
            {"email": email},
            {"$set": {
                "password_hash": hash_password("admin123"),
                "role": "admin",
                "status": "active",
                "name": "RAGE Admin",
                # Preserve existing id or create one if missing
                **({} if existing.get("id") else {"id": str(uuid.uuid4())})
            }}
        )
        return {"status": "admin reset"}

    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "name": "RAGE Admin",
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "status": "active"
    })
    return {"status": "admin created"}

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
