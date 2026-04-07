import uuid
import os
import httpx
from collections import Counter
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()


class AllocationCreateRequest(BaseModel):
    id: str
    enquiry_id: str
    member_id: str
    status: str = "pending"


class AnonymisedOutreachRequest(BaseModel):
    enquiry_id: str
    rager_ids: List[str]


class ReportIn(BaseModel):
    title: str
    period: Optional[str] = ""
    summary: str
    themes: Optional[List[str]] = []
    data_points: Optional[List[str]] = []
    notes: Optional[str] = ""
    is_public: Optional[bool] = False


class EmailReportRequest(BaseModel):
    recipients: List[str]


class TranscriptRequest(BaseModel):
    transcript: str
    context: Optional[str] = ""


@router.get("/admin/enquiries")
def get_enquiries(admin=Depends(require_admin)):
    return list(db.enquiries.find({}, {"_id": 0}))


@router.get("/admin/allocations")
def get_allocations(admin=Depends(require_admin)):
    return list(db.allocations.find({}, {"_id": 0}))


@router.post("/admin/allocations")
def create_allocation(data: AllocationCreateRequest, admin=Depends(require_admin)):
    db.allocations.insert_one(data.dict())
    return {"status": "created"}


@router.get("/admin/stats")
def get_stats(admin=Depends(require_admin)):
    return {
        "ragers":              db.ragers.count_documents({}),
        "public_ragers":       db.ragers.count_documents({"is_public": True}),
        "enquiries":           db.enquiries.count_documents({}),
        "pending_allocations": db.allocations.count_documents({
            "status": {"$in": ["pending_rager", "rager_accepted", "pending_founder"]}
        }),
        "users": db.users.count_documents({"role": {"$ne": "admin"}}),
    }


@router.get("/admin/analytics")
def get_analytics(admin=Depends(require_admin)):
    enquiries = list(db.enquiries.find({}, {"_id": 0}))
    allocations = list(db.allocations.find({}, {"_id": 0}))
    ragers = list(db.ragers.find({}, {"_id": 0, "categories": 1, "is_public": 1}))

    enq_by_product = dict(Counter(e.get("product", "unknown") for e in enquiries))
    enq_by_status = dict(Counter(e.get("status", "unknown") for e in enquiries))

    alloc_by_response = dict(Counter(a.get("member_response", "unknown") for a in allocations))
    total_cost = sum(float(a.get("cost_to_admin", 0) or 0) for a in allocations)
    total_payout = sum(float(a.get("payout_to_member", 0) or 0) for a in allocations)

    user_by_role = {
        role: db.users.count_documents({"role": role})
        for role in ["founder", "expert", "member", "sponsor", "admin"]
    }

    cat_counter = Counter()
    for r in ragers:
        for c in r.get("categories", []):
            cat_counter[c] += 1

    return {
        "enquiries": {
            "total": len(enquiries),
            "by_product": enq_by_product,
            "by_status": enq_by_status,
        },
        "allocations": {
            "total": len(allocations),
            "by_response": alloc_by_response,
            "total_cost": total_cost,
            "total_payout": total_payout,
            "margin": total_cost - total_payout,
        },
        "users": {
            "total": db.users.count_documents({}),
            "by_role": user_by_role,
        },
        "ragers": {
            "total": len(ragers),
            "public": sum(1 for r in ragers if r.get("is_public")),
            "by_category": dict(cat_counter.most_common(10)),
        },
    }


# User management is handled by users.py (paginated, filterable)


# ── Reports ──────────────────────────────────────────────────────────────────

@router.get("/admin/reports")
def list_reports(admin=Depends(require_admin)):
    return list(db.reports.find({}, {"_id": 0}).sort("created_at", -1))


@router.post("/admin/reports")
def create_report(data: ReportIn, admin=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email", ""),
        **data.dict(),
    }
    db.reports.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/admin/reports/{report_id}")
def update_report(report_id: str, data: ReportIn, admin=Depends(require_admin)):
    db.reports.update_one({"id": report_id}, {"$set": data.dict()})
    return {"status": "updated"}


