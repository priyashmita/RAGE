"""
Public email-first response endpoint.
No login required. Ragers respond to anonymized requests via tokenized links.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.db import db
from app.core.audit import write_audit

router = APIRouter()

ANON_TOKEN_EXPIRY_DAYS = 7

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

class RespondRequest(BaseModel):
    response: str           # "accept" | "decline"
    notes:    Optional[str] = None

# ── GET — load brief before responding ───────────────────────────────────────

@router.get("/respond/{anon_token}")
def get_response_brief(anon_token: str):
    candidate = db.match_candidates.find_one({"anon_token": anon_token}, {"_id": 0})

    if not candidate:
        raise HTTPException(status_code=404, detail="Link not found")

    # Check expiry
    sent_at = candidate.get("sent_at")
    if sent_at:
        if isinstance(sent_at, str):
            from datetime import datetime
            try:
                sent_dt = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
            except ValueError:
                sent_dt = None
        else:
            sent_dt = sent_at

        if sent_dt and (datetime.now(timezone.utc) - sent_dt).days >= ANON_TOKEN_EXPIRY_DAYS:
            return {
                "valid":    False,
                "reason":   "expired",
                "message":  "This link has expired. Contact the RAGE team if you're still interested.",
            }

    # Already responded
    if candidate.get("responded_at"):
        return {
            "valid":    True,
            "status":   candidate["status"],
            "already_responded": True,
            "message":  "You've already responded to this request.",
        }

    # Load the anonymised brief from the request
    request = db.founder_requests.find_one(
        {"id": candidate["request_id"]}, {"_id": 0}
    ) or {}

    return {
        "valid":           True,
        "already_responded": False,
        "status":          candidate["status"],
        "brief":           request.get("anon_brief", ""),
        "challenge":       request.get("challenge", ""),
        "sector":          request.get("sector", ""),
        "stage":           request.get("stage", ""),
        "geography":       request.get("geography", ""),
        "decision_type":   request.get("decision_type", ""),
        "fee":             candidate.get("payout_amount"),
    }

# ── POST — submit response ────────────────────────────────────────────────────

@router.post("/respond/{anon_token}")
def submit_response(anon_token: str, payload: RespondRequest):
    if payload.response not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="response must be 'accept' or 'decline'")

    candidate = db.match_candidates.find_one({"anon_token": anon_token}, {"_id": 0})

    if not candidate:
        raise HTTPException(status_code=404, detail="Link not found")

    # Idempotency guard — reject if already responded
    if candidate.get("responded_at"):
        return {
            "ok":               True,
            "already_responded": True,
            "status":           candidate["status"],
        }

    # Expiry check
    sent_at = candidate.get("sent_at")
    if sent_at:
        if isinstance(sent_at, str):
            from datetime import datetime as dt
            try:
                sent_dt = dt.fromisoformat(sent_at.replace("Z", "+00:00"))
            except ValueError:
                sent_dt = None
        else:
            sent_dt = sent_at

        if sent_dt and (datetime.now(timezone.utc) - sent_dt).days >= ANON_TOKEN_EXPIRY_DAYS:
            raise HTTPException(
                status_code=410,
                detail="This link has expired — contact the RAGE team if you're still interested",
            )

    now        = _now()
    new_status = "accepted" if payload.response == "accept" else "declined"

    db.match_candidates.update_one(
        {"anon_token": anon_token},
        {"$set": {
            "status":       new_status,
            "responded_at": now,
            "response_notes": payload.notes,
        }},
    )

    # Cancel pending reminder jobs for this candidate
    db.reminder_jobs.update_many(
        {"entity_type": "match_candidate", "entity_id": candidate["id"], "status": "pending"},
        {"$set": {"status": "cancelled"}},
    )

    # Update email log
    db.email_logs.update_many(
        {"anon_token": anon_token, "status": {"$in": ["sent", "clicked"]}},
        {"$set": {"status": "responded", "responded_at": now}},
    )

    write_audit(
        action="rager.response_submitted",
        entity_type="match_candidate",
        entity_id=candidate["id"],
        metadata={
            "response":      payload.response,
            "request_id":    candidate.get("request_id"),
            "rager_id":      candidate.get("rager_id"),
            "recipient_email": candidate.get("recipient_email"),
        },
        actor=None,  # public endpoint, no login
    )

    # Check if all candidates for this request have now responded
    request_id = candidate.get("request_id")
    if request_id:
        pending_count = db.match_candidates.count_documents({
            "request_id": request_id,
            "status":     "sent",
            "responded_at": None,
        })
        if pending_count == 0:
            # All responded — move request to shortlist-ready state
            db.founder_requests.update_one(
                {"id": request_id, "status": "briefed"},
                {"$set": {"status": "matching", "updated_at": now}},
            )

    return {
        "ok":     True,
        "status": new_status,
        "message": (
            "Thank you — we'll be in touch shortly."
            if payload.response == "accept"
            else "Noted — thank you for letting us know."
        ),
    }
