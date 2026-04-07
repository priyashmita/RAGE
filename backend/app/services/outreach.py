import os
import httpx
from datetime import datetime, timezone

from app.core.db import db
from app.services.anonymisation import generate_anonymised_brief
from app.services.tokens import create_outreach_tokens

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
BACKEND_URL    = os.getenv("BACKEND_URL", "https://rage-production.up.railway.app")
FROM_EMAIL     = "R.A.G.E. <noreply@rageforchange.com>"

FORMAT_LABEL = {
    "1on1":        "1:1 Advisory",
    "small_group": "Curated Small Group",
    "not_sure":    "Open to recommendation",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _brief_email_html(brief: dict, tokens: dict) -> str:
    accept_url      = f"{BACKEND_URL}/api/public/outreach/respond?token={tokens['accept']}"
    decline_url     = f"{BACKEND_URL}/api/public/outreach/respond?token={tokens['decline']}"
    need_context_url = f"{BACKEND_URL}/api/public/outreach/respond?token={tokens['need_context']}"

    help_items_html = ""
    if brief.get("help_needed"):
        items = "".join(
            f'<li style="color:#52525b;font-size:14px;line-height:1.8;margin-bottom:2px;">{h}</li>'
            for h in brief["help_needed"]
        )
        help_items_html = f"""
        <tr><td colspan="2" style="padding-top:14px;">
          <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                    color:#9ca3af;margin:0 0 6px;">Support areas</p>
          <ul style="margin:0;padding-left:18px;">{items}</ul>
        </td></tr>"""

    fmt = FORMAT_LABEL.get(brief.get("preferred_format", "not_sure"), "Open to recommendation")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RAGE: New Advisory Opportunity</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f0;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="background:#ffffff;max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="border-bottom:3px solid #dc143c;padding:32px 40px 24px;">
          <p style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;
                    color:#dc143c;margin:0 0 10px;">R.A.G.E.</p>
          <h1 style="font-size:24px;font-weight:400;color:#111827;margin:0;line-height:1.3;">
            New Advisory Opportunity
          </h1>
        </td>
      </tr>

      <!-- Intro -->
      <tr>
        <td style="padding:28px 40px 0;">
          <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0;">
            A founder in the RAGE network has requested an advisory session.
            We think you may be a strong match.
          </p>
          <p style="font-size:12px;color:#9ca3af;font-style:italic;margin:10px 0 0;">
            Under Chatham House Rule — no identifying information is included below.
            Full founder details are shared only after both parties confirm.
          </p>
        </td>
      </tr>

      <!-- Brief card -->
      <tr>
        <td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#fafaf8;border-left:3px solid #dc143c;padding:20px 24px;">
            <tr>
              <td style="width:50%;padding-right:16px;vertical-align:top;">
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Focus area</p>
                <p style="font-size:15px;color:#111827;margin:0 0 16px;font-weight:500;">
                  {brief["industry"]}
                </p>
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Stage</p>
                <p style="font-size:15px;color:#111827;margin:0 0 16px;">
                  {brief["stage"]}
                </p>
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Revenue band</p>
                <p style="font-size:15px;color:#111827;margin:0;">
                  {brief["revenue_band"]}
                </p>
              </td>
              <td style="width:50%;padding-left:16px;vertical-align:top;
                         border-left:1px solid #e5e7eb;">
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Region</p>
                <p style="font-size:15px;color:#111827;margin:0 0 16px;">
                  {brief["region"]}
                </p>
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Urgency</p>
                <p style="font-size:15px;color:#111827;margin:0 0 16px;">
                  {brief["urgency"]}
                </p>
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 4px;">Format</p>
                <p style="font-size:15px;color:#111827;margin:0;">
                  {fmt}
                </p>
              </td>
            </tr>
            {help_items_html}
            <tr>
              <td colspan="2" style="padding-top:20px;border-top:1px solid #e5e7eb;margin-top:16px;">
                <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;
                          color:#9ca3af;margin:0 0 8px;">What they're working through</p>
                <p style="font-size:14px;color:#374151;line-height:1.75;margin:0;">
                  {brief["problem_summary"]}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:8px 40px 32px;">
          <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 6px;">
            Are you available for this session?
          </p>
          <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">
            Click one of the options below — no login required.
          </p>

          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding-right:8px;width:33%;">
                <a href="{accept_url}"
                   style="display:block;background:#dc143c;color:#ffffff;text-align:center;
                          padding:14px 8px;font-size:11px;letter-spacing:0.12em;
                          text-transform:uppercase;text-decoration:none;font-weight:700;">
                  I'm Interested
                </a>
              </td>
              <td style="padding:0 4px;width:33%;">
                <a href="{need_context_url}"
                   style="display:block;background:#ffffff;color:#111827;text-align:center;
                          padding:14px 8px;font-size:11px;letter-spacing:0.12em;
                          text-transform:uppercase;text-decoration:none;font-weight:600;
                          border:1px solid #d1d5db;">
                  Need More Context
                </a>
              </td>
              <td style="padding-left:8px;width:33%;">
                <a href="{decline_url}"
                   style="display:block;background:#ffffff;color:#9ca3af;text-align:center;
                          padding:14px 8px;font-size:11px;letter-spacing:0.12em;
                          text-transform:uppercase;text-decoration:none;font-weight:500;
                          border:1px solid #e5e7eb;">
                  Not for Me
                </a>
              </td>
            </tr>
          </table>

          <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;">
            Links expire in 7 days. If you have questions, reply to this email.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9f9f7;padding:16px 40px;border-top:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">
            &copy; {datetime.now().year} R.A.G.E. &mdash; Radical Alliance for Gender Equity
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


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
    results = []

    for rager in ragers:
        email = rager.get("email", "")

        if not email:
            results.append({"rager_id": rager["id"], "status": "skipped", "reason": "no email"})
            continue

        tokens = create_outreach_tokens(enquiry_id, rager["id"], brief["brief_id"])
        html   = _brief_email_html(brief, tokens)

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
            status, error = ("sent", None) if resp.status_code in (200, 201) else ("failed", resp.text[:300])
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
