"""
Rager Portal Authentication
============================
Ragers log in with email + password at /rager-login.
Authentication runs against the users collection (role=rager).
JWT issued with sub=user.id and rager_id claim.
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.db import db
from app.core.auth import (
    verify_password, hash_password, validate_password_strength,
    create_rager_token, require_rager, MAX_LOGIN_ATTEMPTS,
)

router = APIRouter()


class RagerLoginRequest(BaseModel):
    email:       str
    password:    str
    remember_me: bool = False

class RagerProfileUpdate(BaseModel):
    title:        Optional[str]       = None
    company:      Optional[str]       = None
    bio:          Optional[str]       = None
    location:     Optional[str]       = None
    linkedin:     Optional[str]       = None
    photo_url:    Optional[str]       = None
    expertise:    Optional[List[str]] = None
    table_types:  Optional[List[str]] = None
    availability: Optional[str]       = None

class RagerChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
    confirm_password: str


@router.post("/rager/login")
def rager_login(data: RagerLoginRequest):
    email = data.email.lower().strip()
    user  = db.users.find_one({"email": email, "role": "rager"}, {"_id": 0})

    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    status = user.get("status", "active")
    if status == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    if status == "locked":
        raise HTTPException(status_code=423, detail="Account locked — contact admin")
    if status == "pending_setup":
        raise HTTPException(
            status_code=403,
            detail="Account not activated — check your email for the setup link",
        )

    if not verify_password(data.password, user["password_hash"]):
        attempts = user.get("failed_login_attempts", 0) + 1
        update: dict = {"failed_login_attempts": attempts}
        if attempts >= MAX_LOGIN_ATTEMPTS:
            update["status"]    = "locked"
            update["locked_at"] = datetime.now(timezone.utc).isoformat()
        db.users.update_one({"id": user["id"]}, {"$set": update})
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=423,
                detail="Account locked after too many failed attempts — contact admin",
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    rager_id = user.get("rager_id")
    if not rager_id:
        raise HTTPException(status_code=403, detail="No rager profile linked to this account — contact admin")

    rager = db.ragers.find_one({"id": rager_id}, {"_id": 0})
    if not rager:
        raise HTTPException(status_code=403, detail="Rager profile not found — contact admin")

    db.users.update_one({"id": user["id"]}, {"$set": {
        "failed_login_attempts": 0,
        "last_login_at":         datetime.now(timezone.utc).isoformat(),
    }})

    token = create_rager_token(user, rager_id)
    safe  = {k: v for k, v in rager.items() if k not in ("password_hash", "phone")}
    return {"access_token": token, "token_type": "bearer", "rager": safe}


@router.get("/rager/me")
def rager_me(rager: dict = Depends(require_rager)):
    return {k: v for k, v in rager.items() if k not in ("password_hash", "phone")}


@router.get("/rager/allocations")
def rager_allocations(rager: dict = Depends(require_rager)):
    allocations = list(db.allocations.find({"rager_id": rager["id"]}, {"_id": 0}))
    result = []
    for alloc in allocations:
        enq = db.enquiries.find_one({"id": alloc["enquiry_id"]}, {"_id": 0}) or {}
        result.append({
            **alloc,
            "enquiry": {
                "format":     enq.get("format", ""),
                "challenge":  enq.get("challenge") or enq.get("message", ""),
                "categories": enq.get("categories", []),
                "created_at": enq.get("created_at", ""),
            }
        })
    result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return result


@router.put("/rager/profile")
def update_rager_profile(payload: RagerProfileUpdate, rager: dict = Depends(require_rager)):
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.title        is not None: updates["title"]        = payload.title
    if payload.company      is not None: updates["company"]      = payload.company
    if payload.bio          is not None: updates["bio"]          = payload.bio
    if payload.location     is not None: updates["location"]     = payload.location
    if payload.linkedin     is not None: updates["linkedin"]     = payload.linkedin
    if payload.photo_url    is not None: updates["photo_url"]    = payload.photo_url
    if payload.expertise    is not None: updates["expertise"]    = payload.expertise
    if payload.table_types  is not None: updates["table_types"]  = payload.table_types
    if payload.availability is not None: updates["availability"] = payload.availability

    db.ragers.update_one({"id": rager["id"]}, {"$set": updates})
    updated = db.ragers.find_one({"id": rager["id"]}, {"_id": 0})
    return {k: v for k, v in updated.items() if k not in ("password_hash", "phone")}


@router.post("/rager/change-password")
def rager_change_password(payload: RagerChangePasswordRequest, rager: dict = Depends(require_rager)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    err = validate_password_strength(payload.new_password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    user = db.users.find_one({"rager_id": rager["id"], "role": "rager"}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="User account not found")

    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash": hash_password(payload.new_password),
        "updated_at":    datetime.now(timezone.utc).isoformat(),
    }})

    return {"ok": True}


@router.post("/rager/allocations/{allocation_id}/respond")
def rager_respond_dashboard(allocation_id: str, data: dict, rager: dict = Depends(require_rager)):
    response = data.get("response")
    if response not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="response must be 'accept' or 'decline'")

    alloc = db.allocations.find_one({"id": allocation_id, "rager_id": rager["id"]}, {"_id": 0})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc["status"] != "pending_rager":
        raise HTTPException(status_code=400, detail="Already responded to this request")

    new_status = "rager_accepted" if response == "accept" else "rager_declined"
    db.allocations.update_one(
        {"id": allocation_id},
        {"$set": {"status": new_status, "rager_responded_at": datetime.now(timezone.utc).isoformat()}}
    )

    enquiry_id = alloc["enquiry_id"]
    pending = db.allocations.count_documents({"enquiry_id": enquiry_id, "status": "pending_rager"})
    if pending == 0:
        db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder"}})

    return {"status": new_status}
