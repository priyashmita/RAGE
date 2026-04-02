from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

ALLOWED_SET_STATUSES = {"active", "locked", "disabled"}

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _safe_user(user: dict) -> dict:
    user.pop("_id", None)
    user.pop("password_hash", None)
    user.pop("invite_token_hash", None)
    user.pop("reset_token_hash", None)
    return user

class StatusUpdate(BaseModel):
    status: str

# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_users(
    role:   Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q:      Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(50, ge=1, le=200),
    _admin = Depends(require_admin),
):
    query: dict = {}
    if role:   query["role"]   = role
    if status: query["status"] = status
    if q:
        query["$or"] = [
            {"name":  {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]

    total = db.users.count_documents(query)
    docs  = list(
        db.users.find(query, {"_id": 0, "password_hash": 0,
                               "invite_token_hash": 0, "reset_token_hash": 0})
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    return {
        "users": docs,
        "total": total,
        "page":  page,
        "pages": max(1, -(-total // limit)),
    }

# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/admin/users/{user_id}")
def get_user(user_id: str, _admin = Depends(require_admin)):
    user = db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "invite_token_hash": 0, "reset_token_hash": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contact = None
    if user.get("contact_id"):
        contact = db.contacts.find_one(
            {"id": user["contact_id"], "is_deleted": False}, {"_id": 0}
        )

    return {"user": user, "contact": contact}

# ── Update status ─────────────────────────────────────────────────────────────

@router.patch("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: StatusUpdate,
    _admin  = Depends(require_admin),
):
    if payload.status not in ALLOWED_SET_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(ALLOWED_SET_STATUSES)}",
        )

    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates: dict = {"status": payload.status, "updated_at": _now()}

    if payload.status == "active":
        # Unlock also clears failed attempts and locked_at
        updates["failed_login_attempts"] = 0
        updates["locked_at"]             = None

    db.users.update_one({"id": user_id}, {"$set": updates})

    updated = db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "invite_token_hash": 0, "reset_token_hash": 0},
    )
    return updated

# ── Soft delete (disable) ─────────────────────────────────────────────────────

@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(user_id: str, _admin = Depends(require_admin)):
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin accounts via this endpoint")

    db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "disabled", "updated_at": _now()}},
    )
