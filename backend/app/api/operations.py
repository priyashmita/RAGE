from fastapi import APIRouter
from bson import ObjectId

router = APIRouter()

# TEMP FAKE DB (so it doesn't crash)
fake_db = {
    "enquiries": [],
    "allocations": []
}

@router.get("/admin/enquiries")
def get_enquiries():
    return fake_db["enquiries"]

@router.post("/admin/allocations")
def create_allocation(data: dict):
    fake_db["allocations"].append(data)
    return {"status": "created"}

@router.patch("/member/respond/{id}")
def member_respond(id: str, data: dict):
    return {"status": "updated"}
