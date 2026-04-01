import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr

from app.core.db import db
from app.core.auth import require_admin, generate_secure_token, hash_token
from app.core.audit import write_audit
from app.core.email_utils import send_email, FRONTEND_URL, invite_email_html

router = APIRouter()

ALLOWED_TAGS = [
    "founder", "rager", "investor", "operator",
    "expert", "mentor", "sponsor", "press",
]

ALLOWED_STATUSES = {"cold", "contacted", "approved", "invited", "engaged", "inactive"}
INVITE_EXPIRY_HOURS = 72


def _clean_tags(tags: list) -> list:
    return [t.lower() for t in tags if t.lower() in ALLOWED_TAGS]

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _strip(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc

# ── display_role (derived, never stored) ─────────────────────────────────────

def _display_role(contact: dict) -> str:
    if contact.get("user_id"):
        user = db.users.find_one({"id": contact["user_id"]}, {"role": 1, "_id": 0})
        if user:
            return user["role"]
    tags = contact.get("tags", [])
    for preferred in ("founder", "rager", "investor", "operator", "expert", "mentor", "sponsor", "press"):
        if preferred in tags:
            return preferred
    return tags[0] if tags else "unknown"

# ── Request models ────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name:    str
    email:   EmailStr
    phone:   Optional[str]  = None
    company: Optional[str]  = None
    title:   Optional[str]  = None
    city:    Optional[str]  = None
    tags:    Optional[List[str]] = []
    source:  Optional[str]  = "admin_manual"
    notes:   Optional[str]  = None

class ContactUpdate(BaseModel):
    name:    Optional[str]  = None
    phone:   Optional[str]  = None
    company: Optional[str]  = None
    title:   Optional[str]  = None
    city:    Optional[str]  = None
    tags:    Optional[List[str]] = None
    notes:   Optional[str]  = None

class StatusUpdate(BaseModel):
    status: str

class InviteRequest(BaseModel):
    role: str   # "founder" | "rager"

# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/admin/contacts")
def list_contacts(
    status: Optional[str] = Query(None),
    tag:    Optional[str] = Query(None),
    city:   Optional[str] = Query(None),
    q:      Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(50, ge=1, le=200),
    _admin = Depends(require_admin),
):
    query: dict = {"is_deleted": False}
    if status:
        query["status"] = status
    if tag:
        query["tags"] = tag
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if q:
        query["$or"] = [
            {"name":    {"$regex": q, "$options": "i"}},
            {"email":   {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
        ]

    total = db.contacts.count_documents(query)
    docs = list(
        db.contacts.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    for doc in docs:
        doc["display_role"] = _display_role(doc)

    return {
        "contacts": docs,
        "total":    total,
        "page":     page,
        "pages":    max(1, -(-total // limit)),  # ceiling division
    }

# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/admin/contacts", status_code=201)
def create_contact(payload: ContactCreate, _admin = Depends(require_admin)):
    email = payload.email.lower().strip()

    if db.contacts.find_one({"email": email, "is_deleted": False}):
        raise HTTPException(status_code=409, detail="A contact with this email already exists")

    now = _now()
    doc = {
        "id":                str(uuid.uuid4()),
        "name":              payload.name.strip(),
        "email":             email,
        "phone":             payload.phone,
        "company":           payload.company,
        "title":             payload.title,
        "city":              payload.city,
        "tags":              _clean_tags(payload.tags or []),
        "source":            payload.source or "admin_manual",
        "status":            "cold",
        "user_id":           None,
        "notes":             payload.notes,
        "last_activity_at":  now,
        "last_contacted_at": None,
        "is_deleted":        False,
        "created_at":        now,
        "updated_at":        now,
    }
    db.contacts.insert_one(doc)
    doc.pop("_id", None)
    doc["display_role"] = _display_role(doc)
    return doc

# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/admin/contacts/{contact_id}")
def get_contact(contact_id: str, _admin = Depends(require_admin)):
    contact = db.contacts.find_one(
        {"id": contact_id, "is_deleted": False}, {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact["display_role"] = _display_role(contact)

    # Attach related records
    contact["user"] = None
    if contact.get("user_id"):
        u = db.users.find_one({"id": contact["user_id"]}, {"_id": 0, "password_hash": 0})
        contact["user"] = u

    contact["requests"] = list(
        db.founder_requests.find({"contact_id": contact_id}, {"_id": 0})
        .sort("created_at", -1).limit(10)
    )

    contact["rager_profile"] = db.ragers.find_one(
        {"contact_id": contact_id}, {"_id": 0, "password_hash": 0, "phone": 0}
    )

    return contact

# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/admin/contacts/{contact_id}")
def update_contact(contact_id: str, payload: ContactUpdate, _admin = Depends(require_admin)):
    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    updates: dict = {"updated_at": _now()}
    if payload.name    is not None: updates["name"]    = payload.name.strip()
    if payload.phone   is not None: updates["phone"]   = payload.phone
    if payload.company is not None: updates["company"] = payload.company
    if payload.title   is not None: updates["title"]   = payload.title
    if payload.city    is not None: updates["city"]    = payload.city
    if payload.notes   is not None: updates["notes"]   = payload.notes
    if payload.tags    is not None: updates["tags"]    = _clean_tags(payload.tags)

    db.contacts.update_one({"id": contact_id}, {"$set": updates})
    updated = db.contacts.find_one({"id": contact_id}, {"_id": 0})
    updated["display_role"] = _display_role(updated)
    return updated

# ── Update status ─────────────────────────────────────────────────────────────

@router.patch("/admin/contacts/{contact_id}/status")
def update_contact_status(
    contact_id: str,
    payload: StatusUpdate,
    _admin = Depends(require_admin),
):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(ALLOWED_STATUSES)}",
        )
    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"status": payload.status, "updated_at": _now()}},
    )
    updated = db.contacts.find_one({"id": contact_id}, {"_id": 0})
    updated["display_role"] = _display_role(updated)
    return updated

# ── Soft delete ───────────────────────────────────────────────────────────────

@router.delete("/admin/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: str, _admin = Depends(require_admin)):
    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"is_deleted": True, "status": "inactive", "updated_at": _now()}},
    )

# ── Invite ────────────────────────────────────────────────────────────────────

@router.post("/admin/contacts/{contact_id}/invite")
def invite_contact(
    contact_id: str,
    payload: InviteRequest,
    admin = Depends(require_admin),
):
    if payload.role not in ("founder", "rager", "admin"):
        raise HTTPException(status_code=400, detail="role must be founder, rager, or admin")

    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    email = contact["email"]
    now   = _now()

    # Check if user already exists
    existing_user = db.users.find_one({"email": email}, {"_id": 0})
    if existing_user and existing_user.get("status") == "active":
        raise HTTPException(status_code=409, detail="This contact already has an active account")

    # Gate: first-time invite requires explicit admin approval
    if not existing_user and contact.get("status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Contact must be approved for login before sending an invite",
        )

    plain_token = generate_secure_token()
    token_hash  = hash_token(plain_token)
    expires     = (datetime.now(timezone.utc) + timedelta(hours=INVITE_EXPIRY_HOURS)).isoformat()

    # If role=rager, find linked rager profile (for cross-linking after user is created)
    rager_profile = None
    if payload.role == "rager":
        rager_profile = db.ragers.find_one(
            {"$or": [{"contact_id": contact_id}, {"email": email}]}, {"_id": 0}
        )

    if existing_user:
        # Re-invite pending_setup user
        user_id = existing_user["id"]
        user_updates: dict = {
            "invite_token_hash":    token_hash,
            "invite_token_expires": expires,
            "invite_sent_at":       now,
            "role":                 payload.role,
            "updated_at":           now,
        }
        if rager_profile and not existing_user.get("rager_id"):
            user_updates["rager_id"] = rager_profile["id"]
        db.users.update_one({"id": user_id}, {"$set": user_updates})
    else:
        # Create new user record (no password yet)
        user_id = str(uuid.uuid4())
        new_user: dict = {
            "id":                    user_id,
            "contact_id":            contact_id,
            "email":                 email,
            "name":                  contact["name"],
            "password_hash":         None,
            "role":                  payload.role,
            "status":                "pending_setup",
            "invite_token_hash":     token_hash,
            "invite_token_expires":  expires,
            "invite_sent_at":        now,
            "reset_token_hash":      None,
            "reset_token_expires":   None,
            "failed_login_attempts": 0,
            "locked_at":             None,
            "last_login_at":         None,
            "created_at":            now,
            "updated_at":            now,
        }
        if rager_profile:
            new_user["rager_id"] = rager_profile["id"]
        db.users.insert_one(new_user)
        db.contacts.update_one(
            {"id": contact_id},
            {"$set": {"user_id": user_id, "updated_at": now}},
        )

    # Cross-link: ensure rager profile has contact_id set
    if rager_profile and not rager_profile.get("contact_id"):
        db.ragers.update_one(
            {"id": rager_profile["id"]},
            {"$set": {"contact_id": contact_id}},
        )

    # Update contact status
    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "status":            "invited",
            "last_contacted_at": now,
            "updated_at":        now,
        }},
    )

    setup_url = f"{FRONTEND_URL}/setup-account?token={plain_token}"
    send_email(
        to_email=email,
        to_name=contact["name"],
        template="invite_setup",
        subject="You've been invited to RAGE",
        html_body=invite_email_html(contact["name"], setup_url, payload.role),
        entity_type="contact",
        entity_id=contact_id,
    )

    write_audit(
        action="invite.sent",
        entity_type="user",
        entity_id=user_id,
        metadata={
            "role":              payload.role,
            "invite_expires_at": expires,
            "contact_id":        contact_id,
        },
        actor=admin,
    )

    return {"ok": True, "invite_expires_at": expires, "user_id": user_id}


