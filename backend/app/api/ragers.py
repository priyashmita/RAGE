import uuid
import os
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import db
from app.core.auth import require_admin, generate_secure_token, hash_token
from app.core.email_utils import send_email, FRONTEND_URL, invite_email_html

router = APIRouter()

CATEGORIES = [
    "Finance & Fundraising",
    "Legal & Compliance",
    "Marketing & Brand",
    "Operations & Scale",
    "Technology & Product",
    "Strategy & Growth",
    "People & Culture",
    "Sales & Distribution",
    "Media & Communications",
    "International Expansion",
]

KEYWORD_MAP = {
    "Finance & Fundraising": ["finance", "funding", "investor", "vc", "venture", "fundrais", "cfo", "investment", "capital", "equity", "fund", "banking", "pe", "angel"],
    "Legal & Compliance": ["legal", "lawyer", "attorney", "compliance", "regulatory", "law", "counsel", "ip", "patent", "trademark", "contract", "advocate"],
    "Marketing & Brand": ["marketing", "brand", "growth", "digital", "content", "social media", "cmo", "advertis", "pr", "communications", "campaign", "seo", "creative"],
    "Operations & Scale": ["operations", "supply chain", "logistics", "process", "coo", "manufacturing", "scale", "procurement", "execution"],
    "Technology & Product": ["technology", "tech", "product", "engineering", "software", "cto", "developer", "data", "ai", "ml", "saas", "platform", "architect"],
    "Strategy & Growth": ["strategy", "consulting", "management", "ceo", "founder", "business development", "growth", "transformation", "advisory"],
    "People & Culture": ["hr", "human resources", "people", "talent", "culture", "recrui", "organization", "dei", "inclusion"],
    "Sales & Distribution": ["sales", "distribution", "retail", "b2b", "revenue", "channel", "partnership", "business development", "gtm"],
    "Media & Communications": ["media", "journalist", "editor", "film", "documentary", "publishing", "communications", "press", "television", "broadcast"],
    "International Expansion": ["international", "global", "export", "overseas", "cross-border", "expansion", "foreign", "eu", "us", "uk"],
}


class RagerIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    photo_url: Optional[str] = ""
    title: Optional[str] = ""
    company: Optional[str] = ""
    bio: Optional[str] = ""
    expertise: Optional[List[str]] = []
    categories: Optional[List[str]] = []
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    is_public: Optional[bool] = False
    table_types: Optional[List[str]] = []
    availability: Optional[str] = "available"
    contact_id: Optional[str] = None


def _keyword_categorize(text: str) -> List[str]:
    text_lower = text.lower()
    cats = []
    for cat, keywords in KEYWORD_MAP.items():
        if any(kw in text_lower for kw in keywords):
            cats.append(cat)
    return cats[:3] if cats else ["Strategy & Growth"]


def _ai_categorize(name: str, title: str, bio: str, expertise: list) -> List[str]:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return _keyword_categorize(f"{title} {bio} {' '.join(expertise)}")

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))

        prompt = f"""Categorize this advisor for a women founders network in India.

Name: {name}
Title: {title}
Bio: {bio}
Expertise: {', '.join(expertise) if expertise else 'Not listed'}

Pick 1–3 categories from this exact list:
{chr(10).join(f'- {c}' for c in CATEGORIES)}

Return ONLY a JSON array, e.g. ["Finance & Fundraising", "Strategy & Growth"]"""

        response = model.generate_content(prompt)
        text = response.text.strip().strip("```json").strip("```").strip()
        categories = json.loads(text)
        return [c for c in categories if c in CATEGORIES]
    except Exception:
        return _keyword_categorize(f"{title} {bio} {' '.join(expertise)}")


@router.get("/admin/ragers")
def list_ragers(admin=Depends(require_admin)):
    ragers = list(db.ragers.find({}, {"_id": 0}))

    # Batch-derive login_status for each rager
    contact_ids = [r["contact_id"] for r in ragers if r.get("contact_id")]
    contacts = {}
    if contact_ids:
        contacts = {c["id"]: c for c in db.contacts.find({"id": {"$in": contact_ids}}, {"_id": 0})}

    user_ids = [c["user_id"] for c in contacts.values() if c.get("user_id")]
    users = {}
    if user_ids:
        users = {u["id"]: u for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0})}

    for r in ragers:
        contact = contacts.get(r.get("contact_id"))
        if not contact:
            r["login_status"] = "no_contact"
        elif not contact.get("user_id"):
            r["login_status"] = "approved" if contact.get("status") == "approved" else "not_approved"
        else:
            user = users.get(contact["user_id"])
            r["login_status"] = user.get("status", "active") if user else "not_approved"

    return ragers


@router.post("/admin/ragers")
def create_rager(data: RagerIn, admin=Depends(require_admin)):
    doc = data.dict()
    doc["id"] = str(uuid.uuid4())

    # Auto-link contact by email if contact_id not provided
    if not doc.get("contact_id") and doc.get("email"):
        contact = db.contacts.find_one(
            {"email": doc["email"].lower().strip(), "is_deleted": False}, {"_id": 0}
        )
        if contact:
            doc["contact_id"] = contact["id"]

    db.ragers.insert_one(doc)
    doc.pop("_id", None)

    # Link user record: if there's a user with this email and role=rager, set rager_id
    if doc.get("email"):
        user = db.users.find_one(
            {"email": doc["email"].lower().strip(), "role": "rager"}, {"_id": 0}
        )
        if user and not user.get("rager_id"):
            db.users.update_one({"id": user["id"]}, {"$set": {"rager_id": doc["id"]}})

    return doc


@router.put("/admin/ragers/{rager_id}")
def update_rager(rager_id: str, data: RagerIn, admin=Depends(require_admin)):
    updates = data.dict()
    result = db.ragers.update_one({"id": rager_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rager not found")
    return {"status": "updated"}


@router.delete("/admin/ragers/{rager_id}")
def delete_rager(rager_id: str, admin=Depends(require_admin)):
    db.ragers.delete_one({"id": rager_id})
    return {"status": "deleted"}


@router.post("/admin/ragers/{rager_id}/create-contact")
def create_rager_contact(rager_id: str, admin=Depends(require_admin)):
    rager = db.ragers.find_one({"id": rager_id}, {"_id": 0})
    if not rager:
        raise HTTPException(status_code=404, detail="Rager not found")
    if not rager.get("email"):
        raise HTTPException(status_code=400, detail="Rager has no email — add email before creating contact")
    if rager.get("contact_id"):
        raise HTTPException(status_code=400, detail="Rager already has a linked contact")

    email = rager["email"].lower().strip()
    now   = datetime.now(timezone.utc).isoformat()

    # If a contact already exists for this email, just link it
    existing = db.contacts.find_one({"email": email, "is_deleted": False}, {"_id": 0})
    if existing:
        db.ragers.update_one({"id": rager_id}, {"$set": {"contact_id": existing["id"]}})
        return {"ok": True, "contact_id": existing["id"], "created": False}

    contact_id = str(uuid.uuid4())
    db.contacts.insert_one({
        "id":                contact_id,
        "name":              rager["name"],
        "email":             email,
        "phone":             rager.get("phone") or None,
        "company":           rager.get("company") or None,
        "title":             rager.get("title") or None,
        "city":              None,
        "tags":              ["rager"],
        "source":            "rager_profile",
        "status":            "cold",
        "user_id":           None,
        "notes":             None,
        "last_activity_at":  now,
        "last_contacted_at": None,
        "is_deleted":        False,
        "created_at":        now,
        "updated_at":        now,
    })
    db.ragers.update_one({"id": rager_id}, {"$set": {"contact_id": contact_id}})
    return {"ok": True, "contact_id": contact_id, "created": True}


@router.post("/admin/ragers/{rager_id}/approve-login")
def approve_and_invite_rager(rager_id: str, admin=Depends(require_admin)):
    """Approve rager for login AND send invite email in one atomic action."""
    rager = db.ragers.find_one({"id": rager_id}, {"_id": 0})
    if not rager:
        raise HTTPException(status_code=404, detail="Rager not found")
    if not rager.get("email"):
        raise HTTPException(status_code=400, detail="Rager has no email — add email before approving")

    # Resolve contact
    contact_id = rager.get("contact_id")
    if contact_id:
        contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=400, detail="Linked contact not found")
    else:
        contact = db.contacts.find_one(
            {"email": rager["email"].lower().strip(), "is_deleted": False}, {"_id": 0}
        )
        if not contact:
            raise HTTPException(
                status_code=400,
                detail="No contact record linked — create a contact for this rager first",
            )
        contact_id = contact["id"]
        db.ragers.update_one({"id": rager_id}, {"$set": {"contact_id": contact_id}})

    email = contact["email"]
    now   = datetime.now(timezone.utc).isoformat()

    # Block if already active
    existing_user = db.users.find_one({"email": email}, {"_id": 0})
    if existing_user and existing_user.get("status") == "active":
        raise HTTPException(status_code=400, detail="This rager already has an active account")

    plain_token = generate_secure_token()
    expires     = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
    setup_url   = f"{FRONTEND_URL}/setup-account?token={plain_token}"

    # ── Send email FIRST — only write to DB if it succeeds ────────────────────
    try:
        send_email(
            to_email=email,
            to_name=contact["name"],
            template="invite_setup",
            subject="You've been invited to RAGE",
            html_body=invite_email_html(contact["name"], setup_url, "rager"),
            entity_type="contact",
            entity_id=contact_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Email delivery failed — invite not created. Error: {str(exc)[:300]}",
        )

    # ── Email delivered — commit to DB ────────────────────────────────────────
    token_hash = hash_token(plain_token)

    if existing_user:
        user_id       = existing_user["id"]
        attempt_count = existing_user.get("invite_attempt_count", 0) + 1
        user_updates: dict = {
            "invite_token_hash":    token_hash,
            "invite_token_expires": expires,
            "invite_sent_at":       now,
            "role":                 "rager",
            "invite_attempt_count": attempt_count,
            "last_email_status":    "sent",
            "last_email_error":     None,
            "updated_at":           now,
        }
        if not existing_user.get("rager_id"):
            user_updates["rager_id"] = rager_id
        db.users.update_one({"id": user_id}, {"$set": user_updates})
    else:
        user_id = str(uuid.uuid4())
        db.users.insert_one({
            "id":                    user_id,
            "contact_id":            contact_id,
            "email":                 email,
            "name":                  contact["name"],
            "password_hash":         None,
            "role":                  "rager",
            "status":                "pending_setup",
            "rager_id":              rager_id,
            "invite_token_hash":     token_hash,
            "invite_token_expires":  expires,
            "invite_sent_at":        now,
            "invite_attempt_count":  1,
            "last_email_status":     "sent",
            "last_email_error":      None,
            "reset_token_hash":      None,
            "reset_token_expires":   None,
            "failed_login_attempts": 0,
            "locked_at":             None,
            "last_login_at":         None,
            "created_at":            now,
            "updated_at":            now,
        })
        db.contacts.update_one(
            {"id": contact_id},
            {"$set": {"user_id": user_id, "updated_at": now}},
        )

    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"status": "invited", "last_contacted_at": now, "updated_at": now}},
    )

    return {
        "ok":           True,
        "user_id":      user_id,
        "login_status": "pending_setup",
    }


