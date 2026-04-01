import os
import uuid
from datetime import datetime, timezone
from app.core.db import db

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL   = os.getenv("FRONTEND_URL", "https://rage-v5xv.vercel.app")
FROM_EMAIL     = "R.A.G.E. <hello@rage.community>"


def send_email(
    to_email:    str,
    to_name:     str,
    template:    str,
    subject:     str,
    html_body:   str,
    entity_type: str,
    entity_id:   str,
    anon_token:  str | None = None,
) -> str | None:
    """
    Send via Resend, write an EmailLog entry.
    Returns resend message id, or None in dev mode (no API key).
    Never raises — email failure must not crash the calling request.
    """
    resend_message_id = None
    status = "queued"
    error_msg = None

    if RESEND_API_KEY:
        try:
            import resend
            resend.api_key = RESEND_API_KEY
            resp = resend.Emails.send({
                "from":    FROM_EMAIL,
                "to":      to_email,
                "subject": subject,
                "html":    html_body,
            })
            resend_message_id = (
                resp.get("id") if isinstance(resp, dict)
                else getattr(resp, "id", None)
            )
            status = "sent"
        except Exception as exc:
            status = "queued"
            error_msg = str(exc)

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

    return resend_message_id


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
    Radical Alliance for Gender Equity · rage.community
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
