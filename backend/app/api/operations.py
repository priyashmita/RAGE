from fastapi import APIRouter
from pymongo import MongoClient
import os

router = APIRouter()

client = MongoClient(os.getenv("MONGO_URL"))
db = client.get_default_database()

@router.get("/admin/enquiries")
def get_enquiries():
    items = list(db.enquiries.find({}, {"_id": 0}))
    return items

@router.get("/admin/allocations")
def get_allocations():
    items = list(db.allocations.find({}, {"_id": 0}))
    return items

@router.post("/admin/allocations")
def create_allocation(data: dict):
    db.allocations.insert_one(data)
    return {"status": "created"}

@router.patch("/member/respond/{id}")
def member_respond(id: str, data: dict):
    return {"status": "updated"}

@router.get("/seed")
def seed():
    db.enquiries.insert_one({"id": "1", "name": "Test Enquiry"})
    return {"status": "seeded"}
