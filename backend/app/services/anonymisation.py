import uuid
import os
import re
import json
from datetime import datetime, timezone

STAGE_REVENUE = {
    "idea":        "Pre-revenue",
    "early":       "Early revenue (under ₹50L)",
    "growth":      "₹50L – ₹5Cr",
    "scaling":     "₹5Cr+",
    "institution": "Institutional / Fund",
}

STAGE_LABEL = {
    "idea":        "Idea / Pre-product",
    "early":       "Early Stage",
    "growth":      "Growth Stage",
    "scaling":     "Scaling",
    "institution": "Institution / Fund",
}

DECISION_TYPE_LABEL = {
    "fundraising":           "Fundraising & Capital",
    "hiring":                "Talent & Organisation",
    "gtm":                   "Go-to-Market & Growth",
    "strategic_pivot":       "Strategy & Pivots",
    "partnership":           "Partnerships & M&A",
    "financial_structuring": "Financial Structuring",
    "policy":                "Policy & Regulatory",
    "product":               "Product & Technology",
    "other":                 "General Advisory",
}

HELP_LABELS = {
    "capital_access":       "Capital access & investor conversations",
    "decision_support":     "High-stakes decision support",
    "market_introductions": "Market introductions & distribution",
    "regulatory_guidance":  "Regulatory & policy guidance",
    "talent":               "Talent & team building",
    "operational_scaling":  "Operational scaling",
}

FORMAT_LABEL = {
    "1on1":        "1:1 Advisory Session",
    "small_group": "Curated Small Group",
    "not_sure":    "Open to recommendation",
}

URGENCY_LABEL = {
    "this_week":  "This week — critical decision pending",
    "this_month": "This month — active but not urgent",
    "exploring":  "Exploring — building understanding",
}


def _get_problem_text(enquiry: dict) -> str:
    """Return the best available problem/challenge text from any known field."""
    for field in ("problem_statement", "challenge", "message", "description"):
        val = (enquiry.get(field) or "").strip()
        if val and len(val) >= 10:
            return val
    return ""


def _sanitize(text: str, company: str = "", name: str = "") -> str:
    result = text.strip()
    for term in [company, name]:
        if term and len(term) > 2:
            result = re.sub(re.escape(term), "[the company]", result, flags=re.IGNORECASE)
    return result


def _ai_structure(problem_text: str, decision_label: str, stage_label: str, help_items: list) -> dict | None:
    """
    Use Gemini to generate a clean two-part anonymised brief.
    Returns {"situation": str, "what_they_need": str} or None if unavailable.
    """
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        help_text = "; ".join(help_items) if help_items else ""
        help_line = f"\nSpecifically they need help with: {help_text}" if help_text else ""

        prompt = f"""You are writing an anonymised advisory brief for a curated expert matching platform called RAGE (Radical Alliance for Gender Equity) in India.

A founder has submitted the following request. Rewrite it as a professional brief following these rules exactly:

KEEP (these preserve signal for the expert):
- Business model: B2B, B2C, marketplace, SaaS, services, manufacturing, fintech, logistics, healthtech, etc.
- Industry / sector: e.g. logistics workflow automation, consumer fintech, D2C beauty, agri supply chain
- Core challenge type: e.g. GTM stall, ICP confusion, pricing structure, runway pressure, org design, regulatory block
- Stage of the specific problem: e.g. pre-PMF, post-PMF scaling, Series A prep, profitability push

REMOVE or REPLACE:
- Company name → "[the company]"
- Founder name → "[the founder]"
- Specific revenue figures → omit or say "early revenue" / "scaling revenue"
- Specific investor names → "[the investor]" or "[a VC fund]"
- Specific product names → "[their product]"
- City / state names → "Indian market" or omit

DO NOT flatten everything into generic labels like "general advisory" or "operational scaling".
The brief should read like it was written by a neutral analyst who knows the business well.

Submitted problem: {problem_text}
Category: {decision_label}
Stage: {stage_label}{help_line}

Return ONLY valid JSON with exactly these two keys:
{{
  "situation": "2–3 sentences. Business model, industry, stage, and core challenge — specific but anonymised.",
  "what_they_need": "1–2 sentences. The precise advisory input that would move things forward right now."
}}"""

        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)

        situation = (parsed.get("situation") or "").strip()
        what_they_need = (parsed.get("what_they_need") or "").strip()

        if situation and what_they_need:
            return {"situation": situation, "what_they_need": what_they_need}
    except Exception:
        pass

    return None


def _fallback_structure(
    decision_label: str,
    stage_label: str,
    urgency_label: str,
    help_items: list,
) -> dict:
    """
    Deterministic fallback when Gemini is unavailable.
    Built entirely from structured form fields — never touches the raw problem text.
    """
    situation = (
        f"A {stage_label.lower()} founder is navigating a challenge in the area of "
        f"{decision_label.lower()}. "
        f"The timing is: {urgency_label.lower()}."
    )

    if help_items:
        what_they_need = (
            f"Advisory input on {decision_label.lower()}, specifically: "
            f"{'; '.join(h.lower() for h in help_items)}."
        )
    else:
        what_they_need = f"Advisory input on {decision_label.lower()}."

    return {"situation": situation, "what_they_need": what_they_need}


def generate_anonymised_brief(enquiry: dict) -> dict:
    """
    Build an anonymised brief from an enquiry document.
    Raises ValueError if there is no meaningful problem text to work with.
    """
    company  = enquiry.get("company", "")
    name     = enquiry.get("name", "")
    stage    = enquiry.get("business_stage", "") or "early"
    dec_type = enquiry.get("decision_type", "") or "other"
    urgency  = enquiry.get("urgency", "") or "this_month"
    fmt      = enquiry.get("preferred_format", "") or "not_sure"

    # --- Problem text ---
    raw_problem = _get_problem_text(enquiry)
    if not raw_problem:
        raise ValueError("No problem description found in enquiry. Cannot generate brief.")

    clean_problem = _sanitize(raw_problem, company, name)

    # --- Labels ---
    decision_label = DECISION_TYPE_LABEL.get(dec_type, "General Advisory")
    stage_label    = STAGE_LABEL.get(stage, stage.replace("_", " ").title())
    revenue_band   = STAGE_REVENUE.get(stage)   # None if unknown — omitted rather than "Not specified"
    urgency_label  = URGENCY_LABEL.get(urgency, urgency.replace("_", " ").title())
    format_label   = FORMAT_LABEL.get(fmt, "Open to recommendation")

    # --- Help items ---
    help_items = [
        HELP_LABELS.get(h, h.replace("_", " ").title())
        for h in (enquiry.get("help_needed") or [])
    ]

    # --- Structured summary ---
    structured = _ai_structure(clean_problem, decision_label, stage_label, help_items)
    if not structured:
        structured = _fallback_structure(decision_label, stage_label, urgency_label, help_items)

    return {
        "brief_id":       str(uuid.uuid4()),
        "decision_label": decision_label,
        "stage_label":    stage_label,
        "revenue_band":   revenue_band,          # may be None — callers must handle
        "region":         "India",
        "urgency_label":  urgency_label,
        "format_label":   format_label,
        "help_items":     help_items,
        "situation":      structured["situation"],
        "what_they_need": structured["what_they_need"],
        # kept for backward compat with any direct consumers
        "problem_summary": clean_problem,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }
