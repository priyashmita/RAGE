"""
Private Table — Event management (admin only).
Completely separate from Closed Table / Advisory logic.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import db
from app.core.auth import require_admin, generate_secure_token, hash_token
from app.core.email_utils import (
    send_email, FRONTEND_URL,
    event_invite_html, preread_request_html,
    event_confirmation_html, intro_email_html,
)

router = APIRouter()

_NOW = lambda: datetime.now(timezone.utc).isoformat()

# ─── Pydantic models ──────────────────────────────────────────────────────────

class EventIn(BaseModel):
    title: str
    date: str
    location: str
    capacity: Optional[int] = 20
    theme: Optional[str] = ""
    description: Optional[str] = ""
    dress_code: Optional[str] = ""
    pre_read_content: Optional[dict] = {}
    status: Optional[str] = "draft"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    theme: Optional[str] = None
    description: Optional[str] = None
    dress_code: Optional[str] = None
    pre_read_content: Optional[dict] = None
    status: Optional[str] = None


class GuestIn(BaseModel):
    rager_id: Optional[str] = None
    name: str
    email: str
    company: Optional[str] = ""
    title: Optional[str] = ""
    guest_type: str = "guest"   # founder | leader | guest
    notes: Optional[str] = ""


class GuestUpdate(BaseModel):
    rsvp_status: Optional[str] = None
    notes: Optional[str] = None
    guest_type: Optional[str] = None


class SendInvitesIn(BaseModel):
    invite_ids: Optional[List[str]] = None   # None = all unsent


class SendPrereadsIn(BaseModel):
    invite_ids: Optional[List[str]] = None   # None = all yes+unsent


class SendConfirmationIn(BaseModel):
    invite_ids: Optional[List[str]] = None   # None = all confirmed


class SeatingIn(BaseModel):
    tables: List[dict]           # [{table_id, label, seats:[invite_id]}]
    admin_notes: Optional[str] = ""
    is_final: Optional[bool] = False


class SeatingUpdate(BaseModel):
    tables: Optional[List[dict]] = None
    admin_notes: Optional[str] = None
    is_final: Optional[bool] = None


class IntroSendIn(BaseModel):
    invite_id_a: str
    invite_id_b: str
    message: Optional[str] = ""


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_event_or_404(event_id: str) -> dict:
    ev = db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


def _invite_summary(event_id: str) -> dict:
    invites = list(db.invites.find({"event_id": event_id}, {"_id": 0}))
    total = len(invites)
    yes   = sum(1 for i in invites if i.get("rsvp_status") == "yes")
    no    = sum(1 for i in invites if i.get("rsvp_status") == "no")
    pre   = sum(1 for i in invites if i.get("preread_submitted"))
    return {"total": total, "rsvp_yes": yes, "rsvp_no": no, "prereads": pre}


def _require_not_archived(ev: dict) -> None:
    """Raise 423 Locked if the event is archived. Call before any mutating action."""
    if ev.get("status") == "archived":
        raise HTTPException(
            status_code=423,
            detail="Event is archived. Restore it before taking this action.",
        )


# ─── Events CRUD ──────────────────────────────────────────────────────────────

@router.post("/admin/events")
def create_event(data: EventIn, admin=Depends(require_admin)):
    event = {
        "id":               str(uuid.uuid4()),
        "title":            data.title,
        "date":             data.date,
        "location":         data.location,
        "capacity":         data.capacity,
        "theme":            data.theme,
        "description":      data.description,
        "dress_code":       data.dress_code,
        "pre_read_content": data.pre_read_content or {},
        "status":           data.status or "draft",
        "created_at":       _NOW(),
        "created_by":       admin.get("id"),
    }
    db.events.insert_one(event)
    event.pop("_id", None)
    return event


@router.get("/admin/events")
def list_events(admin=Depends(require_admin)):
    events = list(db.events.find({}, {"_id": 0}).sort("date", -1))
    for ev in events:
        ev["_summary"] = _invite_summary(ev["id"])
    return events


@router.get("/admin/events/{event_id}")
def get_event(event_id: str, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    ev["_summary"] = _invite_summary(event_id)
    return ev


@router.put("/admin/events/{event_id}")
def update_event(event_id: str, data: EventUpdate, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if patch.get("status") == "archived":
        raise HTTPException(
            status_code=400,
            detail="Use the /archive endpoint to archive an event.",
        )
    patch["updated_at"] = _NOW()
    db.events.update_one({"id": event_id}, {"$set": patch})
    return db.events.find_one({"id": event_id}, {"_id": 0})


@router.delete("/admin/events/{event_id}")
def delete_event(event_id: str, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    if ev.get("status") not in ("draft", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="Only draft or cancelled events can be deleted"
        )
    db.events.delete_one({"id": event_id})
    db.invites.delete_many({"event_id": event_id})
    db.prereads.delete_many({"event_id": event_id})
    db.seatings.delete_many({"event_id": event_id})
    return {"deleted": True}


# ─── Archive / Restore ───────────────────────────────────────────────────────

@router.post("/admin/events/{event_id}/archive")
def archive_event(event_id: str, admin=Depends(require_admin)):
    """
    Archive an event. Preserves all data for audit/history.
    All public token links become inactive (410 Gone).
    No emails can be sent while archived.
    """
    ev = _get_event_or_404(event_id)
    if ev.get("status") == "archived":
        raise HTTPException(status_code=400, detail="Event is already archived")
    db.events.update_one({"id": event_id}, {"$set": {
        "status":             "archived",
        "archived_at":        _NOW(),
        "archived_by":        admin.get("id"),
        "pre_archive_status": ev.get("status"),   # remembered for reference
    }})
    return db.events.find_one({"id": event_id}, {"_id": 0})


@router.post("/admin/events/{event_id}/restore")
def restore_event(event_id: str, admin=Depends(require_admin)):
    """
    Restore an archived event to 'draft' status.
    Does not auto-send anything. Admin must take all actions explicitly.
    """
    ev = _get_event_or_404(event_id)
    if ev.get("status") != "archived":
        raise HTTPException(status_code=400, detail="Event is not archived")
    db.events.update_one({"id": event_id}, {"$set": {
        "status":      "draft",
        "restored_at": _NOW(),
        "restored_by": admin.get("id"),
    }})
    return db.events.find_one({"id": event_id}, {"_id": 0})


# ─── Guest / Invite management ────────────────────────────────────────────────

@router.post("/admin/events/{event_id}/guests")
def add_guest(event_id: str, data: GuestIn, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)

    # Prevent duplicate email per event
    existing = db.invites.find_one({"event_id": event_id, "email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Guest with this email already added")

    plain_token = generate_secure_token()
    invite = {
        "id":                str(uuid.uuid4()),
        "event_id":          event_id,
        "rager_id":          data.rager_id,
        "name":              data.name,
        "email":             data.email.lower(),
        "company":           data.company,
        "title":             data.title,
        "guest_type":        data.guest_type,
        "token":             hash_token(plain_token),
        "plain_token":       plain_token,   # stored temporarily for email dispatch
        "invited_at":        None,
        "invite_sent":       False,
        "rsvp_status":       "pending",
        "rsvp_at":           None,
        "preread_sent":      False,
        "preread_submitted": False,
        "notes":             data.notes,
        "created_at":        _NOW(),
    }
    db.invites.insert_one(invite)
    invite.pop("_id", None)
    return invite


@router.get("/admin/events/{event_id}/guests")
def list_guests(event_id: str, admin=Depends(require_admin)):
    _get_event_or_404(event_id)
    return list(db.invites.find({"event_id": event_id}, {"_id": 0}).sort("created_at", 1))


@router.patch("/admin/events/{event_id}/guests/{guest_id}")
def update_guest(event_id: str, guest_id: str, data: GuestUpdate, admin=Depends(require_admin)):
    inv = db.invites.find_one({"id": guest_id, "event_id": event_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Guest not found")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if patch:
        db.invites.update_one({"id": guest_id}, {"$set": patch})
    return db.invites.find_one({"id": guest_id}, {"_id": 0})


@router.delete("/admin/events/{event_id}/guests/{guest_id}")
def remove_guest(event_id: str, guest_id: str, admin=Depends(require_admin)):
    inv = db.invites.find_one({"id": guest_id, "event_id": event_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Guest not found")
    db.invites.delete_one({"id": guest_id})
    return {"deleted": True}


# ─── Email dispatch ───────────────────────────────────────────────────────────

@router.post("/admin/events/{event_id}/send-invites")
def send_invites(event_id: str, data: SendInvitesIn, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)

    query = {"event_id": event_id, "invite_sent": False}
    if data.invite_ids:
        query["id"] = {"$in": data.invite_ids}

    invites = list(db.invites.find(query, {"_id": 0}))
    if not invites:
        raise HTTPException(status_code=400, detail="No eligible guests to invite")

    results = []
    for inv in invites:
        plain_token = inv.get("plain_token") or generate_secure_token()
        rsvp_url = f"{FRONTEND_URL}/rsvp/{plain_token}"
        try:
            send_email(
                to_email=inv["email"],
                to_name=inv["name"],
                template="private_table_invite",
                subject=f"You're invited: {ev['title']}",
                html_body=event_invite_html(
                    name=inv["name"],
                    event_title=ev["title"],
                    event_date=ev.get("date", ""),
                    location=ev.get("location", ""),
                    theme=ev.get("theme", ""),
                    rsvp_url=rsvp_url,
                ),
                entity_type="invite",
                entity_id=inv["id"],
            )
            # If we generated a new token, store it hashed and save plaintext for further use
            update = {"invite_sent": True, "invited_at": _NOW()}
            if not inv.get("plain_token"):
                update["token"] = hash_token(plain_token)
                update["plain_token"] = plain_token
            db.invites.update_one({"id": inv["id"]}, {"$set": update})
            results.append({"id": inv["id"], "email": inv["email"], "sent": True})
        except Exception as exc:
            results.append({"id": inv["id"], "email": inv["email"], "sent": False, "error": str(exc)})

    return {"results": results}


@router.post("/admin/events/{event_id}/send-prereads")
def send_prereads(event_id: str, data: SendPrereadsIn, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)

    query = {"event_id": event_id, "rsvp_status": "yes", "preread_sent": False}
    if data.invite_ids:
        query["id"] = {"$in": data.invite_ids}

    invites = list(db.invites.find(query, {"_id": 0}))
    if not invites:
        raise HTTPException(status_code=400, detail="No eligible guests (need RSVP yes + pre-read not yet sent)")

    results = []
    for inv in invites:
        plain_token = inv.get("plain_token") or generate_secure_token()
        preread_url = f"{FRONTEND_URL}/preread/{plain_token}"
        try:
            send_email(
                to_email=inv["email"],
                to_name=inv["name"],
                template="private_table_preread",
                subject=f"Your pre-read for {ev['title']}",
                html_body=preread_request_html(
                    name=inv["name"],
                    event_title=ev["title"],
                    preread_url=preread_url,
                ),
                entity_type="invite",
                entity_id=inv["id"],
            )
            update = {"preread_sent": True}
            if not inv.get("plain_token"):
                update["token"] = hash_token(plain_token)
                update["plain_token"] = plain_token
            db.invites.update_one({"id": inv["id"]}, {"$set": update})
            results.append({"id": inv["id"], "email": inv["email"], "sent": True})
        except Exception as exc:
            results.append({"id": inv["id"], "email": inv["email"], "sent": False, "error": str(exc)})

    return {"results": results}


@router.post("/admin/events/{event_id}/send-confirmation")
def send_confirmation(event_id: str, data: SendConfirmationIn, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)

    query = {"event_id": event_id, "rsvp_status": "yes"}
    if data.invite_ids:
        query["id"] = {"$in": data.invite_ids}

    invites = list(db.invites.find(query, {"_id": 0}))
    if not invites:
        raise HTTPException(status_code=400, detail="No confirmed guests found")

    results = []
    for inv in invites:
        plain_token = inv.get("plain_token") or generate_secure_token()
        package_url = f"{FRONTEND_URL}/preread-view/{plain_token}"
        try:
            send_email(
                to_email=inv["email"],
                to_name=inv["name"],
                template="private_table_confirmation",
                subject=f"See you there — {ev['title']}",
                html_body=event_confirmation_html(
                    name=inv["name"],
                    event_title=ev["title"],
                    event_date=ev.get("date", ""),
                    location=ev.get("location", ""),
                    dress_code=ev.get("dress_code", ""),
                    package_url=package_url,
                ),
                entity_type="invite",
                entity_id=inv["id"],
            )
            if not inv.get("plain_token"):
                db.invites.update_one({"id": inv["id"]}, {"$set": {
                    "token": hash_token(plain_token),
                    "plain_token": plain_token,
                }})
            results.append({"id": inv["id"], "email": inv["email"], "sent": True})
        except Exception as exc:
            results.append({"id": inv["id"], "email": inv["email"], "sent": False, "error": str(exc)})

    return {"results": results}


# ─── Pre-reads ────────────────────────────────────────────────────────────────

@router.get("/admin/events/{event_id}/prereads")
def get_prereads(event_id: str, admin=Depends(require_admin)):
    _get_event_or_404(event_id)
    return list(db.prereads.find({"event_id": event_id}, {"_id": 0}).sort("submitted_at", 1))


# ─── Seating ──────────────────────────────────────────────────────────────────

@router.post("/admin/events/{event_id}/seating/suggest")
def suggest_seating(event_id: str, body: dict, admin=Depends(require_admin)):
    """
    Run the seating algorithm and return a suggestion.
    Does NOT save anything — admin reviews first.
    body: { "num_tables": int }
    """
    _get_event_or_404(event_id)
    num_tables = int(body.get("num_tables", 4))
    if num_tables < 1:
        raise HTTPException(status_code=400, detail="num_tables must be >= 1")

    invites = list(db.invites.find(
        {"event_id": event_id, "rsvp_status": "yes"},
        {"_id": 0}
    ))
    if not invites:
        raise HTTPException(status_code=400, detail="No confirmed guests (RSVP yes) to seat")

    tables = _seating_algorithm(invites, num_tables)
    return {"tables": tables, "total_guests": len(invites)}


def _seating_algorithm(guests: list, num_tables: int) -> list:
    """
    Greedy seating with type-mixing + same-company avoidance.
    Returns list of table dicts with guest summaries.
    """
    founders = [g for g in guests if g.get("guest_type") == "founder"]
    leaders  = [g for g in guests if g.get("guest_type") == "leader"]
    others   = [g for g in guests if g.get("guest_type") not in ("founder", "leader")]

    # Interleave types for round-robin assignment
    ordered = []
    fi = li = oi = 0
    while fi < len(founders) or li < len(leaders) or oi < len(others):
        if fi < len(founders):
            ordered.append(founders[fi]); fi += 1
        if li < len(leaders):
            ordered.append(leaders[li]); li += 1
        if oi < len(others):
            ordered.append(others[oi]); oi += 1

    tables = [[] for _ in range(num_tables)]
    for i, g in enumerate(ordered):
        tables[i % num_tables].append(g)

    # Swap to reduce same-company clashes
    for _ in range(100):
        improved = False
        for t1 in range(num_tables):
            for i, g1 in enumerate(tables[t1]):
                for t2 in range(t1 + 1, num_tables):
                    for j, g2 in enumerate(tables[t2]):
                        before = _company_clash(tables[t1]) + _company_clash(tables[t2])
                        tables[t1][i], tables[t2][j] = g2, g1
                        after = _company_clash(tables[t1]) + _company_clash(tables[t2])
                        if after < before:
                            improved = True
                        else:
                            tables[t1][i], tables[t2][j] = g1, g2
        if not improved:
            break

    result = []
    for idx, tguests in enumerate(tables):
        result.append({
            "table_id": f"T{idx + 1}",
            "label":    f"Table {idx + 1}",
            "seats":    [g["id"] for g in tguests],
            "guests":   [
                {
                    "id":         g["id"],
                    "name":       g["name"],
                    "company":    g.get("company", ""),
                    "title":      g.get("title", ""),
                    "guest_type": g.get("guest_type", "guest"),
                }
                for g in tguests
            ],
            "note": _table_note(tguests),
        })
    return result


def _company_clash(table: list) -> int:
    companies = [g.get("company", "").lower() for g in table if g.get("company")]
    return len(companies) - len(set(companies))


def _table_note(guests: list) -> str:
    founders = sum(1 for g in guests if g.get("guest_type") == "founder")
    leaders  = sum(1 for g in guests if g.get("guest_type") == "leader")
    companies = list({g.get("company", "") for g in guests if g.get("company")})
    f_str = f"{founders} founder{'s' if founders != 1 else ''}"
    l_str = f"{leaders} leader{'s' if leaders != 1 else ''}"
    c_str = ", ".join(companies[:4]) + ("…" if len(companies) > 4 else "")
    return f"{f_str}, {l_str}. {c_str}"


@router.post("/admin/events/{event_id}/seating")
def save_seating(event_id: str, data: SeatingIn, admin=Depends(require_admin)):
    _get_event_or_404(event_id)

    # Increment version
    latest = db.seatings.find_one(
        {"event_id": event_id},
        {"version": 1},
        sort=[("version", -1)]
    )
    version = (latest["version"] + 1) if latest else 1

    seating = {
        "id":          str(uuid.uuid4()),
        "event_id":    event_id,
        "version":     version,
        "tables":      data.tables,
        "admin_notes": data.admin_notes,
        "is_final":    data.is_final,
        "created_at":  _NOW(),
        "created_by":  admin.get("id"),
    }
    db.seatings.insert_one(seating)
    seating.pop("_id", None)
    return seating


@router.get("/admin/events/{event_id}/seating")
def get_seating(event_id: str, admin=Depends(require_admin)):
    _get_event_or_404(event_id)
    seating = db.seatings.find_one(
        {"event_id": event_id},
        {"_id": 0},
        sort=[("version", -1)]
    )
    if not seating:
        return None

    # Hydrate seats with guest info
    all_invites = {
        inv["id"]: inv
        for inv in db.invites.find({"event_id": event_id}, {"_id": 0})
    }
    for table in seating.get("tables", []):
        table["guests"] = [
            {
                "id":         iid,
                "name":       all_invites.get(iid, {}).get("name", ""),
                "company":    all_invites.get(iid, {}).get("company", ""),
                "title":      all_invites.get(iid, {}).get("title", ""),
                "guest_type": all_invites.get(iid, {}).get("guest_type", "guest"),
            }
            for iid in table.get("seats", [])
        ]
    return seating


@router.put("/admin/events/{event_id}/seating/{seating_id}")
def update_seating(event_id: str, seating_id: str, data: SeatingUpdate, admin=Depends(require_admin)):
    seat = db.seatings.find_one({"id": seating_id, "event_id": event_id})
    if not seat:
        raise HTTPException(status_code=404, detail="Seating plan not found")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if patch:
        patch["updated_at"] = _NOW()
        db.seatings.update_one({"id": seating_id}, {"$set": patch})
    return db.seatings.find_one({"id": seating_id}, {"_id": 0})


# ─── Intro Engine ─────────────────────────────────────────────────────────────

@router.get("/admin/events/{event_id}/intros")
def get_intro_suggestions(event_id: str, admin=Depends(require_admin)):
    """
    Return ranked pairs of confirmed guests based on pre-read keyword overlap.
    Admin reviews and selects which intros to send.
    """
    _get_event_or_404(event_id)

    invites = list(db.invites.find(
        {"event_id": event_id, "rsvp_status": "yes"},
        {"_id": 0}
    ))
    prereads = {
        pr["invite_id"]: pr
        for pr in db.prereads.find({"event_id": event_id}, {"_id": 0})
    }

    pairs = []
    for i, g1 in enumerate(invites):
        for g2 in invites[i + 1:]:
            score, reason = _intro_score(g1, g2, prereads)
            pairs.append({
                "guest_a": _guest_stub(g1),
                "guest_b": _guest_stub(g2),
                "score":   score,
                "reason":  reason,
            })

    pairs.sort(key=lambda x: x["score"], reverse=True)
    return pairs[:30]   # Top 30 pairs shown to admin


@router.post("/admin/events/{event_id}/intros/send")
def send_intro(event_id: str, data: IntroSendIn, admin=Depends(require_admin)):
    ev = _get_event_or_404(event_id)
    _require_not_archived(ev)

    inv_a = db.invites.find_one({"id": data.invite_id_a, "event_id": event_id}, {"_id": 0})
    inv_b = db.invites.find_one({"id": data.invite_id_b, "event_id": event_id}, {"_id": 0})
    if not inv_a or not inv_b:
        raise HTTPException(status_code=404, detail="One or both guests not found")

    pr_a = db.prereads.find_one({"invite_id": data.invite_id_a}, {"_id": 0}) or {}
    pr_b = db.prereads.find_one({"invite_id": data.invite_id_b}, {"_id": 0}) or {}

    rager_a = db.ragers.find_one({"id": inv_a["rager_id"]}, {"_id": 0}) if inv_a.get("rager_id") else {}
    rager_b = db.ragers.find_one({"id": inv_b["rager_id"]}, {"_id": 0}) if inv_b.get("rager_id") else {}

    linkedin_a = (rager_a or {}).get("linkedin", "")
    linkedin_b = (rager_b or {}).get("linkedin", "")

    blurb_a = pr_a.get("one_liner") or inv_a.get("title", "")
    blurb_b = pr_b.get("one_liner") or inv_b.get("title", "")

    reason = data.message or _intro_reason_text(inv_a, inv_b, pr_a, pr_b)

    errors = []
    for (inv, other, blurb, linkedin) in [
        (inv_a, inv_b, blurb_b, linkedin_b),
        (inv_b, inv_a, blurb_a, linkedin_a),
    ]:
        try:
            send_email(
                to_email=inv["email"],
                to_name=inv["name"],
                template="private_table_intro",
                subject=f"Meet {other['name']} — from {ev['title']}",
                html_body=intro_email_html(
                    to_name=inv["name"],
                    other_name=other["name"],
                    other_company=other.get("company", ""),
                    other_title=other.get("title", ""),
                    other_blurb=blurb,
                    other_linkedin=linkedin,
                    reason=reason,
                    event_title=ev["title"],
                ),
                entity_type="invite",
                entity_id=inv["id"],
            )
        except Exception as exc:
            errors.append({"email": inv["email"], "error": str(exc)})

    return {"sent": len(errors) == 0, "errors": errors}


def _guest_stub(inv: dict) -> dict:
    return {
        "id":         inv["id"],
        "name":       inv["name"],
        "company":    inv.get("company", ""),
        "title":      inv.get("title", ""),
        "guest_type": inv.get("guest_type", "guest"),
    }


def _intro_score(g1: dict, g2: dict, prereads: dict) -> tuple:
    pr1 = prereads.get(g1["id"], {})
    pr2 = prereads.get(g2["id"], {})

    looking1 = set(_keywords(pr1.get("looking_for", "")))
    bring1   = set(_keywords(pr1.get("bring_to_table", "")))
    looking2 = set(_keywords(pr2.get("looking_for", "")))
    bring2   = set(_keywords(pr2.get("bring_to_table", "")))

    forward  = len(looking1 & bring2)
    backward = len(looking2 & bring1)
    score    = forward + backward

    parts = []
    if forward:
        parts.append(f"{g1['name']} is looking for what {g2['name']} brings")
    if backward:
        parts.append(f"{g2['name']} is looking for what {g1['name']} brings")
    reason = "; ".join(parts) if parts else "Potential complementary match"

    return score, reason


def _intro_reason_text(inv_a: dict, inv_b: dict, pr_a: dict, pr_b: dict) -> str:
    _, reason = _intro_score(inv_a, inv_b, {inv_a["id"]: pr_a, inv_b["id"]: pr_b})
    return reason


def _keywords(text: str) -> list:
    stopwords = {
        "the", "a", "an", "and", "or", "for", "to", "in", "of", "with",
        "is", "are", "our", "we", "i", "my", "on", "at", "by", "from",
    }
    return [
        w for w in text.lower().split()
        if len(w) > 3 and w not in stopwords
    ]
