"""
RAGE Matching Workflow
======================
Enquiry → Admin matches → Anon email to Ragers → Rager responds →
Admin notifies Founder → Founder picks → Confirmation email to all
"""
import uuid
import os
import secrets
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "https://rage-production.up.railway.app")
FROM_EMAIL = "R.A.G.E. <noreply@rageforchange.com>"


# ── Pydantic models ────────────────────────────────────────────────────────────

class RagerMatch(BaseModel):
    rager_id: str
    cost_to_founder: int = 0   # INR — internal only, never shown to rager
    payout_to_rager: int = 0   # INR — shown to rager as their advisory fee


class MatchRequest(BaseModel):
    brief_id: str
    ragers: List[RagerMatch]


class BriefEditRequest(BaseModel):
    situation: str
    what_they_need: str
    help_items: List[str] = []
    decision_label: str = ""


class ConfirmRequest(BaseModel):
    allocation_id: str


class ShortlistRequest(BaseModel):
    shortlist_status: Optional[str] = None  # "shortlisted" | "rejected" | null


class ScheduleRequest(BaseModel):
    scheduled_at: Optional[str] = None
    session_notes: Optional[str] = ""


class FounderOfferRequest(BaseModel):
    budget_text: str = ""
    format_type: str = ""
    venue: str = ""
    duration_text: str = ""
    optional_dates: str = ""
    cost_notes: str = ""
    intro_message: str = ""


class ManualRagerRequest(BaseModel):
    name: str
    email: str
    title: str = ""
    company: str = ""
    bio: str = ""
    categories: List[str] = []
    cost_to_founder: int = 0
    payout_to_rager: int = 0


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _send_email(to: list, subject: str, html: str):
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        return  # silently skip in dev
    httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"from": FROM_EMAIL, "to": to, "subject": subject, "html": html},
        timeout=15,
    )


def _fmt_inr(amount: int) -> str:
    return f"₹{amount:,}"


def _response_page(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:Georgia,serif;background:#050505;color:#f5f5f0;display:flex;align-items:center;
justify-content:center;min-height:100vh;margin:0;}}
.card{{background:#111;border:1px solid #222;padding:48px;max-width:480px;text-align:center;}}
.logo{{color:#dc143c;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:24px;}}
h1{{font-size:28px;font-weight:300;margin:0 0 16px;}}
p{{color:#a1a1aa;font-size:14px;line-height:1.7;margin:0;}}
</style></head>
<body><div class="card">
<div class="logo">R.A.G.E.</div>
<h1>{title}</h1>
<p>{body}</p>
</div></body></html>"""


# ── Admin: view enquiries ──────────────────────────────────────────────────────

@router.get("/admin/enquiries/{enquiry_id}")
def get_enquiry(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    allocations = list(db.allocations.find({"enquiry_id": enquiry_id}, {"_id": 0}))
    return {**enq, "allocations": allocations}


# ── Admin: generate draft brief (preview before sending) ──────────────────────

@router.post("/admin/enquiries/{enquiry_id}/draft-brief")
def generate_draft_brief(enquiry_id: str, admin=Depends(require_admin)):
    from app.services.anonymisation import generate_anonymised_brief

    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    try:
        brief = generate_anonymised_brief(enq)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    original_snapshot = {
        "situation":      brief["situation"],
        "what_they_need": brief["what_they_need"],
        "help_items":     brief["help_items"],
        "decision_label": brief["decision_label"],
    }

    doc = {
        "brief_id":           brief["brief_id"],
        "enquiry_id":         enquiry_id,
        "brief_data":         brief,
        "status":             "draft",
        "original_generated": original_snapshot,
        "final_sent":         None,
        "edited_by":          None,
        "edited_at":          None,
        "rager_ids":          [],
        "sent_at":            None,
        "created_at":         _now(),
    }

    # Replace any existing draft for this enquiry
    db.anonymised_briefs.delete_many({"enquiry_id": enquiry_id, "status": "draft"})
    db.anonymised_briefs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/enquiries/{enquiry_id}/draft-brief")
def get_draft_brief(enquiry_id: str, admin=Depends(require_admin)):
    doc = db.anonymised_briefs.find_one(
        {"enquiry_id": enquiry_id, "status": "draft"},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="No draft brief found for this enquiry")
    return doc


@router.put("/admin/anonymised-briefs/{brief_id}")
def edit_brief(brief_id: str, data: BriefEditRequest, admin=Depends(require_admin)):
    doc = db.anonymised_briefs.find_one({"brief_id": brief_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Brief not found")
    if doc["status"] == "sent":
        raise HTTPException(status_code=400, detail="Cannot edit a brief that has already been sent")

    # Patch the editable fields inside brief_data
    db.anonymised_briefs.update_one(
        {"brief_id": brief_id},
        {"$set": {
            "brief_data.situation":      data.situation,
            "brief_data.what_they_need": data.what_they_need,
            "brief_data.help_items":     data.help_items,
            "brief_data.decision_label": data.decision_label or doc["brief_data"].get("decision_label", ""),
            "edited_by":                 admin.get("email", "admin"),
            "edited_at":                 _now(),
        }}
    )
    updated = db.anonymised_briefs.find_one({"brief_id": brief_id}, {"_id": 0})
    return updated


# ── Admin: step 1 — send anon emails to selected Ragers ───────────────────────

@router.post("/admin/enquiries/{enquiry_id}/match")
def match_enquiry(enquiry_id: str, data: MatchRequest, admin=Depends(require_admin)):
    from app.services.tokens import create_outreach_tokens
    from app.services.outreach import _brief_email_html

    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if enq.get("status") not in ("new", "matching"):
        raise HTTPException(status_code=400, detail=f"Cannot match enquiry with status '{enq['status']}'")

    # Load the admin-reviewed draft brief — never re-generate at send time
    brief_doc = db.anonymised_briefs.find_one(
        {"brief_id": data.brief_id, "enquiry_id": enquiry_id, "status": "draft"},
        {"_id": 0}
    )
    if not brief_doc:
        raise HTTPException(status_code=400, detail="Draft brief not found. Generate and review a brief before sending.")
    brief = brief_doc["brief_data"]

    created = []
    for rm in data.ragers:
        rager = db.ragers.find_one({"id": rm.rager_id}, {"_id": 0})
        if not rager:
            raise HTTPException(status_code=404, detail=f"Rager {rm.rager_id} not found")

        allocation = {
            "id": str(uuid.uuid4()),
            "enquiry_id": enquiry_id,
            "rager_id": rm.rager_id,
            "rager_name": rager["name"],
            "rager_email": rager.get("email", ""),
            "cost_to_founder": rm.cost_to_founder,
            "payout_to_rager": rm.payout_to_rager,
            "status": "pending_rager",
            "brief_id": brief["brief_id"],
            "created_at": _now(),
            "rager_responded_at": None,
            "founder_responded_at": None,
        }
        db.allocations.insert_one(allocation)
        allocation.pop("_id", None)
        created.append(allocation)

        email = rager.get("email", "")
        if not email:
            continue

        # Create 3-way response tokens (accept / decline / need_context)
        tokens = create_outreach_tokens(enquiry_id, rm.rager_id, brief["brief_id"])
        first_name = rager["name"].split()[0]

        # Add payout note to brief if set (internal — append to what_they_need)
        email_brief = dict(brief)
        if rm.payout_to_rager:
            email_brief["what_they_need"] = (
                email_brief["what_they_need"]
                + f"\n\nYour advisory fee for this session: {_fmt_inr(rm.payout_to_rager)}"
            )

        _send_email(
            to=[email],
            subject=f"RAGE: Advisory Request — {brief['decision_label']}",
            html=_brief_email_html(email_brief, first_name, tokens),
        )

    db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"status": "pending_rager", "matched_at": _now()}}
    )

    # Mark brief as sent and snapshot the final version that went out
    final_snapshot = {
        "situation":      brief["situation"],
        "what_they_need": brief["what_they_need"],
        "help_items":     brief.get("help_items", []),
        "decision_label": brief.get("decision_label", ""),
    }
    db.anonymised_briefs.update_one(
        {"brief_id": data.brief_id},
        {"$set": {
            "status":     "sent",
            "final_sent": final_snapshot,
            "rager_ids":  [rm.rager_id for rm in data.ragers],
            "sent_at":    _now(),
        }}
    )

    return {"status": "emails_sent", "allocations_created": len(created)}


# ── Public: Rager clicks link in email ────────────────────────────────────────

@router.get("/respond/{token}", response_class=HTMLResponse)
def rager_respond(token: str, r: str):
    if r not in ("accept", "decline"):
        return HTMLResponse(_response_page("Invalid link", "This response link is not valid."), status_code=400)

    allocation = db.allocations.find_one({"anon_token": token}, {"_id": 0})
    if not allocation:
        return HTMLResponse(_response_page("Link not found", "This link is invalid or has expired."), status_code=404)

    if allocation["status"] not in ("pending_rager",):
        return HTMLResponse(
            _response_page("Already responded", "You have already responded to this request. Thank you."),
            status_code=200,
        )

    new_status = "rager_accepted" if r == "accept" else "rager_declined"
    db.allocations.update_one(
        {"anon_token": token},
        {"$set": {"status": new_status, "rager_responded_at": _now()}}
    )

    # Check if all ragers for this enquiry have responded
    enquiry_id = allocation["enquiry_id"]
    pending = db.allocations.count_documents({"enquiry_id": enquiry_id, "status": "pending_rager"})
    if pending == 0:
        db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder"}})

    if r == "accept":
        return HTMLResponse(_response_page(
            "Thank you",
            "You've confirmed your availability. RAGE will be in touch once the founder reviews the proposed advisors. Full details will be shared at that stage."
        ))
    else:
        return HTMLResponse(_response_page(
            "Noted",
            "No problem — we won't assign you to this request. Thank you for letting us know."
        ))


# ── Admin: step 2 — notify founder of who accepted ───────────────────────────

@router.post("/admin/enquiries/{enquiry_id}/notify-founder")
def notify_founder(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    accepted = list(db.allocations.find(
        {"enquiry_id": enquiry_id, "status": "rager_accepted"},
        {"_id": 0}
    ))
    if not accepted:
        raise HTTPException(status_code=400, detail="No ragers have accepted yet")

    # Assign a confirm_token to each accepted allocation and mark as pending_founder
    alloc_data = []
    for alloc in accepted:
        confirm_token = str(uuid.uuid4())
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "pending_founder", "confirm_token": confirm_token}}
        )
        rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0, "email": 0, "phone": 0}) or {}
        alloc_data.append({
            "alloc": alloc,
            "rager": rager,
            "confirm_token": confirm_token,
        })

    # Build profile cards for email — each has a "Choose this advisor" button
    profiles_html = ""
    for item in alloc_data:
        rager = item["rager"]
        token = item["confirm_token"]
        confirm_link = f"{BACKEND_URL}/api/founder-confirm/{token}"
        name = rager.get("name", item["alloc"]["rager_name"])
        title = rager.get("title", "")
        company = rager.get("company", "")
        bio = rager.get("bio", "")
        cats = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:16px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{' · ' + company if company else ''}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 10px;">{bio}</p>' if bio else ''}
  {f'<p style="font-size:11px;color:#a1a1aa;margin:0 0 14px;">{cats}</p>' if cats else ''}
  <a href="{confirm_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:10px 20px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;">Choose {name.split()[0]}</a>
</div>"""

    _send_email(
        to=[enq["email"]],
        subject="RAGE: Your advisors are ready",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your advisors are ready</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {enq['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      {len(alloc_data)} advisor{'s have' if len(alloc_data) > 1 else ' has'} confirmed availability for your request.
      Review the profiles below and click the button next to your preferred choice.
    </p>
    {profiles_html}
    <p style="color:#52525b;font-size:13px;line-height:1.7;margin-top:24px;">
      Once you confirm, we'll share full contact details and session logistics with both parties.
      If none of the profiles feel like the right fit, reply to this email — we'll keep looking.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>""",
    )

    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder"}})
    return {"status": "founder_notified", "advisors_shown": len(alloc_data)}


# ── Public: Founder clicks "Choose advisor" link in email ─────────────────────

@router.get("/founder-confirm/{confirm_token}", response_class=HTMLResponse)
def founder_confirm_choice(confirm_token: str):
    alloc = db.allocations.find_one({"confirm_token": confirm_token}, {"_id": 0})
    if not alloc:
        return HTMLResponse(_response_page("Invalid link", "This link is not valid or has expired."), status_code=404)

    if alloc["status"] == "confirmed":
        rager_name = alloc.get("rager_name", "your advisor")
        return HTMLResponse(_response_page(
            "Already confirmed",
            f"You have already confirmed {rager_name} as your advisor. Check your email for session details."
        ))

    if alloc["status"] not in ("pending_founder",):
        return HTMLResponse(_response_page(
            "Link no longer valid",
            "This confirmation link is no longer active. Please contact RAGE if you need assistance."
        ), status_code=400)

    enquiry_id = alloc["enquiry_id"]
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        return HTMLResponse(_response_page("Error", "Request not found."), status_code=404)

    rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}

    # Confirm this allocation, decline others for the same enquiry
    db.allocations.update_one(
        {"id": alloc["id"]},
        {"$set": {"status": "confirmed", "founder_responded_at": _now()}}
    )
    db.allocations.update_many(
        {"enquiry_id": enquiry_id, "id": {"$ne": alloc["id"]}, "status": "pending_founder"},
        {"$set": {"status": "founder_declined"}}
    )
    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "confirmed", "confirmed_at": _now()}})

    payout = _fmt_inr(alloc.get("payout_to_rager", 0))
    cost = _fmt_inr(alloc.get("cost_to_founder", 0))
    format_label = enq.get("format", "Advisory Session").replace("_", " ").title()
    rager_name = rager.get("name", alloc["rager_name"])
    rager_email = rager.get("email") or alloc.get("rager_email", "")

    # Confirmation email to founder
    _send_email(
        to=[enq["email"]],
        subject="RAGE: Session Confirmed",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your session is confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {enq['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Your {format_label} has been confirmed. Here are the details:</p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Your Advisor</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{rager_name}</p>
      <p style="font-size:13px;color:#dc143c;margin:0 0 4px;">{rager.get('title', '')}{' · ' + rager.get('company', '') if rager.get('company') else ''}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{rager_email}</p>
      {f'<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Session Fee</p><p style="font-size:17px;color:#1a1a1a;margin:0;">{cost}</p>' if alloc.get('cost_to_founder') else ''}
    </div>
    <p style="color:#52525b;font-size:13px;line-height:1.7;">Please reach out directly to your advisor to schedule the session. After the session, you'll receive a written summary within 24 hours.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>""",
    )

    # Confirmation email to rager
    if rager_email:
        _send_email(
            to=[rager_email],
            subject="RAGE: Session Confirmed",
            html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Session confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {rager_name.split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">The founder has confirmed. Here are the full details:</p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Founder</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{enq['name']}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 4px;">{enq.get('company', '')}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{enq['email']}</p>
      {f'<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Your Payout</p><p style="font-size:17px;color:#1a1a1a;margin:0 0 16px;">{payout}</p>' if alloc.get('payout_to_rager') else ''}
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Format</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0;">{format_label}</p>
    </div>
    <p style="color:#52525b;font-size:13px;line-height:1.7;">The founder will reach out to schedule. Please confirm receipt by replying to RAGE.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>""",
        )

    return HTMLResponse(_response_page(
        "Session Confirmed",
        f"You've chosen {rager_name} as your advisor. Both parties have been notified. Check your email for full session details."
    ))


# ── Admin: step 3 — founder accepted a Rager, send full details ───────────────

@router.post("/admin/enquiries/{enquiry_id}/confirm")
def confirm_match(enquiry_id: str, data: ConfirmRequest, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    alloc = db.allocations.find_one({"id": data.allocation_id, "enquiry_id": enquiry_id}, {"_id": 0})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc["status"] not in ("pending_founder", "rager_accepted"):
        raise HTTPException(status_code=400, detail=f"Allocation status is '{alloc['status']}', cannot confirm")

    rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}

    # Mark allocation confirmed, decline the others
    db.allocations.update_one(
        {"id": data.allocation_id},
        {"$set": {"status": "confirmed", "founder_responded_at": _now()}}
    )
    db.allocations.update_many(
        {"enquiry_id": enquiry_id, "id": {"$ne": data.allocation_id}, "status": "pending_founder"},
        {"$set": {"status": "founder_declined"}}
    )
    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "confirmed", "confirmed_at": _now()}})

    payout = _fmt_inr(alloc["payout_to_rager"])
    cost = _fmt_inr(alloc["cost_to_founder"])
    format_label = enq.get("format", "Advisory Session").replace("_", " ").title()

    # Email to founder
    _send_email(
        to=[enq["email"]],
        subject="RAGE: Session Confirmed",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your session is confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {enq['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Your {format_label} has been confirmed. Here are the details:</p>

    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Your Advisor</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{rager.get('name', alloc['rager_name'])}</p>
      <p style="font-size:13px;color:#dc143c;margin:0 0 4px;">{rager.get('title', '')}{' · ' + rager.get('company', '') if rager.get('company') else ''}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{rager.get('email', alloc['rager_email'])}</p>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Session Fee</p>
      <p style="font-size:17px;color:#1a1a1a;margin:0;">{cost}</p>
    </div>

    <p style="color:#52525b;font-size:13px;line-height:1.7;">
      Please reach out directly to your advisor to schedule the session.
      After the session, you'll receive a written summary within 24 hours.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>""",
    )

    # Email to Rager
    if rager.get("email") or alloc.get("rager_email"):
        _send_email(
            to=[rager.get("email") or alloc["rager_email"]],
            subject="RAGE: Session Confirmed",
            html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Session confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {rager.get('name', alloc['rager_name']).split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">The founder has confirmed. Here are the full details:</p>

    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Founder</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{enq['name']}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 4px;">{enq.get('company', '')}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{enq['email']}</p>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Your Payout</p>
      <p style="font-size:17px;color:#1a1a1a;margin:0 0 16px;">{payout}</p>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Format</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0;">{format_label}</p>
    </div>

    <p style="color:#52525b;font-size:13px;line-height:1.7;">
      The founder will reach out to schedule. Please confirm receipt of this email by replying to RAGE.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>""",
        )

    return {"status": "confirmed", "allocation_id": data.allocation_id}


# ── Admin: decline enquiry ─────────────────────────────────────────────────────

@router.patch("/admin/enquiries/{enquiry_id}/decline")
def decline_enquiry(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "declined", "declined_at": _now()}})
    db.allocations.update_many(
        {"enquiry_id": enquiry_id, "status": {"$in": ["pending_rager", "rager_accepted", "pending_founder"]}},
        {"$set": {"status": "founder_declined"}}
    )

    _send_email(
        to=[enq["email"]],
        subject="RAGE: Update on your request",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Update on your request</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {enq['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      Unfortunately we were not able to find the right match for your request at this time.
      We'll keep your submission on file and reach out if a suitable advisor becomes available.
    </p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      If your needs have changed or you'd like to resubmit with different details, reply to this email.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E.</p>
  </div>
</div>""",
    )
    return {"status": "declined"}


# ── Email template helpers ────────────────────────────────────────────────────

def _rager_reconfirm_html(rager: dict, offer: dict,
                           confirm_link: str, decline_link: str) -> str:
    """
    Pre-offer reconfirmation email to rager.
    Founder identity NOT revealed — still under Chatham House Rule.
    Shows broad session details so rager can confirm availability.
    """
    rager_name = rager.get("name", "")
    first_name = rager_name.split()[0] if rager_name else "there"

    detail_rows = [
        ("Format",         (offer.get("format_type") or "").capitalize()),
        ("Duration",       offer.get("duration_text", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Investment",     offer.get("budget_text", "")),
        ("Venue",          offer.get("venue", "")),
    ]
    rows_html = "".join(
        f'<tr>'
        f'<td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;">{v}</td>'
        f'</tr>'
        for k, v in detail_rows if v
    )
    details_html = f"""
<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Overview</p>
  <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
</div>""" if rows_html else ""

    year = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Are you still available?</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      We&#8217;re progressing the advisory request you expressed interest in. Before we send a formal proposal to the founder, we&#8217;d like to confirm you&#8217;re still available and comfortable with the broad session details below.
    </p>
    <p style="color:#a1a1aa;font-size:12px;font-style:italic;line-height:1.6;margin:0 0 4px;">
      Under Chatham House Rule — founder details will be shared once both parties confirm.
    </p>
    {details_html}
    <p style="color:#52525b;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Please confirm whether you&#8217;re available and happy to proceed.
    </p>
    <div>
      <a href="{confirm_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:12px 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;margin-right:12px;">Yes, I&#8217;m Available</a>
      <a href="{decline_link}" style="display:inline-block;background:#f5f5f0;color:#52525b;border:1px solid #d4d4d4;padding:12px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">Not Available</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:20px;">
      Questions? Reply to this email and the RAGE team will be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">&#169; {year} R.A.G.E. &#8212; Radical Alliance for Gender Equity</p>
  </div>
</div>"""


# (old _rager_disclosure_html removed — replaced by _rager_reconfirm_html above)
def _UNUSED_rager_disclosure_html(rager: dict, enq: dict, offer: dict,
                            confirm_link: str, decline_link: str) -> str:
    rager_name   = rager.get("name", "")
    first_name   = rager_name.split()[0] if rager_name else "there"
    founder_name = enq.get("name", "")
    company      = enq.get("company", "")
    email        = enq.get("email", "")

    detail_rows = [
        ("Format",         (offer.get("format_type") or "").capitalize()),
        ("Duration",       offer.get("duration_text", "")),
        ("Venue",          offer.get("venue", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Investment",     offer.get("budget_text", "")),
    ]
    rows_html = "".join(
        f'<tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;'
        f'color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;">{v}</td></tr>'
        for k, v in detail_rows if v
    )
    details_html = f"""
<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Details</p>
  <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
</div>""" if rows_html else ""

    year = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">The founder has accepted — please confirm</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      Great news — the founder has accepted the session proposal. We can now share full details with you.
    </p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Founder</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{founder_name}</p>
      {f'<p style="font-size:13px;color:#52525b;margin:0 0 4px;">{company}</p>' if company else ''}
      <p style="font-size:13px;color:#52525b;margin:0;">{email}</p>
    </div>
    {details_html}
    <p style="color:#52525b;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Please confirm you're still available for this session.
    </p>
    <div style="margin-top:8px;">
      <a href="{confirm_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:12px 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;margin-right:12px;">Confirm</a>
      <a href="{decline_link}" style="display:inline-block;background:#f5f5f0;color:#52525b;border:1px solid #d4d4d4;padding:12px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">Can't Make It</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:20px;">
      Questions? Reply to this email and the RAGE team will be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>"""


def _session_confirmed_founder_html(enq: dict, alloc: dict, rager: dict) -> str:
    first_name    = enq.get("name", "").split()[0] if enq.get("name") else "there"
    rager_name    = rager.get("name", alloc.get("rager_name", ""))
    rager_title   = rager.get("title", "")
    rager_company = rager.get("company", "")
    rager_email   = rager.get("email") or alloc.get("rager_email", "")
    cost          = _fmt_inr(alloc.get("cost_to_founder", 0))
    year          = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your session is confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">You&#8217;ve accepted the proposal &#8212; here are your advisor&#8217;s full details:</p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Your Advisor</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{rager_name}</p>
      <p style="font-size:13px;color:#dc143c;margin:0 0 4px;">{rager_title}{' · ' + rager_company if rager_company else ''}</p>
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{rager_email}</p>
      {f'<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Session Fee</p><p style="font-size:17px;color:#1a1a1a;margin:0;">{cost}</p>' if alloc.get('cost_to_founder') else ''}
    </div>
    <p style="color:#52525b;font-size:13px;line-height:1.7;">Please reach out directly to your advisor to finalise scheduling. After the session, you'll receive a written summary within 24 hours.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>"""


def _session_confirmed_rager_html(enq: dict, alloc: dict, rager: dict) -> str:
    rager_name    = rager.get("name", alloc.get("rager_name", ""))
    first_name    = rager_name.split()[0] if rager_name else "there"
    payout        = _fmt_inr(alloc.get("payout_to_rager", 0))
    founder_name  = enq.get("name", "")
    founder_co    = enq.get("company", "")
    founder_email = enq.get("email", "")
    year          = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Session confirmed</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Your session is confirmed. Here are the full details:</p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Founder</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{founder_name}</p>
      {f'<p style="font-size:13px;color:#52525b;margin:0 0 4px;">{founder_co}</p>' if founder_co else ''}
      <p style="font-size:13px;color:#52525b;margin:0 0 12px;">{founder_email}</p>
      {f'<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 8px;">Your Payout</p><p style="font-size:17px;color:#1a1a1a;margin:0 0 16px;">{payout}</p>' if alloc.get('payout_to_rager') else ''}
    </div>
    <p style="color:#52525b;font-size:13px;line-height:1.7;">The founder will reach out to finalise scheduling. Please confirm receipt by replying to RAGE.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {year} R.A.G.E. — Under Chatham House Rule</p>
  </div>
</div>"""


# ── Admin: shortlist a rager response ─────────────────────────────────────────

@router.patch("/admin/allocations/{alloc_id}/shortlist")
def update_shortlist(alloc_id: str, data: ShortlistRequest, admin=Depends(require_admin)):
    alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    update = {"shortlist_status": data.shortlist_status}
    if data.shortlist_status:
        update["shortlisted_at"] = _now()
    db.allocations.update_one({"id": alloc_id}, {"$set": update})
    return {"status": "updated", "shortlist_status": data.shortlist_status}


# ── Admin: send shortlisted ragers to founder — DEPRECATED ───────────────────
# Direct founder selection via per-rager "Choose" links has been replaced
# by the structured founder offer flow (send-founder-offer).
# This endpoint is disabled. Use Prepare Founder Mail instead.

@router.post("/admin/enquiries/{enquiry_id}/send-shortlist")
def send_shortlist(enquiry_id: str, admin=Depends(require_admin)):
    raise HTTPException(
        status_code=410,
        detail=(
            "The direct shortlist email flow has been removed. "
            "Use 'Prepare Founder Mail' to send a structured proposal to the founder."
        ),
    )

    # ── dead code below — kept for reference only ──────────────────────────────
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    shortlisted = list(db.allocations.find(
        {"enquiry_id": enquiry_id, "shortlist_status": "shortlisted", "status": "rager_accepted"},
        {"_id": 0}
    ))
    if not shortlisted:
        raise HTTPException(status_code=400, detail="No shortlisted ragers with accepted status found")

    alloc_data = []
    for alloc in shortlisted:
        confirm_token = str(uuid.uuid4())
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "pending_founder", "confirm_token": confirm_token}}
        )
        rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0, "email": 0, "phone": 0}) or {}
        alloc_data.append({"alloc": alloc, "rager": rager, "confirm_token": confirm_token})

    profiles_html = ""
    for item in alloc_data:
        rager = item["rager"]
        token = item["confirm_token"]
        confirm_link = f"{BACKEND_URL}/api/founder-confirm/{token}"
        name = rager.get("name", item["alloc"]["rager_name"])
        title = rager.get("title", "")
        company = rager.get("company", "")
        bio = rager.get("bio", "")
        cats = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:16px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{' · ' + company if company else ''}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 10px;">{bio}</p>' if bio else ''}
  {f'<p style="font-size:11px;color:#a1a1aa;margin:0 0 14px;">{cats}</p>' if cats else ''}
  <a href="{confirm_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:10px 20px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;">Choose {name.split()[0]}</a>
</div>"""

    _send_email(
        to=[enq["email"]],
        subject="RAGE: Your advisors are ready",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your advisors are ready</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {enq['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      {len(alloc_data)} advisor{'s have' if len(alloc_data) > 1 else ' has'} confirmed availability for your request.
      Review the profiles below and click the button next to your preferred choice.
    </p>
    {profiles_html}
    <p style="color:#52525b;font-size:13px;line-height:1.7;margin-top:24px;">
      Once you confirm, we'll share full contact details and session logistics with both parties.
      If none of the profiles feel like the right fit, reply to this email.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>""",
    )

    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder"}})
    return {"status": "shortlist_sent", "advisors_shown": len(alloc_data)}


# ── Admin: get responses for an enquiry (with rager details) ──────────────────

@router.get("/admin/enquiries/{enquiry_id}/responses")
def get_enquiry_responses(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    allocations = list(db.allocations.find({"enquiry_id": enquiry_id}, {"_id": 0}))

    # Enrich with rager details
    enriched = []
    for alloc in allocations:
        rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}
        enriched.append({
            **alloc,
            "rager_title": rager.get("title", ""),
            "rager_company": rager.get("company", ""),
            "rager_bio": rager.get("bio", ""),
            "rager_categories": rager.get("categories", []),
        })

    return {"enquiry": enq, "allocations": enriched}


# ── Admin: schedule a confirmed session ───────────────────────────────────────

@router.patch("/admin/enquiries/{enquiry_id}/session")
def update_session(enquiry_id: str, data: ScheduleRequest, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if enq.get("status") not in ("confirmed", "founder_accepted", "confirmed_ready_to_schedule"):
        raise HTTPException(status_code=400, detail="Session scheduling only available for confirmed enquiries")
    db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"scheduled_at": data.scheduled_at, "session_notes": data.session_notes}}
    )
    return {"status": "updated"}


# ── Admin: prepare founder offer (save draft) ─────────────────────────────────

@router.post("/admin/enquiries/{enquiry_id}/founder-offer")
def save_founder_offer(enquiry_id: str, data: FounderOfferRequest, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    # Prefer reconfirmed_for_offer; backward compat keeps old-flow statuses working
    shortlisted = list(db.allocations.find(
        {"enquiry_id": enquiry_id,
         "$or": [
             {"status": "reconfirmed_for_offer"},
             {"status": "offer_sent_to_founder"},
             # backward compat for pre-reconfirmation-flow data:
             {"shortlist_status": "shortlisted", "status": "rager_accepted"},
             {"status": "pending_founder"},
         ]},
        {"_id": 0}
    ))
    if not shortlisted:
        raise HTTPException(
            status_code=400,
            detail="No eligible ragers found. Shortlist ragers, send reconfirmation emails, and wait for responses first.",
        )

    allocation_ids = [a["id"] for a in shortlisted]
    now = _now()

    existing = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if existing:
        db.founder_offers.update_one(
            {"id": existing["id"]},
            {"$set": {
                "allocation_ids":  allocation_ids,
                "budget_text":     data.budget_text,
                "format_type":     data.format_type,
                "venue":           data.venue,
                "duration_text":   data.duration_text,
                "optional_dates":  data.optional_dates,
                "cost_notes":      data.cost_notes,
                "intro_message":   data.intro_message,
                "updated_at":      now,
            }}
        )
        doc = db.founder_offers.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        doc = {
            "id":              str(uuid.uuid4()),
            "enquiry_id":      enquiry_id,
            "allocation_ids":  allocation_ids,
            "budget_text":     data.budget_text,
            "format_type":     data.format_type,
            "venue":           data.venue,
            "duration_text":   data.duration_text,
            "optional_dates":  data.optional_dates,
            "cost_notes":      data.cost_notes,
            "intro_message":   data.intro_message,
            "status":          "draft",
            "accept_token":    str(uuid.uuid4()),
            "reject_token":    str(uuid.uuid4()),
            "created_by":      admin.get("email", "admin"),
            "created_at":      now,
            "updated_at":      now,
            "sent_at":         None,
            "founder_response":       None,
            "founder_responded_at":   None,
        }
        db.founder_offers.insert_one(doc)
        doc.pop("_id", None)
    return doc


@router.get("/admin/enquiries/{enquiry_id}/founder-offer")
def get_founder_offer(enquiry_id: str, admin=Depends(require_admin)):
    doc = db.founder_offers.find_one(
        {"enquiry_id": enquiry_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not doc:
        raise HTTPException(status_code=404, detail="No offer found")
    return doc


# ── Admin: send founder offer email ───────────────────────────────────────────

@router.post("/admin/enquiries/{enquiry_id}/send-founder-offer")
def send_founder_offer_email(enquiry_id: str, admin=Depends(require_admin)):
    raise HTTPException(
        status_code=410,
        detail="Use send-shortlist-to-founder instead — founders now receive individual advisor selection links.",
    )


# kept for reference only — body below is dead code
def _DEPRECATED_send_founder_offer_email(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    offer = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=400, detail="No draft offer found. Save a draft first.")

    # Guard: require at least one reconfirmed rager (backward compat: allow old-flow statuses)
    allocs_in_offer = [
        db.allocations.find_one({"id": aid}, {"_id": 0}) or {}
        for aid in offer["allocation_ids"]
    ]
    reconfirmed_allocs = [a for a in allocs_in_offer if a.get("status") == "reconfirmed_for_offer"]
    old_flow_allocs    = [a for a in allocs_in_offer if a.get("status") in ("pending_founder",)
                          or (a.get("shortlist_status") == "shortlisted" and a.get("status") == "rager_accepted")]
    if not reconfirmed_allocs and not old_flow_allocs:
        raise HTTPException(
            status_code=400,
            detail="No reconfirmed ragers in this offer. Send reconfirmation emails to shortlisted ragers first.",
        )

    # Build rager profile cards (no choose button — founder accepts/rejects whole proposal)
    profiles_html = ""
    for alloc_id in offer["allocation_ids"]:
        alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0}) or {}
        rager = db.ragers.find_one({"id": alloc.get("rager_id", "")}, {"_id": 0}) or {}
        name    = rager.get("name", alloc.get("rager_name", ""))
        title   = rager.get("title", "")
        company = rager.get("company", "")
        bio     = rager.get("bio", "")
        cats    = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:12px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{(" · " + company) if company else ""}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 8px;">{bio}</p>' if bio else ""}
  {f'<p style="font-size:11px;color:#a1a1aa;margin:0;">{cats}</p>' if cats else ""}
</div>"""

    # Build session details table
    detail_rows = [
        ("Format",         offer.get("format_type", "").capitalize()),
        ("Duration",       offer.get("duration_text", "")),
        ("Venue",          offer.get("venue", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Investment",     offer.get("budget_text", "")),
        ("Notes",          offer.get("cost_notes", "")),
    ]
    rows_html = "".join(
        f'<tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;">{v}</td></tr>'
        for k, v in detail_rows if v
    )
    details_html = f"""
<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Proposal</p>
  <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
</div>""" if rows_html else ""

    accept_link = f"{BACKEND_URL}/api/founder-offer-respond/{offer['accept_token']}?r=accept"
    reject_link = f"{BACKEND_URL}/api/founder-offer-respond/{offer['reject_token']}?r=reject"
    intro       = (offer.get("intro_message") or "").strip()
    first_name  = enq["name"].split()[0]
    plural      = len(offer["allocation_ids"]) > 1

    _send_email(
        to=[enq["email"]],
        subject="RAGE: Your Session Proposal",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your Session Proposal</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      {intro if intro else "We&#8217;ve matched you with an advisor for your request. Please review the proposal below and confirm whether you&#8217;d like to proceed."}
    </p>
    <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:24px 0 12px;">
      Your Advisor{"s" if plural else ""}
    </p>
    {profiles_html}
    {details_html}
    <p style="color:#52525b;font-size:13px;line-height:1.7;margin-top:24px;">
      Please confirm whether you&#8217;d like to proceed with this session.
    </p>
    <div style="margin-top:24px;">
      <a href="{accept_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:12px 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;margin-right:12px;">Accept Proposal</a>
      <a href="{reject_link}" style="display:inline-block;background:#f5f5f0;color:#52525b;border:1px solid #d4d4d4;padding:12px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">Decline</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:24px;">
      Questions or adjustments? Reply to this email and we&#8217;ll be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>""",
    )

    now = _now()
    db.founder_offers.update_one({"id": offer["id"]}, {"$set": {"status": "sent", "sent_at": now}})
    # Mark each alloc in offer as offer_sent_to_founder
    db.allocations.update_many(
        {"id": {"$in": offer["allocation_ids"]}},
        {"$set": {"status": "offer_sent_to_founder", "offer_sent_at": now}},
    )
    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "founder_offer_sent"}})
    return {"status": "sent", "offer_id": offer["id"]}


# ── Public: Founder responds to offer ─────────────────────────────────────────

@router.get("/founder-offer-respond/{token}", response_class=HTMLResponse)
def founder_offer_respond(token: str, r: str):
    if r not in ("accept", "reject"):
        return HTMLResponse(_response_page("Invalid link", "This link is not valid."), status_code=400)

    field = "accept_token" if r == "accept" else "reject_token"
    offer = db.founder_offers.find_one({field: token}, {"_id": 0})
    if not offer:
        return HTMLResponse(_response_page("Link not found", "This link is invalid or has expired."), status_code=404)

    if offer.get("founder_response"):
        action = "accepted" if offer["founder_response"] == "accept" else "declined"
        return HTMLResponse(_response_page("Already responded", f"You have already {action} this proposal. Thank you."))

    if offer["status"] != "sent":
        return HTMLResponse(_response_page(
            "Link no longer valid",
            "This link is no longer active. Please contact RAGE if you need assistance."
        ), status_code=400)

    now        = _now()
    enquiry_id = offer["enquiry_id"]

    db.founder_offers.update_one(
        {"id": offer["id"]},
        {"$set": {"founder_response": r, "founder_responded_at": now}}
    )

    if r == "accept":
        enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0}) or {}

        # Mark each alloc as founder_accepted and send confirmation emails
        for alloc_id in offer["allocation_ids"]:
            db.allocations.update_one(
                {"id": alloc_id},
                {"$set": {"status": "founder_accepted", "founder_responded_at": now}},
            )
            alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0}) or {}
            rager = db.ragers.find_one({"id": alloc.get("rager_id", "")}, {"_id": 0}) or {}
            rager_email = rager.get("email") or alloc.get("rager_email", "")

            # Confirmation email to rager (reveals founder details)
            if rager_email:
                _send_email(
                    to=[rager_email],
                    subject="RAGE: Session Confirmed",
                    html=_session_confirmed_rager_html(enq, alloc, rager),
                )

        db.enquiries.update_one(
            {"id": enquiry_id},
            {"$set": {"status": "confirmed_ready_to_schedule", "founder_accepted_at": now}},
        )

        # Confirmation email to founder (reveals rager details)
        # Use the first confirmed alloc for the email (typical case: one rager)
        first_alloc = db.allocations.find_one(
            {"id": {"$in": offer["allocation_ids"]}, "status": "founder_accepted"},
            {"_id": 0},
        ) or {}
        first_rager = db.ragers.find_one({"id": first_alloc.get("rager_id", "")}, {"_id": 0}) or {}
        if enq.get("email"):
            _send_email(
                to=[enq["email"]],
                subject="RAGE: Session Confirmed",
                html=_session_confirmed_founder_html(enq, first_alloc, first_rager),
            )

        return HTMLResponse(_response_page(
            "Proposal Accepted",
            "Thank you &#8212; your session is confirmed. "
            "Check your email for your advisor&#8217;s full contact details.",
        ))

    else:  # reject
        db.allocations.update_many(
            {"id": {"$in": offer["allocation_ids"]}},
            {"$set": {"status": "founder_declined", "founder_responded_at": now}},
        )
        db.enquiries.update_one(
            {"id": enquiry_id},
            {"$set": {"status": "founder_rejected"}},
        )
        return HTMLResponse(_response_page(
            "Proposal Declined",
            "Thank you for letting us know. We&#8217;ll review and reach out with alternative options."
        ))


# ── Public: rager-final-confirm — DEPRECATED (flow redesigned) ───────────────
# Post-founder rager confirmation has been removed from the primary flow.
# Rager reconfirmation now happens BEFORE the offer is sent to the founder.
# See /rager-reconfirm/{token} for the current pre-offer reconfirmation endpoint.

@router.get("/rager-final-confirm/{token}", response_class=HTMLResponse)
def rager_final_confirm(token: str, r: str = ""):
    return HTMLResponse(
        _response_page(
            "Link no longer valid",
            "This link is from an older flow that has been updated. "
            "Please contact the RAGE team if you need assistance.",
        ),
        status_code=410,
    )


# ── Public: Rager responds to pre-offer reconfirmation ───────────────────────

@router.get("/rager-reconfirm/{token}", response_class=HTMLResponse)
def rager_reconfirm(token: str, r: str):
    if r not in ("confirm", "decline"):
        return HTMLResponse(_response_page("Invalid link", "This link is not valid."), status_code=400)

    field = "rager_reconfirm_token" if r == "confirm" else "rager_reconfirm_decline_token"
    alloc = db.allocations.find_one({field: token}, {"_id": 0})
    if not alloc:
        return HTMLResponse(_response_page("Link not found", "This link is invalid or has expired."), status_code=404)

    # Idempotency guards
    if alloc["status"] == "reconfirmed_for_offer":
        return HTMLResponse(_response_page(
            "Already confirmed",
            "You&#8217;ve already confirmed your availability. The RAGE team will be in touch with next steps.",
        ))
    if alloc["status"] == "reconfirmation_declined":
        return HTMLResponse(_response_page(
            "Already responded",
            "You&#8217;ve already indicated you&#8217;re unavailable for this request. Thank you.",
        ))
    if alloc["status"] != "reconfirmation_pending":
        return HTMLResponse(_response_page(
            "Link no longer valid",
            "This reconfirmation link is no longer active. Please contact RAGE if you need assistance.",
        ), status_code=400)

    enquiry_id = alloc["enquiry_id"]
    now        = _now()

    if r == "confirm":
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "reconfirmed_for_offer", "reconfirmed_at": now}},
        )
        # Advance enquiry to founder_offer_ready if not already further along
        db.enquiries.update_one(
            {"id": enquiry_id,
             "status": {"$nin": ["founder_offer_sent", "founder_accepted",
                                  "confirmed_ready_to_schedule", "founder_rejected", "declined", "closed"]}},
            {"$set": {"status": "founder_offer_ready"}},
        )
        return HTMLResponse(_response_page(
            "Confirmed",
            "Thank you &#8212; you&#8217;ve confirmed your availability. "
            "The RAGE team will be in touch with the next steps shortly.",
        ))

    else:  # decline
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "reconfirmation_declined", "reconfirmation_declined_at": now}},
        )
        return HTMLResponse(_response_page(
            "Noted",
            "Thank you for letting us know. We&#8217;ll keep you in mind for future opportunities.",
        ))


# ── Admin: send pre-offer reconfirmation emails to shortlisted ragers ─────────

@router.post("/admin/enquiries/{enquiry_id}/send-rager-reconfirmation")
def send_rager_reconfirmation(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    # Require a saved offer draft (needed for session detail context in email)
    offer = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if not offer:
        raise HTTPException(
            status_code=400,
            detail="Save an offer draft first (format, budget, dates) so we can include session details in the reconfirmation email.",
        )

    # Find shortlisted ragers not yet declined or already reconfirmed
    eligible = list(db.allocations.find(
        {"enquiry_id": enquiry_id,
         "shortlist_status": "shortlisted",
         "status": {"$in": ["rager_accepted", "reconfirmation_pending"]}},
        {"_id": 0},
    ))
    if not eligible:
        raise HTTPException(
            status_code=400,
            detail="No shortlisted ragers eligible for reconfirmation (must be accepted and not yet reconfirmed or declined).",
        )

    now = _now()
    sent_count = 0

    for alloc in eligible:
        c_tok = secrets.token_urlsafe(32)
        d_tok = secrets.token_urlsafe(32)
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {
                "status":                       "reconfirmation_pending",
                "rager_reconfirm_token":        c_tok,
                "rager_reconfirm_decline_token": d_tok,
                "reconfirm_sent_at":            now,
            }},
        )

        rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}
        rager_email = rager.get("email") or alloc.get("rager_email", "")
        if not rager_email:
            continue

        confirm_link = f"{BACKEND_URL}/api/rager-reconfirm/{c_tok}?r=confirm"
        decline_link = f"{BACKEND_URL}/api/rager-reconfirm/{d_tok}?r=decline"
        _send_email(
            to=[rager_email],
            subject="RAGE: Please Confirm Availability",
            html=_rager_reconfirm_html(rager, offer, confirm_link, decline_link),
        )
        sent_count += 1

    db.enquiries.update_one(
        {"id": enquiry_id,
         "status": {"$nin": ["founder_offer_sent", "founder_accepted",
                              "confirmed_ready_to_schedule", "founder_rejected"]}},
        {"$set": {"status": "reconfirmation_pending"}},
    )

    return {"status": "sent", "emails_sent": sent_count}


