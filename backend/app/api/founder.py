"""
Founder-facing endpoints — authenticated, role: founder (or any logged-in user).
Returns only data that belongs to the requesting user.
"""
from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.core.db import db

router = APIRouter()

# Status labels shown to founders (internal → human readable)
FOUNDER_STATUS = {
    "new":              "Received",
    "matching":         "Under Review",
    "pending_rager":    "Finding Advisors",
    "pending_founder":  "Advisors Ready",
    "confirmed":        "Confirmed",
    "declined":         "No Match Found",
    "closed":           "Closed",
}


@router.get("/founders/enquiries")
def get_founder_enquiries(user: dict = Depends(get_current_user)):
    """Return all enquiries belonging to the current user (by user_id or email match)."""
    email = user.get("email", "").lower().strip()
    user_id = user.get("id", "")

    enquiries = list(db.enquiries.find(
        {"$or": [
            {"user_id": user_id},
            {"email": {"$regex": f"^{email}$", "$options": "i"}},
        ]},
        {"_id": 0},
    ).sort("created_at", -1))

    for enq in enquiries:
        allocations = list(db.allocations.find(
            {"enquiry_id": enq["id"]},
            {"_id": 0},
        ))

        enq["founder_status"] = FOUNDER_STATUS.get(enq.get("status", "new"), enq.get("status", "new"))

        # Attach allocation summary — anonymize rager until confirmed
        enq["advisors"] = []
        for a in allocations:
            if a["status"] == "confirmed":
                rager = db.ragers.find_one(
                    {"id": a["rager_id"]},
                    {"_id": 0, "password_hash": 0, "phone": 0}
                ) or {}
                enq["advisors"].append({
                    "status": "confirmed",
                    "name": rager.get("name", a["rager_name"]),
                    "title": rager.get("title", ""),
                    "company": rager.get("company", ""),
                    "email": rager.get("email", a.get("rager_email", "")),
                    "bio": rager.get("bio", ""),
                    "categories": rager.get("categories", []),
                })
        # Remove internal allocation list to keep response clean
        enq.pop("allocations", None)

    return enquiries