@router.post("/admin/ragers/{rager_id}/resend-invite")
def resend_rager_invite(rager_id: str, admin=Depends(require_admin)):
    rager = db.ragers.find_one({"id": rager_id}, {"_id": 0})
    if not rager:
        raise HTTPException(status_code=404, detail="Rager not found")

    contact_id = rager.get("contact_id")
    if not contact_id:
        raise HTTPException(status_code=400, detail="No contact linked")

    contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=400, detail="Contact not found")

    user_id = contact.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="No user record — use Approve & Send Invite instead")

    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User record missing")
    if user.get("status") == "active":
        raise HTTPException(status_code=400, detail="Account already active")
    if user.get("status") == "disabled":
        raise HTTPException(status_code=400, detail="Account disabled — revoke first, then re-invite")

    now           = datetime.now(timezone.utc).isoformat()
    plain_token   = generate_secure_token()
    expires       = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
    setup_url     = f"{FRONTEND_URL}/setup-account?token={plain_token}"
    attempt_count = user.get("invite_attempt_count", 0) + 1

    # ── Send email FIRST — only update token if it succeeds ───────────────────
    try:
        send_email(
            to_email=contact["email"],
            to_name=contact["name"],
            template="invite_setup",
            subject="Your RAGE account setup link",
            html_body=invite_email_html(contact["name"], setup_url, "rager"),
            entity_type="contact",
            entity_id=contact_id,
        )
    except Exception as exc:
        db.users.update_one({"id": user_id}, {"$set": {
            "invite_attempt_count": attempt_count,
            "last_email_status":    "failed",
            "last_email_error":     str(exc)[:500],
            "updated_at":           now,
        }})
        raise HTTPException(
            status_code=502,
            detail="Email delivery failed — previous link unchanged. Retry or check Resend dashboard.",
        )

    db.users.update_one({"id": user_id}, {"$set": {
        "invite_token_hash":    hash_token(plain_token),
        "invite_token_expires": expires,
        "invite_sent_at":       now,
        "invite_attempt_count": attempt_count,
        "last_email_status":    "sent",
        "last_email_error":     None,
        "updated_at":           now,
    }})
    db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"last_contacted_at": now, "updated_at": now}},
    )

    return {"ok": True, "login_status": "pending_setup"}


