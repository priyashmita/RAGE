import uuid
import re
from datetime import datetime, timezone

STAGE_REVENUE = {
    "idea":        "Pre-revenue",
    "early":       "< ₹50L",
    "growth":      "₹50L – ₹5Cr",
    "scaling":     "₹5Cr+",
    "institution": "Institutional",
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
    "capital_access":       "Capital access",
    "decision_support":     "High-stakes decision support",
    "market_introductions": "Market introductions",
    "regulatory_guidance":  "Regulatory guidance",
    "talent":               "Talent & team building",
    "operational_scaling":  "Operational scaling",
}


def _sanitize_problem(text: str, company: str = "", name: str = "") -> str:
    result = text.strip()
    for term in [company, name]:
        if term and len(term) > 2:
            result = re.sub(re.escape(term), "[the company]", result, flags=re.IGNORECASE)
    return result


def generate_anonymised_brief(enquiry: dict) -> dict:
    stage    = enquiry.get("business_stage", "early")
    dec_type = enquiry.get("decision_type", "other")
    company  = enquiry.get("company", "")
    name     = enquiry.get("name", "")

    problem_clean = _sanitize_problem(
        enquiry.get("problem_statement", ""),
        company,
        name,
    )

    help_items = [
        HELP_LABELS.get(h, h)
        for h in enquiry.get("help_needed", [])
    ]

    return {
        "brief_id":         str(uuid.uuid4()),
        "industry":         DECISION_TYPE_LABEL.get(dec_type, "General Advisory"),
        "stage":            stage.replace("_", " ").title(),
        "revenue_band":     STAGE_REVENUE.get(stage, "Not specified"),
        "region":           "India",
        "help_needed":      help_items,
        "preferred_format": enquiry.get("preferred_format", "not_sure"),
        "urgency":          enquiry.get("urgency", "this_month").replace("_", " ").title(),
        "problem_summary":  problem_clean,
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
