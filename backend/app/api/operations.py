from fastapi import APIRouter

router = APIRouter()

fake_db = {
    "enquiries": [{"id": "1", "name": "Test Enquiry"}],
    "allocations": []
}

@router.get("/admin/enquiries")
def get_enquiries():
    return fake_db["enquiries"]

@router.get("/admin/allocations")
def get_allocations():
    return fake_db["allocations"]

@router.post("/admin/allocations")
def create_allocation(data: dict):
    fake_db["allocations"].append(data)
    return {"status": "created"}

@router.patch("/member/respond/{id}")
def member_respond(id: str, data: dict):
    return {"status": "updated"}