# ── Admin: resend reconfirmation to a single rager ────────────────────────────

@router.post("/admin/allocations/{alloc_id}/resend-reconfirmation")
def resend_rager_reconfirmation(alloc_id: str, admin=Depends(require_admin)):
    alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc["status"] == "reconfirmed_for_offer":
        raise HTTPException(status_code=400, detail="Rager has already reconfirmed. No need to resend.")
    if alloc["status"] not in ("reconfirmation_pending",):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resend reconfirmation for allocation with status '{alloc['status']}'. "
                   "Send the initial reconfirmation first.",
        )

    enquiry_id = alloc["enquiry_id"]
    offer = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=400, detail="No offer draft found for this enquiry.")

    rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}
    rager_email = rager.get("email") or alloc.get("rager_email", "")
    if not rager_email:
        raise HTTPException(status_code=400, detail="No email address for this rager.")

    # Generate fresh tokens (old tokens become invalid)
    c_tok = secrets.token_urlsafe(32)
    d_tok = secrets.token_urlsafe(32)
    now   = _now()
    db.allocations.update_one(
        {"id": alloc_id},
        {"$set": {
            "rager_reconfirm_token":        c_tok,
            "rager_reconfirm_decline_token": d_tok,
            "reconfirm_sent_at":            now,
        }},
    )

    confirm_link = f"{BACKEND_URL}/api/rager-reconfirm/{c_tok}?r=confirm"
    decline_link = f"{BACKEND_URL}/api/rager-reconfirm/{d_tok}?r=decline"
    _send_email(
        to=[rager_email],
        subject="RAGE: Reminder — Please Confirm Availability",
        html=_rager_reconfirm_html(rager, offer, confirm_link, decline_link),
    )
    return {"status": "resent", "rager_email": rager_email}


