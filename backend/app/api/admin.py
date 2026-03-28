from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

class AllocationCreateRequest(BaseModel):
    id: str
    enquiry_id: str
    member_id: str
    status: str = "pending"

@router.get("/admin/enquiries")
def get_enquiries(admin=Depends(require_admin)):
    items = list(db.enquiries.find({}, {"_id": 0}))
    return items

@router.get("/admin/allocations")
def get_allocations(admin=Depends(require_admin)):
    items = list(db.allocations.find({}, {"_id": 0}))
    return items

@router.post("/admin/allocations")
def create_allocation(data: AllocationCreateRequest, admin=Depends(require_admin)):
    db.allocations.insert_one(data.dict())
    return {"status": "created"}
