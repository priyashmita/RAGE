import uuid
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import db

router = APIRouter()

class EnquiryRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = ""
    message: Optional[str] = ""
    interest: Optional[str] = "general"
    # Extended matching fields
    format: Optional[str] = ""        # closed_table | private_table | sunday_table
    challenge: Optional[str] = ""     # detailed description of what they need
    budget: Optional[str] = ""        # e.g. "₹5,000–₹10,000"
    categories: Optional[List[str]] = []  # expertise areas needed

@router.post("/enquiries")
def submit_enquiry(data: EnquiryRequest):
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "company": data.company or "",
        "message": data.message or "",
        "interest": data.interest or "general",
        "format": data.format or "",
        "challenge": data.challenge or data.message or "",
        "budget": data.budget or "",
        "categories": data.categories or [],
        "status": "new",
        "created_at": datetime.utcnow().isoformat(),
    }
    db.enquiries.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "submitted", "id": doc["id"]}

@router.post("/closed-table-requests")
def submit_closed_table_request(data: dict):
    doc = {
        "id": str(uuid.uuid4()),
        "format": "closed_table",
        "status": "new",
        "created_at": datetime.utcnow().isoformat(),
        **{k: v for k, v in data.items() if k not in ("id", "status", "created_at", "format")},
    }
    db.enquiries.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "submitted", "id": doc["id"]}