# ── Admin: resend founder offer email ─────────────────────────────────────────

@router.post("/admin/enquiries/{enquiry_id}/resend-founder-offer")
def resend_founder_offer(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    # Find the most recently sent offer
    offer = db.founder_offers.find_one(
        {"enquiry_id": enquiry_id, "status": "sent"},
        {"_id": 0},
        sort=[("sent_at", -1)],
    )
    if not offer:
        raise HTTPException(
            status_code=400,
            detail="No sent offer found. Use 'Send to Founder' to send the initial offer first.",
        )
    if offer.get("founder_response"):
        raise HTTPException(
            status_code=400,
            detail="Founder has already responded to this offer. Cannot resend.",
        )

    # Rebuild and resend the same email using the existing tokens
    profiles_html = ""
    for alloc_id in offer["allocation_ids"]:
        alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0}) or {}
        rager = db.ragers.find_one({"id": alloc.get("rager_id", "")}, {"_id": 0}) or {}
        name    = rager.get("name", alloc.get("rager_name", ""))
        title   = rager.get("title", "")
        company = rager.get("company", "")
        bio     = rager.get("bio", "")
        cats    = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:12px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{(" · " + company) if company else ""}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 8px;">{bio}</p>' if bio else ""}
  {f'<p style="font-size:11px;color:#a1a1aa;margin:0;">{cats}</p>' if cats else ""}