@router.post("/admin/ragers/{rager_id}/revoke-invite")
def revoke_rager_invite(rager_id: str, admin=Depends(require_admin)):
    try:
        rager = db.ragers.find_one({"id": rager_id}, {"_id": 0})
        if not rager:
            raise HTTPException(status_code=404, detail="Rager not found")

        contact_id = rager.get("contact_id")
        if not contact_id:
            raise HTTPException(status_code=400, detail="No contact linked")

        contact = db.contacts.find_one({"id": contact_id, "is_deleted": False}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=400, detail="Contact not found")

        now     = datetime.now(timezone.utc).isoformat()
        user_id = contact.get("user_id")

        if user_id:
            user = db.users.find_one({"id": user_id}, {"_id": 0})
            if user and user.get("status") == "active":
                raise HTTPException(status_code=400, detail="Cannot revoke an active account")
            if user:
                db.users.update_one({"id": user_id}, {"$set": {
                    "status":               "disabled",
                    "invite_token_hash":    None,
                    "invite_token_expires": None,
                    "updated_at":           now,
                }})

        # Unlink user from contact, reset contact to approved so invite can be re-sent
        db.contacts.update_one(
            {"id": contact_id},
            {"$set": {"user_id": None, "status": "approved", "updated_at": now}},
        )

        return {"ok": True, "login_status": "approved"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"[revoke] {type(exc).__name__}: {exc}")


@router.post("/admin/ragers/{rager_id}/categorize")
def categorize_rager(rager_id: str, admin=Depends(require_admin)):
    rager = db.ragers.find_one({"id": rager_id})
    if not rager:
        raise HTTPException(status_code=404, detail="Rager not found")
    categories = _ai_categorize(
        rager.get("name", ""), rager.get("title", ""),
        rager.get("bio", ""), rager.get("expertise", [])
    )
    db.ragers.update_one({"id": rager_id}, {"$set": {"categories": categories}})
    return {"categories": categories}


@router.post("/admin/ragers/bulk")
def bulk_create(data: dict, admin=Depends(require_admin)):
    profiles = data.get("profiles", [])
    if not isinstance(profiles, list) or not profiles:
        raise HTTPException(status_code=400, detail="profiles array required")

    auto_categorize = data.get("auto_categorize", True)
    created = []

    for p in profiles:
        cats = p.get("categories", [])
        if auto_categorize and not cats:
            cats = _ai_categorize(
                p.get("name", ""), p.get("title", ""),
                p.get("bio", ""), p.get("expertise", [])
            )
        rager = {
            "id": str(uuid.uuid4()),
            "name": p.get("name", ""),
            "email": p.get("email", ""),
            "photo_url": p.get("photo_url", ""),
            "title": p.get("title", ""),
            "company": p.get("company", ""),
            "bio": p.get("bio", ""),
            "expertise": p.get("expertise", []),
            "categories": cats,
            "location": p.get("location", ""),
            "linkedin": p.get("linkedin", ""),
            "is_public": p.get("is_public", False),
            "table_types": p.get("table_types", []),
            "availability": p.get("availability", "available"),
        }
        db.ragers.insert_one(rager)
        rager.pop("_id", None)
        created.append(rager)

    return {"created": len(created), "ragers": created}


@router.get("/admin/stats")
def admin_stats(admin=Depends(require_admin)):
    return {
        "ragers": db.ragers.count_documents({}),
        "public_ragers": db.ragers.count_documents({"is_public": True}),
        "enquiries": db.enquiries.count_documents({}),
        "allocations": db.allocations.count_documents({}),
        "pending_allocations": db.allocations.count_documents({"status": "pending_rager"}),
        "users": db.users.count_documents({}),
    }


# Public endpoint for the network page — strips all contact info
@router.get("/public/ragers")
def public_ragers():
    return list(db.ragers.find({"is_public": True}, {"_id": 0, "email": 0, "phone": 0}))
