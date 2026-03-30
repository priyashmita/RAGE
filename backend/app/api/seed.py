import uuid
from fastapi import APIRouter
from app.core.db import db
from app.core.auth import hash_password

router = APIRouter()

@router.post("/seed/admin")
def seed_admin():
    email = "admin@rage.com"
    if db.users.find_one({"email": email}):
        return {"status": "already exists"}

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