</div>"""

    detail_rows = [
        ("Format",         (offer.get("format_type") or "").capitalize()),
        ("Duration",       offer.get("duration_text", "")),
        ("Venue",          offer.get("venue", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Investment",     offer.get("budget_text", "")),
        ("Notes",          offer.get("cost_notes", "")),
    ]
    rows_html = "".join(
        f'<tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;">{v}</td></tr>'
        for k, v in detail_rows if v
    )
    details_html = f"""
<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Proposal</p>
  <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
</div>""" if rows_html else ""

    accept_link = f"{BACKEND_URL}/api/founder-offer-respond/{offer['accept_token']}?r=accept"
    reject_link = f"{BACKEND_URL}/api/founder-offer-respond/{offer['reject_token']}?r=reject"
    intro       = (offer.get("intro_message") or "").strip()
    first_name  = enq["name"].split()[0]
    plural      = len(offer["allocation_ids"]) > 1

    _send_email(
        to=[enq["email"]],
        subject="RAGE: Your Session Proposal (Reminder)",
        html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your Session Proposal</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      {intro if intro else "A reminder about your pending session proposal — please let us know whether you&#8217;d like to proceed."}
    </p>
    <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:24px 0 12px;">
      Your Advisor{"s" if plural else ""}
    </p>
    {profiles_html}
    {details_html}
    <div style="margin-top:24px;">
      <a href="{accept_link}" style="display:inline-block;background:#dc143c;color:#fff;padding:12px 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;margin-right:12px;">Accept Proposal</a>
      <a href="{reject_link}" style="display:inline-block;background:#f5f5f0;color:#52525b;border:1px solid #d4d4d4;padding:12px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">Decline</a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:24px;">
      Questions? Reply to this email and we&#8217;ll be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">&#169; {datetime.now().year} R.A.G.E. &#8212; Radical Alliance for Gender Equity</p>
  </div>
</div>""",
    )

    db.founder_offers.update_one({"id": offer["id"]}, {"$set": {"resent_at": _now()}})
    return {"status": "resent", "offer_id": offer["id"]}


