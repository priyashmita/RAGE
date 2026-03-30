import uuid
from collections import Counter
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()


class AllocationCreateRequest(BaseModel):
    id: str
    enquiry_id: str
    member_id: str
    status: str = "pending"


class ReportIn(BaseModel):
    title: str
    period: Optional[str] = ""
    summary: str
    themes: Optional[list] = []
    data_points: Optional[list] = []
    notes: Optional[str] = ""


@router.get("/admin/enquiries")
def get_enquiries(admin=Depends(require_admin)):
    return list(db.enquiries.find({}, {"_id": 0}))


@router.get("/admin/allocations")
def get_allocations(admin=Depends(require_admin)):
    return list(db.allocations.find({}, {"_id": 0}))


@router.post("/admin/allocations")
def create_allocation(data: AllocationCreateRequest, admin=Depends(require_admin)):
    db.allocations.insert_one(data.dict())
    return {"status": "created"}


@router.get("/admin/analytics")
def get_analytics(admin=Depends(require_admin)):
    enquiries = list(db.enquiries.find({}, {"_id": 0}))
    allocations = list(db.allocations.find({}, {"_id": 0}))
    ragers = list(db.ragers.find({}, {"_id": 0, "categories": 1, "is_public": 1}))

    enq_by_product = dict(Counter(e.get("product", "unknown") for e in enquiries))
    enq_by_status = dict(Counter(e.get("status", "unknown") for e in enquiries))

    alloc_by_response = dict(Counter(a.get("member_response", "unknown") for a in allocations))
    total_cost = sum(float(a.get("cost_to_admin", 0) or 0) for a in allocations)
    total_payout = sum(float(a.get("payout_to_member", 0) or 0) for a in allocations)

    user_by_role = {
        role: db.users.count_documents({"role": role})
        for role in ["founder", "expert", "member", "sponsor", "admin"]
    }

    cat_counter = Counter()
    for r in ragers:
        for c in r.get("categories", []):
            cat_counter[c] += 1

    return {
        "enquiries": {
            "total": len(enquiries),
            "by_product": enq_by_product,
            "by_status": enq_by_status,
        },
        "allocations": {
            "total": len(allocations),
            "by_response": alloc_by_response,
            "total_cost": total_cost,
            "total_payout": total_payout,
            "margin": total_cost - total_payout,
        },
        "users": {
            "total": db.users.count_documents({}),
            "by_role": user_by_role,
        },
        "ragers": {
            "total": len(ragers),
            "public": sum(1 for r in ragers if r.get("is_public")),
            "by_category": dict(cat_counter.most_common(10)),
        },
    }


@router.get("/admin/reports")
def list_reports(admin=Depends(require_admin)):
    return list(db.reports.find({}, {"_id": 0}).sort("created_at", -1))


@router.post("/admin/reports")
def create_report(data: ReportIn, admin=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email", ""),
        **data.dict(),
    }
    db.reports.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/admin/reports/{report_id}")
def update_report(report_id: str, data: ReportIn, admin=Depends(require_admin)):
    db.reports.update_one({"id": report_id}, {"$set": data.dict()})
    return {"status": "updated"}


@router.delete("/admin/reports/{report_id}")
def delete_report(report_id: str, admin=Depends(require_admin)):
    db.reports.delete_one({"id": report_id})
    return {"status": "deleted"}
