"""
RAGE Matching Workflow
======================
Enquiry → Admin matches → Anon email to Ragers → Rager responds →
Admin notifies Founder → Founder picks → Confirmation email to all
"""
import uuid
import os
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


# ── Admin: send shortlisted ragers to founder ─────────────────────────────────

@router.post("/admin/enquiries/{enquiry_id}/send-shortlist")
def send_shortlist(enquiry_id: str, admin=Depends(require_admin)):
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
    if enq.get("status") not in ("confirmed", "founder_accepted"):
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

    # Accept: explicitly shortlisted rager_accepted OR any pending_founder (old send-shortlist flow)
    shortlisted = list(db.allocations.find(
        {"enquiry_id": enquiry_id,
         "$or": [
             {"shortlist_status": "shortlisted", "status": "rager_accepted"},
             {"status": "pending_founder"},
         ]},
        {"_id": 0}
    ))
    if not shortlisted:
        raise HTTPException(status_code=400, detail="No accepted ragers found for this enquiry.")

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
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    offer = db.founder_offers.find_one({"enquiry_id": enquiry_id, "status": "draft"}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=400, detail="No draft offer found. Save a draft first.")

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

    db.founder_offers.update_one({"id": offer["id"]}, {"$set": {"status": "sent", "sent_at": _now()}})
    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder_offer"}})
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

    now = _now()
    db.founder_offers.update_one(
        {"id": offer["id"]},
        {"$set": {"founder_response": r, "founder_responded_at": now}}
    )

    if r == "accept":
        db.allocations.update_many(
            {"id": {"$in": offer["allocation_ids"]}},
            {"$set": {"status": "confirmed", "founder_responded_at": now}}
        )
        db.enquiries.update_one(
            {"id": offer["enquiry_id"]},
            {"$set": {"status": "founder_accepted", "confirmed_at": now}}
        )
        return HTMLResponse(_response_page(
            "Proposal Accepted",
            "Thank you — you&#8217;ve accepted the session proposal. RAGE will be in touch with full details shortly."
        ))
    else:
        db.enquiries.update_one(
            {"id": offer["enquiry_id"]},
            {"$set": {"status": "founder_rejected"}}
        )
        return HTMLResponse(_response_page(
            "Proposal Declined",
            "Thank you for letting us know. We&#8217;ll review and reach out with alternative options."
        ))