# ═══════════════════════════════════════════════════════════════════════════════
# FOUNDER SELECTION FLOW — shortlist with individual per-rager selection tokens
# ═══════════════════════════════════════════════════════════════════════════════

def _founder_shortlist_html(enq: dict, offer: dict, alloc_data: list,
                             more_options_link: str, reject_all_link: str) -> str:
    """
    Founder receives a shortlist of candidates.
    Each profile card has an individual 'Select [Name]' button.
    Founder can select 1 or more, request more options, or reject all.
    Founder identity is NOT revealed here (Chatham House still in effect).
    """
    first_name = enq.get("name", "there").split()[0]
    intro = (offer.get("intro_message") or "").strip()

    detail_rows = [
        ("Format",         (offer.get("format_type") or "").capitalize()),
        ("Duration",       offer.get("duration_text", "")),
        ("Venue",          offer.get("venue", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Investment",     offer.get("budget_text", "")),
        ("Notes",          offer.get("cost_notes", "")),
    ]
    rows_html = "".join(
        f'<tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;'
        f'color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;">{v}</td></tr>'
        for k, v in detail_rows if v
    )
    details_html = f"""
<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Details</p>
  <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
</div>""" if rows_html else ""

    profiles_html = ""
    for item in alloc_data:
        rager = item["rager"]
        select_link = item["select_link"]
        name    = rager.get("name", item["alloc"].get("rager_name", ""))
        first   = name.split()[0] if name else "Advisor"
        title   = rager.get("title", "")
        company = rager.get("company", "")
        bio     = rager.get("bio", "")
        cats    = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:16px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{(" · " + company) if company else ""}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 8px;">{bio}</p>' if bio else ""}
  {f'<p style="font-size:11px;color:#a1a1aa;margin:0 0 14px;">{cats}</p>' if cats else ""}
  <a href="{select_link}"
     style="display:inline-block;background:#dc143c;color:#fff;padding:10px 20px;
            font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
            text-decoration:none;font-weight:600;">
    Select {first}
  </a>
</div>"""

    year = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Your Advisor Shortlist</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      {intro if intro else f"We&#8217;ve shortlisted {len(alloc_data)} advisor{'s' if len(alloc_data) > 1 else ''} for your request. Review the profiles below and click &#8220;Select&#8221; next to your preferred choice(s). You may select more than one."}
    </p>
    {details_html}
    <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:24px 0 12px;">
      Your Shortlist
    </p>
    {profiles_html}
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e5e5;">
      <p style="color:#71717a;font-size:13px;margin:0 0 14px;">Not the right fit?</p>
      <a href="{more_options_link}"
         style="display:inline-block;background:#fff;color:#52525b;border:1px solid #d4d4d4;
                padding:10px 20px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
                text-decoration:none;margin-right:12px;">
        Request more advisors
      </a>
      <a href="{reject_all_link}"
         style="display:inline-block;color:#a1a1aa;font-size:12px;text-decoration:underline;vertical-align:middle;">
        None of these
      </a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:20px;">
      Questions or adjustments? Reply to this email and we&#8217;ll be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">&#169; {year} R.A.G.E. &#8212; Radical Alliance for Gender Equity</p>
  </div>
</div>"""


def _rager_final_disclosure_html(rager: dict, enq: dict, offer: dict, alloc: dict,
                                   confirm_link: str, decline_link: str) -> str:
    """
    Final disclosure to rager after founder selects them.
    Reveals founder identity, company, exact commercials and logistics.
    """
    rager_name   = rager.get("name", alloc.get("rager_name", ""))
    first_name   = rager_name.split()[0] if rager_name else "there"
    founder_name = enq.get("name", "")
    founder_co   = enq.get("company", "")
    founder_email = enq.get("email", "")
    payout       = _fmt_inr(alloc.get("payout_to_rager", 0)) if alloc.get("payout_to_rager") else ""
    format_label = ((offer.get("format_type") or enq.get("format", "advisory session")) or "").capitalize()

    detail_rows = [
        ("Format",         format_label),
        ("Duration",       offer.get("duration_text", "")),
        ("Venue",          offer.get("venue", "")),
        ("Proposed Dates", offer.get("optional_dates", "")),
        ("Your Payout",    payout),
    ]
    rows_html = "".join(
        f'<tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;'
        f'color:#71717a;padding:7px 20px 7px 0;vertical-align:top;white-space:nowrap;">{k}</td>'
        f'<td style="font-size:13px;color:#1a1a1a;padding:7px 0;{"font-weight:600;" if k == "Your Payout" else ""}">{v}</td></tr>'
        for k, v in detail_rows if v
    )
    year = datetime.now().year
    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">You&#8217;ve been selected</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {first_name},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">
      The founder has selected you from the RAGE shortlist. Here are the full details of the engagement:
    </p>
    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:24px 0;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 12px;">Founder</p>
      <p style="font-size:17px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{founder_name}</p>
      {f'<p style="font-size:13px;color:#52525b;margin:0 0 4px;">{founder_co}</p>' if founder_co else ''}
      <p style="font-size:13px;color:#52525b;margin:0;">{founder_email}</p>
    </div>
    {f'<div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:0 0 24px;"><p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;margin:0 0 14px;">Session Details</p><table style="border-collapse:collapse;width:100%;">{rows_html}</table></div>' if rows_html else ''}
    <p style="color:#52525b;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Please confirm whether you&#8217;re available to proceed.
    </p>
    <div>
      <a href="{confirm_link}"
         style="display:inline-block;background:#dc143c;color:#fff;padding:12px 28px;
                font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                text-decoration:none;font-weight:600;margin-right:12px;">
        Confirm
      </a>
      <a href="{decline_link}"
         style="display:inline-block;background:#f5f5f0;color:#52525b;border:1px solid #d4d4d4;
                padding:12px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">
        Can&#8217;t Make It
      </a>
    </div>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:20px;">
      Questions? Reply to this email and the RAGE team will be in touch.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">&#169; {year} R.A.G.E. &#8212; Radical Alliance for Gender Equity</p>
  </div>
</div>"""


# ── Admin: send versioned shortlist with individual selection tokens ───────────

@router.post("/admin/enquiries/{enquiry_id}/send-shortlist-to-founder")
def send_shortlist_to_founder(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    offer = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=400, detail="No draft offer found. Save a draft first.")

    # Require at least one eligible rager (reconfirmed or backward-compat statuses)
    allocs_in_offer = [
        db.allocations.find_one({"id": aid}, {"_id": 0}) or {}
        for aid in offer["allocation_ids"]
    ]
    eligible = [
        a for a in allocs_in_offer
        if a.get("status") in ("reconfirmed_for_offer", "pending_founder", "offer_sent_to_founder")
        or (a.get("shortlist_status") == "shortlisted" and a.get("status") == "rager_accepted")
    ]
    if not eligible:
        raise HTTPException(
            status_code=400,
            detail="No reconfirmed ragers in this offer. Send reconfirmation emails first.",
        )

    now = _now()
    selection_tokens = {}
    alloc_data = []

    for alloc in eligible:
        tok = secrets.token_urlsafe(32)
        selection_tokens[alloc["id"]] = tok
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {
                "founder_select_token": tok,
                "status":               "offer_sent_to_founder",
                "offer_sent_at":        now,
            }},
        )
        rager = db.ragers.find_one({"id": alloc.get("rager_id", "")}, {"_id": 0, "email": 0, "phone": 0}) or {}
        alloc_data.append({
            "alloc":       alloc,
            "rager":       rager,
            "select_link": f"{BACKEND_URL}/api/founder-select/{tok}",
        })

    more_options_token = secrets.token_urlsafe(32)
    reject_all_token   = secrets.token_urlsafe(32)

    html = _founder_shortlist_html(
        enq, offer, alloc_data,
        more_options_link=f"{BACKEND_URL}/api/founder-more-options/{more_options_token}",
        reject_all_link=f"{BACKEND_URL}/api/founder-reject-all/{reject_all_token}",
    )
    _send_email(
        to=[enq["email"]],
        subject="RAGE: Your Advisor Shortlist",
        html=html,
    )

    db.founder_offers.update_one(
        {"id": offer["id"]},
        {"$set": {
            "status":                "sent",
            "sent_at":               now,
            "selection_tokens":      selection_tokens,
            "more_options_token":    more_options_token,
            "reject_all_token":      reject_all_token,
            "founder_response_type": None,
            "selected_alloc_ids":    [],
        }},
    )
    db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"status": "founder_offer_sent"}},
    )
    return {"status": "sent", "advisors_shown": len(alloc_data), "offer_id": offer["id"]}


# ── Public: founder selects a specific rager from shortlist ───────────────────

@router.get("/founder-select/{token}", response_class=HTMLResponse)
def founder_select_rager(token: str):
    alloc = db.allocations.find_one({"founder_select_token": token}, {"_id": 0})
    if not alloc:
        return HTMLResponse(_response_page("Invalid link", "This link is invalid or has expired."), status_code=404)

    if alloc["status"] == "selected_by_founder":
        name = alloc.get("rager_name", "this advisor")
        return HTMLResponse(_response_page(
            "Already selected",
            f"You&#8217;ve already selected {name}. We&#8217;ll be in touch with next steps."
        ))

    if alloc["status"] not in ("offer_sent_to_founder",):
        return HTMLResponse(_response_page(
            "Link no longer valid",
            "This selection link is no longer active. Please contact RAGE if you need assistance."
        ), status_code=400)

    now        = _now()
    enquiry_id = alloc["enquiry_id"]

    db.allocations.update_one(
        {"id": alloc["id"]},
        {"$set": {"status": "selected_by_founder", "founder_selected_at": now}},
    )

    # Update offer doc: push to selected_alloc_ids
    offer = db.founder_offers.find_one(
        {"enquiry_id": enquiry_id, "status": "sent"},
        {"_id": 0}, sort=[("sent_at", -1)],
    )
    if offer:
        existing = offer.get("selected_alloc_ids", [])
        if alloc["id"] not in existing:
            db.founder_offers.update_one(
                {"id": offer["id"]},
                {"$push": {"selected_alloc_ids": alloc["id"]},
                 "$set":  {"founder_response_type": "selection", "founder_responded_at": now}},
            )

    db.enquiries.update_one(
        {"id": enquiry_id,
         "status": {"$nin": ["confirmed_ready_to_schedule", "awaiting_final_confirmation"]}},
        {"$set": {"status": "founder_selected"}},
    )

    rager = db.ragers.find_one({"id": alloc.get("rager_id", "")}, {"_id": 0}) or {}
    name  = rager.get("name", alloc.get("rager_name", "this advisor"))
    return HTMLResponse(_response_page(
        "Selection noted",
        f"You&#8217;ve selected {name}. "
        "We&#8217;ll confirm their availability and be in touch shortly."
    ))


# ── Public: founder requests more advisor options ─────────────────────────────

@router.get("/founder-more-options/{token}", response_class=HTMLResponse)
def founder_more_options(token: str):
    offer = db.founder_offers.find_one({"more_options_token": token}, {"_id": 0})
    if not offer:
        return HTMLResponse(_response_page("Invalid link", "This link is invalid or has expired."), status_code=404)

    if offer.get("founder_response_type") == "more_options":
        return HTMLResponse(_response_page(
            "Already noted",
            "We&#8217;ve registered your request for more advisors. The RAGE team will be in touch."
        ))

    now = _now()
    db.founder_offers.update_one(
        {"id": offer["id"]},
        {"$set": {"founder_response_type": "more_options", "founder_responded_at": now}},
    )
    db.enquiries.update_one(
        {"id": offer["enquiry_id"]},
        {"$set": {"status": "needs_more_candidates"}},
    )
    return HTMLResponse(_response_page(
        "Noted",
        "We&#8217;ll find additional advisors for your request. Expect to hear from us soon."
    ))


# ── Public: founder rejects all candidates ────────────────────────────────────

@router.get("/founder-reject-all/{token}", response_class=HTMLResponse)
def founder_reject_all(token: str):
    offer = db.founder_offers.find_one({"reject_all_token": token}, {"_id": 0})
    if not offer:
        return HTMLResponse(_response_page("Invalid link", "This link is invalid or has expired."), status_code=404)

    if offer.get("founder_response_type") in ("reject_all", "more_options"):
        return HTMLResponse(_response_page(
            "Already noted",
            "We&#8217;ve registered your feedback. The RAGE team will be in touch."
        ))

    now = _now()
    db.founder_offers.update_one(
        {"id": offer["id"]},
        {"$set": {"founder_response_type": "reject_all", "founder_responded_at": now}},
    )
    db.allocations.update_many(
        {"id": {"$in": offer["allocation_ids"]}},
        {"$set": {"status": "not_selected_by_founder", "founder_responded_at": now}},
    )
    db.enquiries.update_one(
        {"id": offer["enquiry_id"]},
        {"$set": {"status": "needs_more_candidates"}},
    )
    return HTMLResponse(_response_page(
        "Noted",
        "Thank you for letting us know. We&#8217;ll review and suggest alternative advisors for your request."
    ))


# ── Admin: send final disclosure email to founder-selected rager(s) ──────────

@router.post("/admin/enquiries/{enquiry_id}/send-final-disclosure")
def send_final_disclosure(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    selected = list(db.allocations.find(
        {"enquiry_id": enquiry_id, "status": "selected_by_founder"},
        {"_id": 0},
    ))
    if not selected:
        raise HTTPException(
            status_code=400,
            detail="No ragers selected by founder yet. Wait for founder to choose from the shortlist.",
        )

    offer = db.founder_offers.find_one(
        {"enquiry_id": enquiry_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    ) or {}

    now = _now()
    sent_count = 0

    for alloc in selected:
        c_tok = secrets.token_urlsafe(32)
        d_tok = secrets.token_urlsafe(32)
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {
                "status":                       "final_disclosure_sent",
                "final_disclose_token":         c_tok,
                "final_disclose_decline_token": d_tok,
                "final_disclosure_sent_at":     now,
            }},
        )
        rager       = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}
        rager_email = rager.get("email") or alloc.get("rager_email", "")
        if not rager_email:
            continue

        confirm_link = f"{BACKEND_URL}/api/rager-final-disclosure/{c_tok}?r=confirm"
        decline_link = f"{BACKEND_URL}/api/rager-final-disclosure/{d_tok}?r=decline"
        _send_email(
            to=[rager_email],
            subject="RAGE: You&#8217;ve Been Selected — Please Confirm",
            html=_rager_final_disclosure_html(rager, enq, offer, alloc, confirm_link, decline_link),
        )
        sent_count += 1

    db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"status": "awaiting_final_confirmation"}},
    )
    return {"status": "sent", "emails_sent": sent_count}


# ── Admin: resend final disclosure to a single rager ─────────────────────────

@router.post("/admin/allocations/{alloc_id}/resend-final-disclosure")
def resend_final_disclosure(alloc_id: str, admin=Depends(require_admin)):
    alloc = db.allocations.find_one({"id": alloc_id}, {"_id": 0})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc["status"] == "rager_final_confirmed":
        raise HTTPException(status_code=400, detail="Rager has already confirmed. No need to resend.")
    if alloc["status"] not in ("final_disclosure_sent", "rager_final_declined"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resend disclosure for allocation with status '{alloc['status']}'.",
        )

    enq   = db.enquiries.find_one({"id": alloc["enquiry_id"]}, {"_id": 0}) or {}
    offer = db.founder_offers.find_one(
        {"enquiry_id": alloc["enquiry_id"]}, {"_id": 0}, sort=[("created_at", -1)]
    ) or {}
    rager       = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0}) or {}
    rager_email = rager.get("email") or alloc.get("rager_email", "")
    if not rager_email:
        raise HTTPException(status_code=400, detail="No email address for this rager.")

    c_tok = secrets.token_urlsafe(32)
    d_tok = secrets.token_urlsafe(32)
    now   = _now()
    db.allocations.update_one(
        {"id": alloc_id},
        {"$set": {
            "status":                       "final_disclosure_sent",
            "final_disclose_token":         c_tok,
            "final_disclose_decline_token": d_tok,
            "final_disclosure_sent_at":     now,
        }},
    )
    confirm_link = f"{BACKEND_URL}/api/rager-final-disclosure/{c_tok}?r=confirm"
    decline_link = f"{BACKEND_URL}/api/rager-final-disclosure/{d_tok}?r=decline"
    _send_email(
        to=[rager_email],
        subject="RAGE: Reminder — Please Confirm Your Selection",
        html=_rager_final_disclosure_html(rager, enq, offer, alloc, confirm_link, decline_link),
    )
    return {"status": "resent", "rager_email": rager_email}


# ── Public: rager responds to final disclosure ────────────────────────────────

@router.get("/rager-final-disclosure/{token}", response_class=HTMLResponse)
def rager_final_disclosure_respond(token: str, r: str):
    if r not in ("confirm", "decline"):
        return HTMLResponse(_response_page("Invalid link", "This link is not valid."), status_code=400)

    field = "final_disclose_token" if r == "confirm" else "final_disclose_decline_token"
    alloc = db.allocations.find_one({field: token}, {"_id": 0})
    if not alloc:
        return HTMLResponse(_response_page("Link not found", "This link is invalid or has expired."), status_code=404)

    if alloc["status"] == "rager_final_confirmed":
        return HTMLResponse(_response_page(
            "Already confirmed",
            "You&#8217;ve already confirmed this session. The RAGE team will be in touch.",
        ))
    if alloc["status"] == "rager_final_declined":
        return HTMLResponse(_response_page(
            "Already responded",
            "You&#8217;ve already indicated you&#8217;re unavailable. Thank you.",
        ))
    if alloc["status"] not in ("final_disclosure_sent",):
        return HTMLResponse(_response_page(
            "Link no longer valid",
            "This link is no longer active. Please contact RAGE if you need assistance.",
        ), status_code=400)

    enquiry_id = alloc["enquiry_id"]
    now        = _now()

    if r == "confirm":
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "rager_final_confirmed", "rager_final_responded_at": now}},
        )
        # Check if all selected ragers have now confirmed
        still_pending = db.allocations.count_documents({
            "enquiry_id": enquiry_id,
            "status":     {"$in": ["selected_by_founder", "final_disclosure_sent"]},
        })
        if still_pending == 0:
            enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0}) or {}
            db.enquiries.update_one(
                {"id": enquiry_id},
                {"$set": {"status": "confirmed_ready_to_schedule", "confirmed_at": now}},
            )
            # Confirmation email to founder (use first confirmed alloc)
            confirmed_allocs = list(db.allocations.find(
                {"enquiry_id": enquiry_id, "status": "rager_final_confirmed"}, {"_id": 0}
            ))
            if confirmed_allocs and enq.get("email"):
                first_alloc = confirmed_allocs[0]
                first_rager = db.ragers.find_one({"id": first_alloc.get("rager_id", "")}, {"_id": 0}) or {}
                _send_email(
                    to=[enq["email"]],
                    subject="RAGE: Session Confirmed",
                    html=_session_confirmed_founder_html(enq, first_alloc, first_rager),
                )
            # Confirmation email to this rager
            this_alloc  = db.allocations.find_one({"id": alloc["id"]}, {"_id": 0}) or {}
            this_rager  = db.ragers.find_one({"id": this_alloc.get("rager_id", "")}, {"_id": 0}) or {}
            rager_email = this_rager.get("email") or this_alloc.get("rager_email", "")
            if rager_email:
                _send_email(
                    to=[rager_email],
                    subject="RAGE: Session Confirmed",
                    html=_session_confirmed_rager_html(enq, this_alloc, this_rager),
                )

        return HTMLResponse(_response_page(
            "Confirmed",
            "Thank you &#8212; we&#8217;ve noted your confirmation. "
            "You&#8217;ll receive final session details shortly.",
        ))

    else:  # decline
        db.allocations.update_one(
            {"id": alloc["id"]},
            {"$set": {"status": "rager_final_declined", "rager_final_responded_at": now}},
        )
        return HTMLResponse(_response_page(
            "Noted",
            "Thank you for letting us know. We&#8217;ll notify the RAGE team to make alternative arrangements.",
        ))


# ── Admin: auto-suggest ragers for an enquiry ────────────────────────────────

@router.get("/admin/enquiries/{enquiry_id}/auto-suggest")
def auto_suggest_ragers(enquiry_id: str, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    existing_ids = {
        a["rager_id"]
        for a in db.allocations.find({"enquiry_id": enquiry_id}, {"_id": 0, "rager_id": 1})
    }

    product  = enq.get("product", "closed_table")
    keywords = set()
    for item in (enq.get("help_items") or []):
        keywords.update(w.lower() for w in str(item).split()[:3])
    if enq.get("problem"):
        keywords.update(w.lower() for w in str(enq["problem"]).split()[:12])

    all_ragers = list(db.ragers.find(
        {"id": {"$nin": list(existing_ids)}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "title": 1, "company": 1, "bio": 1,
         "categories": 1, "table_types": 1, "is_public": 1, "photo_url": 1},
    ))

    def score(r):
        s = 0
        cats = set(c.lower() for c in (r.get("categories") or []))
        s += len(keywords & cats) * 2
        for cat in cats:
            for kw in keywords:
                if kw in cat or cat in kw:
                    s += 1
        if product in (r.get("table_types") or []):
            s += 3
        if r.get("is_public"):
            s += 1
        return s

    scored = sorted(all_ragers, key=score, reverse=True)
    return scored[:10]


# ── Admin: add an external / manually sourced rager to an enquiry ─────────────

@router.post("/admin/enquiries/{enquiry_id}/add-manual-rager")
def add_manual_rager(enquiry_id: str, data: ManualRagerRequest, admin=Depends(require_admin)):
    from app.services.tokens import create_outreach_tokens
    from app.services.outreach import _brief_email_html

    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    # Re-use existing rager record if email matches
    rager = db.ragers.find_one({"email": data.email}, {"_id": 0})
    if not rager:
        rager = {
            "id":          str(uuid.uuid4()),
            "name":        data.name,
            "email":       data.email,
            "title":       data.title,
            "company":     data.company,
            "bio":         data.bio,
            "categories":  data.categories,
            "table_types": [],
            "is_public":   False,
            "provisional": True,
            "created_at":  _now(),
        }
        db.ragers.insert_one(rager)
        rager.pop("_id", None)

    if db.allocations.find_one({"enquiry_id": enquiry_id, "rager_id": rager["id"]}):
        raise HTTPException(status_code=400, detail=f"{data.name} is already allocated to this enquiry.")

    brief_doc = db.anonymised_briefs.find_one(
        {"enquiry_id": enquiry_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    brief = brief_doc["brief_data"] if brief_doc else None

    allocation = {
        "id":                   str(uuid.uuid4()),
        "enquiry_id":           enquiry_id,
        "rager_id":             rager["id"],
        "rager_name":           rager["name"],
        "rager_email":          rager.get("email", ""),
        "cost_to_founder":      data.cost_to_founder,
        "payout_to_rager":      data.payout_to_rager,
        "status":               "pending_rager",
        "brief_id":             brief["brief_id"] if brief else "",
        "created_at":           _now(),
        "rager_responded_at":   None,
        "founder_responded_at": None,
        "manually_added":       True,
    }
    db.allocations.insert_one(allocation)
    allocation.pop("_id", None)

    if brief and rager.get("email"):
        tokens = create_outreach_tokens(enquiry_id, rager["id"], brief["brief_id"])
        email_brief = dict(brief)
        if data.payout_to_rager:
            email_brief["what_they_need"] = (
                email_brief["what_they_need"]
                + f"\n\nYour advisory fee for this session: {_fmt_inr(data.payout_to_rager)}"
            )
        _send_email(
            to=[rager["email"]],
            subject=f"RAGE: Advisory Request — {brief.get('decision_label', '')}",
            html=_brief_email_html(email_brief, rager["name"].split()[0], tokens),
        )

    return {"status": "added", "allocation": allocation, "rager_id": rager["id"]}
