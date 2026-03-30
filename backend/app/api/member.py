import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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

class MemberResponseRequest(BaseModel):
    response: str

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
        "status": "new",
        "created_at": datetime.utcnow().isoformat(),
    }
    db.enquiries.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "submitted", "id": doc["id"]}

@router.patch("/member/respond/{id}")
def member_respond(id: str, data: MemberResponseRequest):
    if data.response not in ["accept", "decline"]:
        raise HTTPException(status_code=400, detail="Invalid response")

    result = db.allocations.update_one(
        {"id": id},
        {"$set": {"status": data.response}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Allocation not found")

    return {"status": "updated"}
