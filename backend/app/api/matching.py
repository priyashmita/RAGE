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
from typing import List
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "https://rage-production.up.railway.app")
FROM_EMAIL = "RAGE <hello@rageforgood.com>"


# ── Pydantic models ────────────────────────────────────────────────────────────

class RagerMatch(BaseModel):
    rager_id: str
    cost_to_founder: int   # INR
    payout_to_rager: int   # INR


class MatchRequest(BaseModel):
    ragers: List[RagerMatch]


class ConfirmRequest(BaseModel):
    allocation_id: str


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


# ── Admin: step 1 — send anon emails to selected Ragers ───────────────────────

@router.post("/admin/enquiries/{enquiry_id}/match")
def match_enquiry(enquiry_id: str, data: MatchRequest, admin=Depends(require_admin)):
    enq = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enq:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if enq.get("status") not in ("new", "matching"):
        raise HTTPException(status_code=400, detail=f"Cannot match enquiry with status '{enq['status']}'")

    created = []
    for rm in data.ragers:
        rager = db.ragers.find_one({"id": rm.rager_id}, {"_id": 0})
        if not rager:
            raise HTTPException(status_code=404, detail=f"Rager {rm.rager_id} not found")

        anon_token = str(uuid.uuid4())
        allocation = {
            "id": str(uuid.uuid4()),
            "enquiry_id": enquiry_id,
            "rager_id": rm.rager_id,
            "rager_name": rager["name"],
            "rager_email": rager.get("email", ""),
            "cost_to_founder": rm.cost_to_founder,
            "payout_to_rager": rm.payout_to_rager,
            "status": "pending_rager",
            "anon_token": anon_token,
            "created_at": _now(),
            "rager_responded_at": None,
            "founder_responded_at": None,
        }
        db.allocations.insert_one(allocation)
        allocation.pop("_id", None)
        created.append(allocation)

        # Send anonymised email to Rager
        accept_link = f"{BACKEND_URL}/api/respond/{anon_token}?r=accept"
        decline_link = f"{BACKEND_URL}/api/respond/{anon_token}?r=decline"
        format_label = enq.get("format", "Advisory Session").replace("_", " ").title()
        challenge = enq.get("challenge") or enq.get("message", "Not specified")

        _send_email(
            to=[rager["email"]],
            subject=f"RAGE: Advisory Request — {format_label}",
            html=f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">Advisory Request</h1>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;">Hi {rager['name'].split()[0]},</p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;">A founder in the RAGE network has submitted an advisory request and we think you'd be a strong match.</p>

    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:16px 20px;margin:24px 0;">
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#71717a;margin:0 0 8px;">Format</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">{format_label}</p>
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#71717a;margin:0 0 8px;">What they need help with</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0;">{challenge}</p>
    </div>

    <p style="color:#52525b;font-size:13px;line-height:1.7;font-style:italic;">Under Chatham House Rule — the founder's identity will only be shared once both parties confirm.</p>

    <p style="color:#1a1a1a;font-size:15px;margin:28px 0 16px;font-weight:600;">Are you available for this session?</p>

    <table style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:0 8px 0 0;width:50%;">
          <a href="{accept_link}" style="display:block;background:#dc143c;color:#fff;text-align:center;padding:14px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;">Yes, I'm available</a>
        </td>
        <td style="padding:0 0 0 8px;width:50%;">
          <a href="{decline_link}" style="display:block;background:#fff;color:#1a1a1a;text-align:center;padding:14px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;font-weight:600;border:1px solid #e5e5e5;">Not this time</a>
        </td>
      </tr>
    </table>

    <p style="color:#a1a1aa;font-size:12px;margin-top:24px;">If you've already responded or have questions, reply to this email.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>""",
        )

    db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"status": "pending_rager", "matched_at": _now()}}
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

    # Build profile cards for email (no contact details)
    profiles_html = ""
    for alloc in accepted:
        rager = db.ragers.find_one({"id": alloc["rager_id"]}, {"_id": 0, "email": 0, "phone": 0}) or {}
        name = rager.get("name", alloc["rager_name"])
        title = rager.get("title", "")
        company = rager.get("company", "")
        bio = rager.get("bio", "")
        cats = ", ".join(rager.get("categories", []))
        profiles_html += f"""
<div style="border:1px solid #e5e5e5;padding:20px;margin-bottom:16px;">
  <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">{name}</p>
  <p style="font-size:12px;color:#dc143c;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">{title}{' · ' + company if company else ''}</p>
  {f'<p style="font-size:13px;color:#52525b;line-height:1.6;margin:0 0 10px;">{bio}</p>' if bio else ''}
  {f'<p style="font-size:11px;color:#a1a1aa;">{cats}</p>' if cats else ''}
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
      {len(accepted)} advisor{'s have' if len(accepted) > 1 else ' has'} confirmed availability for your request.
      Please review the profiles below and reply to this email with your preferred choice.
    </p>
    {profiles_html}
    <p style="color:#52525b;font-size:13px;line-height:1.7;margin-top:24px;">
      Once you confirm, we'll share full contact details and session logistics with both parties.
      If none of the profiles feel like the right fit, let us know — we'll keep looking.
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity</p>
  </div>
</div>""",
    )

    # Mark accepted allocations as pending_founder
    db.allocations.update_many(
        {"enquiry_id": enquiry_id, "status": "rager_accepted"},
        {"$set": {"status": "pending_founder"}}
    )
    db.enquiries.update_one({"id": enquiry_id}, {"$set": {"status": "pending_founder"}})
    return {"status": "founder_notified", "advisors_shown": len(accepted)}


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
