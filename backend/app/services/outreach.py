import os
import httpx
from datetime import datetime, timezone

from app.core.db import db
from app.services.anonymisation import generate_anonymised_brief

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL     = "R.A.G.E. <noreply@rageforchange.com>"

FORMAT_LABEL = {
    "1on1":        "1:1 Advisory",
    "small_group": "Curated Small Group",
    "not_sure":    "Open to recommendation",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _brief_email_html(brief: dict) -> str:
    help_items_html = ""
    if brief.get("help_needed"):
        items = "".join(
            f'<li style="color:#52525b;font-size:13px;margin-bottom:4px;">{h}</li>'
            for h in brief["help_needed"]
        )
        help_items_html = f"""
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:16px 0 6px;">Support needed</p>
      <ul style="margin:0;padding-left:18px;">{items}</ul>"""

    fmt = FORMAT_LABEL.get(brief.get("preferred_format", "not_sure"), "Open to recommendation")

    return f"""
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 20px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;
              color:#dc143c;margin:0 0 6px;">R.A.G.E.</p>
    <h1 style="font-size:22px;font-weight:400;margin:0;">New Advisory Opportunity</h1>
  </div>

  <div style="padding:32px 40px;">
    <p style="color:#52525b;font-size:14px;line-height:1.7;margin:0 0 24px;">
      A founder in the RAGE network has requested an advisory session.
      Details are shared under Chatham House Rule — no identifying information is included.
    </p>

    <div style="background:#f9f9f9;border-left:3px solid #dc143c;padding:20px 24px;margin:0 0 24px;">
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:0 0 6px;">Focus area</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">{brief["industry"]}</p>

      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:0 0 6px;">Business stage</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">
        {brief["stage"]} &nbsp;&middot;&nbsp; {brief["revenue_band"]}
      </p>

      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:0 0 6px;">Urgency</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">{brief["urgency"]}</p>

      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:0 0 6px;">What they're working through</p>
      <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0;">{brief["problem_summary"]}</p>

      {help_items_html}

      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                color:#71717a;margin:16px 0 6px;">Preferred format</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0;">{fmt}</p>
    </div>

    <p style="color:#1a1a1a;font-size:15px;font-weight:600;margin:0 0 8px;">
      Interested in this opportunity?
    </p>
    <p style="color:#52525b;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Reply to this email and we will send you the full brief with founder details.
    </p>

    <p style="color:#a1a1aa;font-size:12px;margin:0;font-style:italic;">
      Under Chatham House Rule — founder identity is shared only after both parties confirm.
    </p>
  </div>

  <div style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">
      © {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity
    </p>
  </div>
</div>"""


def send_anonymised_outreach(enquiry_id: str, rager_ids: list) -> dict:
    enquiry = db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enquiry:
        raise ValueError(f"Enquiry {enquiry_id} not found")

    brief = generate_anonymised_brief(enquiry)

    db.anonymised_briefs.insert_one({
        "brief_id":   brief["brief_id"],
        "enquiry_id": enquiry_id,
        "brief_data": brief,
        "created_at": _now(),
    })

    ragers = list(db.ragers.find({"id": {"$in": rager_ids}}, {"_id": 0}))
    if not ragers:
        raise ValueError("No matching ragers found for given rager_ids")

    subject = "RAGE: New Advisory Opportunity"
    html    = _brief_email_html(brief)
    results = []

    for rager in ragers:
        email = rager.get("email", "")

        if not email:
            results.append({"rager_id": rager["id"], "status": "skipped", "reason": "no email"})
            continue

        if not RESEND_API_KEY:
            results.append({"rager_id": rager["id"], "status": "skipped", "reason": "RESEND_API_KEY not set"})
            continue

        try:
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "from":    FROM_EMAIL,
                    "to":      [email],
                    "subject": subject,
                    "html":    html,
                },
                timeout=15,
            )
            if resp.status_code in (200, 201):
                status, error = "sent", None
            else:
                status, error = "failed", resp.text[:300]
        except Exception as exc:
            status, error = "failed", str(exc)[:300]

        results.append({
            "rager_id": rager["id"],
            "name":     rager.get("name", ""),
            "email":    email,
            "status":   status,
            "error":    error,
        })

    return {
        "brief_id":   brief["brief_id"],
        "enquiry_id": enquiry_id,
        "emails":     results,
        "sent":       sum(1 for r in results if r["status"] == "sent"),
        "failed":     sum(1 for r in results if r["status"] == "failed"),
        "skipped":    sum(1 for r in results if r["status"] == "skipped"),
    }
