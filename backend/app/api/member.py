from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.db import db

router = APIRouter()

class MemberResponseRequest(BaseModel):
    response: str

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
