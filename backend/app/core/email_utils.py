import os
import uuid
from datetime import datetime, timezone
from app.core.db import db

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL   = os.getenv("FRONTEND_URL", "https://rage-v5xv.vercel.app")
FROM_EMAIL     = "R.A.G.E. <noreply@rageforchange.com>"


def send_email(
    to_email:    str,
    to_name:     str,
    template:    str,
    subject:     str,
    html_body:   str,
    entity_type: str,
    entity_id:   str,
    anon_token:  str | None = None,
) -> dict:
    """
    Send via Resend, write an EmailLog entry.
    Returns {"sent": bool, "message_id": str|None, "error": str|None}.
    Raises RuntimeError if RESEND_API_KEY is configured but the send fails,
    so callers can surface the failure. Silent no-op only in dev (no API key).
    """
    resend_message_id = None
    status    = "queued"
    error_msg = None

    if not RESEND_API_KEY:
        error_msg = "RESEND_API_KEY not configured — email not sent"
        status    = "failed"
        print(f"[email] BLOCKED — {error_msg}")
    else:
        try:
            import resend
            resend.api_key = RESEND_API_KEY
            req_payload = {
                "from":    FROM_EMAIL,
                "to":      to_email,
                "subject": subject,
            }
            print(f"[email] Sending — payload: {req_payload}")
            resp = resend.Emails.send({
                "from":    FROM_EMAIL,
                "to":      to_email,
                "subject": subject,
                "html":    html_body,
            })
            print(f"[email] Resend response: {resp!r}")
            resend_message_id = (
                resp.get("id") if isinstance(resp, dict)
                else getattr(resp, "id", None)
            )
            status = "sent"
            print(f"[email] Sent OK — message_id={resend_message_id}")
        except Exception as exc:
            error_msg = str(exc)
            status    = "failed"
            print(f"[email] FAILED — {error_msg}")

    db.email_logs.insert_one({
        "id":                str(uuid.uuid4()),
        "to_email":          to_email,
        "to_name":           to_name,
        "template":          template,
        "subject":           subject,
        "entity_type":       entity_type,
        "entity_id":         entity_id,
        "status":            status,
        "anon_token":        anon_token,
        "resend_message_id": resend_message_id,
        "sent_at":           datetime.now(timezone.utc).isoformat() if status == "sent" else None,
        "opened_at":         None,
        "clicked_at":        None,
        "responded_at":      None,
        "error":             error_msg,
    })

    if status == "failed":
        raise RuntimeError(f"Email send failed: {error_msg}")

    return {"email_sent": status == "sent", "message_id": resend_message_id, "email_error": error_msg}


# ── Email HTML templates ──────────────────────────────────────────────────────

def _base(content: str) -> str:
    return f"""
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;
            padding:48px 32px;background:#f9f7f2;color:#1a1a1a;">
  <p style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;
             color:#8a8a8a;margin:0 0 40px;">R.A.G.E.</p>
  {content}
  <hr style="border:none;border-top:1px solid #e8e4dc;margin:40px 0 24px;">
  <p style="font-size:12px;color:#aaa;margin:0;">
    Radical Alliance for Gender Equity · rageforchange.com
  </p>
</div>"""


def invite_email_html(name: str, setup_url: str, role: str) -> str:
    role_label = role.capitalize()
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    You've been invited to RAGE
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 32px;">
    You have been added as a <strong>{role_label}</strong> on the RAGE platform.
    Click below to set up your account and access your dashboard.
  </p>
  <a href="{setup_url}"
     style="display:inline-block;background:#1c2b1c;color:#fff;
            text-decoration:none;padding:14px 28px;font-size:12px;
            letter-spacing:0.06em;text-transform:uppercase;">
    Set Up Your Account
  </a>
  <p style="font-size:13px;color:#888;margin:32px 0 0;">
    This link expires in 72 hours.
  </p>""")


# ── Private Table email templates ────────────────────────────────────────────

def event_invite_html(
    name: str,
    event_title: str,
    event_date: str,
    location: str,
    theme: str,
    rsvp_url: str,
) -> str:
    theme_line = f"""
  <p style="font-size:13px;color:#8a8a8a;margin:0 0 32px;letter-spacing:0.03em;">
    Theme: {theme}
  </p>""" if theme else ""
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    You're invited to {event_title}
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px;">
    We'd love to have you join us for an intimate evening with fellow founders
    and industry leaders.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 32px;">
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:12px;
                 letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;
                 width:30%;">Date</td>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:14px;color:#1a1a1a;">
        {event_date}
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:12px;
                 letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;">
        Location
      </td>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:14px;color:#1a1a1a;">
        {location}
      </td>
    </tr>
  </table>
  {theme_line}
  <a href="{rsvp_url}"
     style="display:inline-block;background:#1c2b1c;color:#fff;
            text-decoration:none;padding:14px 28px;font-size:12px;
            letter-spacing:0.06em;text-transform:uppercase;">
    RSVP Now
  </a>
  <p style="font-size:13px;color:#888;margin:32px 0 0;">
    Seats are limited. Please respond at your earliest convenience.
  </p>""")