@router.patch("/admin/reports/{report_id}/publish")
def toggle_publish(report_id: str, admin=Depends(require_admin)):
    doc = db.reports.find_one({"id": report_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    new_state = not doc.get("is_public", False)
    db.reports.update_one({"id": report_id}, {"$set": {"is_public": new_state}})
    return {"is_public": new_state}


@router.delete("/admin/reports/{report_id}")
def delete_report(report_id: str, admin=Depends(require_admin)):
    db.reports.delete_one({"id": report_id})
    return {"status": "deleted"}


@router.post("/admin/reports/{report_id}/email")
def email_report(report_id: str, data: EmailReportRequest, admin=Depends(require_admin)):
    doc = db.reports.find_one({"id": report_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    resend_key = os.getenv("RESEND_API_KEY", "")
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    themes_html = "".join(
        f'<span style="display:inline-block;background:#1a1a1a;color:#a1a1aa;border:1px solid #333;padding:2px 8px;font-size:11px;margin:2px;">{t}</span>'
        for t in (doc.get("themes") or [])
    )
    points_html = "".join(
        f'<li style="color:#71717a;font-size:13px;margin-bottom:6px;">{p}</li>'
        for p in (doc.get("data_points") or [])
    )
    period = doc.get("period", "")

    html = f"""
<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;background:#fff;color:#1a1a1a;">
  <div style="border-bottom:3px solid #dc143c;padding:32px 40px 24px;">
    <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#dc143c;margin:0 0 8px;">R.A.G.E. — Chatham House Report</p>
    <h1 style="font-size:26px;font-weight:400;margin:0 0 6px;line-height:1.2;">{doc['title']}</h1>
    {f'<p style="font-size:12px;color:#71717a;margin:0;">{period}</p>' if period else ''}
  </div>
  <div style="padding:32px 40px;">
    <p style="font-size:13px;color:#52525b;line-height:1.6;border-left:3px solid #dc143c;padding-left:16px;margin:0 0 24px;font-style:italic;">
      Under Chatham House Rule. Information in this report may be used freely; the identity of speakers and participants may not be revealed.
    </p>
    <h2 style="font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#52525b;margin:0 0 12px;">Summary</h2>
    <p style="font-size:15px;color:#1a1a1a;line-height:1.7;margin:0 0 24px;">{doc['summary']}</p>
    {f'<h2 style="font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#52525b;margin:0 0 10px;">Themes</h2><p style="margin:0 0 24px;">{themes_html}</p>' if themes_html else ''}
    {f'<h2 style="font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#52525b;margin:0 0 12px;">Data Points</h2><ul style="margin:0 0 24px;padding-left:20px;">{points_html}</ul>' if points_html else ''}
  </div>
  <div style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #e5e5e5;">
    <p style="font-size:11px;color:#a1a1aa;margin:0;">© {datetime.now().year} R.A.G.E. — Radical Alliance for Gender Equity. For internal/authorised circulation only.</p>
  </div>
</div>"""

    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
        json={
            "from": "R.A.G.E. <noreply@rageforchange.com>",
            "to": data.recipients,
            "subject": f"[RAGE Report] {doc['title']}{' — ' + period if period else ''}",
            "html": html,
        },
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Resend error: {resp.text}")
    return {"status": "sent", "recipients": len(data.recipients)}


@router.post("/admin/reports/generate")
def generate_report_from_transcript(data: TranscriptRequest, admin=Depends(require_admin)):
    """Use Gemini to generate a Chatham House report from a transcript."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on Railway")

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        context_block = f"\nAdditional context: {data.context}" if data.context else ""

        prompt = f"""You are producing a Chatham House Rule report for R.A.G.E. (Radical Alliance for Gender Equity), a curated platform for women founders in India.

Chatham House Rule: information may be shared but NO individual, company, or session is identified or attributed.{context_block}

From the transcript below, extract:
1. A concise TITLE (max 8 words)
2. A PERIOD (e.g. "Q1 2025" or leave blank if unclear)
3. A SUMMARY (2–4 sentences, aggregate themes only, no attribution)
4. THEMES (3–6 short topic tags, e.g. "Fundraising", "Hiring", "GTM")
5. DATA_POINTS (3–6 anonymised observations, e.g. "Multiple founders cited difficulty accessing Series A capital in non-metro markets")

Return ONLY valid JSON in this exact format:
{{
  "title": "...",
  "period": "...",
  "summary": "...",
  "themes": ["...", "..."],
  "data_points": ["...", "..."]
}}

TRANSCRIPT:
{data.transcript[:12000]}"""

        response = model.generate_content(prompt)
        text = response.text.strip().strip("```json").strip("```").strip()
        import json
        parsed = json.loads(text)
        return {
            "title": parsed.get("title", ""),
            "period": parsed.get("period", ""),
            "summary": parsed.get("summary", ""),
            "themes": parsed.get("themes", []),
            "data_points": parsed.get("data_points", []),
            "notes": "Generated from transcript via AI. Review before publishing.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# ── Public reports (no auth) ─────────────────────────────────────────────────

@router.get("/public/reports")
def public_reports():
    return list(
        db.reports.find(
            {"is_public": True},
            {"_id": 0, "notes": 0, "created_by": 0}
        ).sort("created_at", -1)
    )


# ── Anonymised outreach (test endpoint) ──────────────────────────────────────

@router.post("/admin/test-anonymised-outreach")
def test_anonymised_outreach(data: AnonymisedOutreachRequest, admin=Depends(require_admin)):
    from app.services.outreach import send_anonymised_outreach
    try:
        result = send_anonymised_outreach(data.enquiry_id, data.rager_ids)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Rager responses for an enquiry ───────────────────────────────────────────

@router.get("/admin/enquiries/{enquiry_id}/responses")
def get_enquiry_responses(enquiry_id: str, admin=Depends(require_admin)):
    responses = list(db.rager_responses.find({"enquiry_id": enquiry_id}, {"_id": 0}))

    enriched = []
    for r in responses:
        rager = db.ragers.find_one({"id": r["rager_id"]}, {"_id": 0}) or {}
        enriched.append({
            "rager_id":      r["rager_id"],
            "rager_name":    rager.get("name", ""),
            "rager_email":   rager.get("email", ""),
            "response_type": r["response_type"],
            "message":       r.get("message", ""),
            "responded_at":  r["responded_at"],
            "brief_id":      r["brief_id"],
        })

    return {
        "enquiry_id": enquiry_id,
        "total":      len(enriched),
        "responses":  enriched,
    }
