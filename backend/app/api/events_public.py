"""
Private Table — Public token-gated endpoints.
No authentication required. All access controlled by invite token.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.db import db
from app.core.auth import hash_token

router = APIRouter()

_NOW = lambda: datetime.now(timezone.utc).isoformat()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_token(plain_token: str) -> dict:
    """Look up invite by hashed token. Raises 404 if not found."""
    hashed = hash_token(plain_token)
    inv = db.invites.find_one({"token": hashed}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    return inv


def _public_event(event_id: str) -> dict:
    ev = db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    # Strip admin-only fields
    ev.pop("created_by", None)
    ev.pop("pre_read_content", None)
    return ev


# ─── Pydantic models ──────────────────────────────────────────────────────────

class RsvpIn(BaseModel):
    attending: bool
    dietary: Optional[str] = ""
    message: Optional[str] = ""


class PrereadIn(BaseModel):
    one_liner: str
    current_focus: str
    bring_to_table: str
    looking_for: str
    open_question: Optional[str] = ""


# ─── RSVP ─────────────────────────────────────────────────────────────────────

@router.get("/public/rsvp/{token}")
def get_rsvp_page(token: str):
    """Return event info for the RSVP page. Token identifies the invitee."""
    inv = _resolve_token(token)
    ev = _public_event(inv["event_id"])
    return {
        "event":       ev,
        "invite": {
            "id":           inv["id"],
            "name":         inv["name"],
            "rsvp_status":  inv.get("rsvp_status", "pending"),
            "preread_submitted": inv.get("preread_submitted", False),
        },
    }


@router.post("/public/rsvp/{token}")
def submit_rsvp(token: str, data: RsvpIn):
    """Submit RSVP yes or no."""
    inv = _resolve_token(token)

    if inv.get("rsvp_status") not in ("pending", "yes", "no"):
        raise HTTPException(status_code=400, detail="RSVP is no longer editable")

    status = "yes" if data.attending else "no"
    db.invites.update_one(
        {"id": inv["id"]},
        {"$set": {
            "rsvp_status": status,
            "rsvp_at":     _NOW(),
            "dietary":     data.dietary,
            "rsvp_message": data.message,
        }}
    )
    return {
        "rsvp_status": status,
        "message": "Thank you — we look forward to seeing you." if data.attending
                   else "Thanks for letting us know.",
    }


# ─── Pre-read form ────────────────────────────────────────────────────────────

@router.get("/public/preread/{token}")
def get_preread_form(token: str):
    """Return pre-read form info. Only accessible after RSVP yes."""
    inv = _resolve_token(token)

    if inv.get("rsvp_status") != "yes":
        raise HTTPException(
            status_code=403,
            detail="Pre-read form is only available after confirming attendance"
        )

    ev = _public_event(inv["event_id"])
    existing = db.prereads.find_one({"invite_id": inv["id"]}, {"_id": 0})

    return {
        "event": {
            "title":    ev.get("title"),
            "date":     ev.get("date"),
            "theme":    ev.get("theme"),
            "location": ev.get("location"),
        },
        "invite": {
            "name":    inv["name"],
            "company": inv.get("company", ""),
            "title":   inv.get("title", ""),
        },
        "submitted":    existing is not None,
        "existing":     existing,
    }


@router.post("/public/preread/{token}")
def submit_preread(token: str, data: PrereadIn):
    """Submit or update the pre-read form."""
    inv = _resolve_token(token)

    if inv.get("rsvp_status") != "yes":
        raise HTTPException(
            status_code=403,
            detail="Pre-read form is only available after confirming attendance"
        )

    import uuid
    existing = db.prereads.find_one({"invite_id": inv["id"]})

    preread = {
        "event_id":       inv["event_id"],
        "invite_id":      inv["id"],
        "name":           inv["name"],
        "company":        inv.get("company", ""),
        "role":           inv.get("title", ""),
        "one_liner":      data.one_liner,
        "current_focus":  data.current_focus,
        "bring_to_table": data.bring_to_table,
        "looking_for":    data.looking_for,
        "open_question":  data.open_question,
        "submitted_at":   _NOW(),
    }

    if existing:
        db.prereads.update_one({"invite_id": inv["id"]}, {"$set": preread})
    else:
        preread["id"] = str(uuid.uuid4())
        db.prereads.insert_one(preread)
        db.invites.update_one(
            {"id": inv["id"]},
            {"$set": {"preread_submitted": True}}
        )

    return {"submitted": True, "message": "Pre-read submitted. See you at the table."}


# ─── Pre-read package view ────────────────────────────────────────────────────

@router.get("/public/preread-view/{token}")
def get_preread_package(token: str):
    """
    Pre-read package for confirmed guests.
    Shows all confirmed guests' public pre-reads.
    Open questions stay admin-only.
    """
    inv = _resolve_token(token)

    if inv.get("rsvp_status") != "yes":
        raise HTTPException(
            status_code=403,
            detail="Pre-read package is only available to confirmed guests"
        )

    ev = db.events.find_one({"id": inv["event_id"]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    # Confirmed guests
    confirmed_invites = list(db.invites.find(
        {"event_id": inv["event_id"], "rsvp_status": "yes"},
        {"_id": 0}
    ))
    confirmed_ids = {i["id"] for i in confirmed_invites}
    invite_by_id  = {i["id"]: i for i in confirmed_invites}

    # Pre-reads for confirmed guests (strip open_question)
    prereads = list(db.prereads.find(
        {"invite_id": {"$in": list(confirmed_ids)}},
        {"_id": 0, "open_question": 0}
    ))
    for pr in prereads:
        inv_data = invite_by_id.get(pr.get("invite_id"), {})
        pr["guest_type"] = inv_data.get("guest_type", "guest")

    # Guests who haven't submitted a pre-read yet
    submitted_invite_ids = {pr["invite_id"] for pr in prereads}
    no_preread = [
        {
            "invite_id": i["id"],
            "name":      i["name"],
            "company":   i.get("company", ""),
            "role":      i.get("title", ""),
            "guest_type": i.get("guest_type", "guest"),
        }
        for i in confirmed_invites
        if i["id"] not in submitted_invite_ids
    ]

    return {
        "event": {
            "title":             ev.get("title"),
            "date":              ev.get("date"),
            "location":          ev.get("location"),
            "theme":             ev.get("theme"),
            "dress_code":        ev.get("dress_code"),
            "pre_read_content":  ev.get("pre_read_content", {}),
        },
        "total_confirmed": len(confirmed_ids),
        "prereads":         prereads,
        "pending_prereads": no_preread,
    }