def preread_request_html(name: str, event_title: str, preread_url: str) -> str:
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    Your pre-read for {event_title}
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px;">
    To make the most of your evening, we ask each guest to complete a short
    pre-read form. Your responses help us curate conversations and introductions
    tailored to the room.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#666;margin:0 0 32px;">
    It takes about 5 minutes. Your answers are shared with other confirmed guests
    ahead of the dinner — except your open question, which is for our team only.
  </p>
  <a href="{preread_url}"
     style="display:inline-block;background:#1c2b1c;color:#fff;
            text-decoration:none;padding:14px 28px;font-size:12px;
            letter-spacing:0.06em;text-transform:uppercase;">
    Complete Pre-read
  </a>""")


def event_confirmation_html(
    name: str,
    event_title: str,
    event_date: str,
    location: str,
    dress_code: str,
    package_url: str,
) -> str:
    dress_line = f"""
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:12px;
                 letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;
                 width:30%;">Dress</td>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:14px;color:#1a1a1a;">
        {dress_code}
      </td>
    </tr>""" if dress_code else ""
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    See you at {event_title}
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px;">
    You're confirmed. Here are your details for the evening.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 32px;">
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:12px;
                 letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;
                 width:30%;">Date</td>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:14px;color:#1a1a1a;">
        {event_date}
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:12px;
                 letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;">
        Location
      </td>
      <td style="padding:10px 0;border-top:1px solid #e8e4dc;font-size:14px;color:#1a1a1a;">
        {location}
      </td>
    </tr>
    {dress_line}
  </table>
  <p style="font-size:14px;line-height:1.7;color:#666;margin:0 0 24px;">
    Your pre-read package is ready — meet the other guests before you arrive.
  </p>
  <a href="{package_url}"
     style="display:inline-block;background:#1c2b1c;color:#fff;
            text-decoration:none;padding:14px 28px;font-size:12px;
            letter-spacing:0.06em;text-transform:uppercase;">
    View Pre-read Package
  </a>""")


def intro_email_html(
    to_name: str,
    other_name: str,
    other_company: str,
    other_title: str,
    other_blurb: str,
    other_linkedin: str,
    reason: str,
    event_title: str,
) -> str:
    linkedin_line = f"""
  <p style="margin:16px 0 0;">
    <a href="{other_linkedin}"
       style="font-size:13px;color:#1c2b1c;text-decoration:underline;">
      View LinkedIn Profile
    </a>
  </p>""" if other_linkedin else ""
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    Meet {other_name}
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {to_name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px;">
    Following {event_title}, we think you and {other_name} should connect.
  </p>
  <div style="background:#fff;border:1px solid #e8e4dc;padding:20px 24px;margin:0 0 24px;">
    <p style="font-size:15px;font-weight:500;color:#1a1a1a;margin:0 0 4px;">
      {other_name}
    </p>
    <p style="font-size:13px;color:#666;margin:0 0 12px;">
      {other_title}{"," if other_title and other_company else ""} {other_company}
    </p>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0;">
      {other_blurb}
    </p>
    {linkedin_line}
  </div>
  <p style="font-size:14px;line-height:1.7;color:#666;margin:0;">
    {reason}
  </p>""")


# ── Standard templates ────────────────────────────────────────────────────────

def reset_email_html(name: str, reset_url: str) -> str:
    return _base(f"""
  <h2 style="font-size:22px;font-weight:400;margin:0 0 16px;">
    Reset your password
  </h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px;">
    Hi {name},
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 32px;">
    We received a request to reset your RAGE password.
    Click below to choose a new one.
  </p>
  <a href="{reset_url}"
     style="display:inline-block;background:#1c2b1c;color:#fff;
            text-decoration:none;padding:14px 28px;font-size:12px;
            letter-spacing:0.06em;text-transform:uppercase;">
    Reset Password
  </a>
  <p style="font-size:13px;color:#888;margin:32px 0 0;">
    This link expires in 2 hours. If you didn't request this, ignore this email.
  </p>""")