# ── Resend invite ─────────────────────────────────────────────────────────────

@router.post("/admin/contacts/{contact_id}/resend-invite")
def resend_invite(contact_id: str, admin = Depends(require_admin)):
    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    user = db.users.find_one(
        {"contact_id": contact_id, "status": "pending_setup"}, {"_id": 0}
    )
    if not user:
        raise HTTPException(
            status_code=400,
            detail="No pending invite for this contact — use invite first",
        )

    now             = _now()
    prev_expires    = user.get("invite_token_expires")
    plain_token     = generate_secure_token()
    token_hash      = hash_token(plain_token)
    new_expires     = (datetime.now(timezone.utc) + timedelta(hours=INVITE_EXPIRY_HOURS)).isoformat()

    db.users.update_one({"id": user["id"]}, {"$set": {
        "invite_token_hash":    token_hash,
        "invite_token_expires": new_expires,
        "invite_sent_at":       now,
        "updated_at":           now,
    }})

    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"last_contacted_at": now, "updated_at": now}},
    )

    setup_url = f"{FRONTEND_URL}/setup-account?token={plain_token}"
    send_email(
        to_email=contact["email"],
        to_name=contact["name"],
        template="invite_setup",
        subject="Your RAGE account setup link",
        html_body=invite_email_html(contact["name"], setup_url, user.get("role", "founder")),
        entity_type="contact",
        entity_id=contact_id,
    )

    write_audit(
        action="invite.resent",
        entity_type="user",
        entity_id=user["id"],
        metadata={
            "invite_expires_at":          new_expires,
            "previous_invite_expires_at": prev_expires,
        },
        actor=admin,
    )

    return {"ok": True, "invite_expires_at": new_expires}
