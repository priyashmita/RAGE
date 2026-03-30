from fastapi import APIRouter, Depends, HTTPException
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

DEFAULT_CONTENT = [
    {
        "page": "brand",
        "sections": {
            "logo_url": "",
            "name": "RAGE",
            "tagline": "For Women Who Mean Business",
            "description": "RAGE is a curated network and platform connecting women founders in India with the expertise, community, and capital they need.",
            "footer_copyright": "© 2025 RAGE. All rights reserved.",
            "footer_tagline": "For Women Who Mean Business"
        }
    },
    {
        "page": "landing",
        "sections": {
            "hero_title": "For Women Who Mean Business",
            "hero_subtitle": "RAGE is a curated network, platform, and community for women founders in India.",
            "tables_intro_title": "Three Ways to Work With RAGE",
            "tables_intro_subtitle": "From one-on-one advisory to curated dinners to documentary — RAGE meets you where you are.",
            "cta_primary_label": "Apply to Join",
            "cta_primary_href": "/contact",
            "cta_secondary_label": "Learn More",
            "cta_secondary_href": "/about"
        }
    },
    {
        "page": "about",
        "sections": {
            "hero_title": "About RAGE",
            "hero_subtitle": "We exist for the women building the future of Indian business.",
            "mission": "RAGE exists to unlock the full potential of women founders in India by connecting them with the right expertise, community, and opportunities at every stage of their journey.",
            "story": "RAGE was founded on the belief that women founders in India are underserved — not for lack of talent or ambition, but for lack of access. Access to the right conversations, the right rooms, the right people.",
            "values": ["Radical honesty", "Generous expertise", "Earned access", "No performance"],
            "team": []
        }
    },
    {
        "page": "closed_table",
        "sections": {
            "hero_title": "Closed Table",
            "hero_subtitle": "One-on-one advisory sessions with India's best operators and investors.",
            "description": "Closed Table connects women founders with vetted advisors — senior operators, investors, and specialists — for paid, structured 1:1 working sessions.",
            "how_it_works": [
                {"step": "1. Submit", "text": "Tell us what you need help with and your budget."},
                {"step": "2. Match", "text": "We match you with the right advisor within 48 hours."},
                {"step": "3. Session", "text": "Meet for a focused 60–90 minute working session."},
                {"step": "4. Follow up", "text": "Receive a written summary with clear next steps."}
            ],
            "pricing_note": "Sessions start at ₹5,000. Pricing is set by the advisor.",
            "faqs": [
                {"question": "Who are the advisors?", "answer": "Senior operators, founders, investors, and specialists — all vetted by RAGE."},
                {"question": "How long is a session?", "answer": "Typically 60–90 minutes."},
                {"question": "Is it confidential?", "answer": "Yes. All sessions are strictly off the record."},
                {"question": "What topics can I bring?", "answer": "Fundraising, hiring, strategy, legal, marketing, operations, product — anything you are genuinely stuck on."}
            ]
        }
    },
    {
        "page": "private_table",
        "sections": {
            "hero_title": "Private Table",
            "hero_subtitle": "Curated dinners for founders who are building seriously.",
            "description": "Private Table brings together a small group of women founders for an off-the-record dinner. No sponsors. No panels. Just honest conversation.",
            "format": "8–12 founders. One evening. No recordings. No LinkedIn posts.",
            "who_attends": "Founders building real companies with real revenue. By invitation only.",
            "upcoming": []
        }
    },
    {
        "page": "sunday_table",
        "sections": {
            "hero_title": "Sunday Table",
            "hero_subtitle": "A documentary series about women who built something real.",
            "description": "Sunday Table is RAGE's documentary series — short, honest films featuring the stories, decisions, and turning points behind women-led businesses in India.",
            "apply_title": "Want to be featured?",
            "apply_description": "We're always looking for founders with a story worth telling. No PR polish required.",
            "apply_href": "/contact",
            "episodes": []
        }
    },
    {
        "page": "network",
        "sections": {
            "hero_title": "The RAGE Network",
            "hero_subtitle": "The people behind the platform.",
            "description": "Ragers are founders, operators, investors, and specialists who form the backbone of the RAGE network. They advise, connect, and open doors."
        }
    },
    {
        "page": "contact",
        "sections": {
            "title": "Get in Touch",
            "description": "For Closed Table enquiries, partnership proposals, press requests, or anything else.",
            "email": "hello@rageforgood.com",
            "phone": "",
            "address": "",
            "social_instagram": "",
            "social_linkedin": "",
            "social_twitter": "",
            "enquiry_form_title": "Submit an Enquiry",
            "enquiry_form_description": "Tell us what you need and we'll come back to you within 48 hours."
        }
    },
    {
        "page": "legal",
        "sections": {
            "terms_title": "Terms & Conditions",
            "terms_body": "By using RAGE services, you agree to these terms. RAGE provides introductions and facilitated advisory sessions but does not guarantee specific outcomes. All sessions are confidential.",
            "privacy_title": "Privacy Policy",
            "privacy_body": "RAGE collects only the information necessary to deliver our services. We do not sell or share your data with third parties. You may request deletion of your data at any time by emailing hello@rageforgood.com.",
            "copyright": "© 2025 RAGE. All rights reserved.",
            "company_name": "RAGE",
            "registered_address": ""
        }
    }
]


@router.get("/admin/content")
def get_all_content(admin=Depends(require_admin)):
    return list(db.content.find({}, {"_id": 0}))


@router.get("/admin/content/{page}")
def get_content_page(page: str, admin=Depends(require_admin)):
    doc = db.content.find_one({"page": page}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Page not found")
    return doc


@router.put("/admin/content/{page}")
def update_content_page(page: str, data: dict, admin=Depends(require_admin)):
    sections = data.get("sections")
    if sections is None:
        raise HTTPException(status_code=400, detail="sections required")
    db.content.update_one({"page": page}, {"$set": {"sections": sections}}, upsert=True)
    return {"status": "saved"}


@router.post("/admin/content/seed")
def seed_content(admin=Depends(require_admin)):
    for item in DEFAULT_CONTENT:
        db.content.update_one(
            {"page": item["page"]},
            {"$setOnInsert": item},
            upsert=True
        )
    return {"status": "seeded", "pages": [i["page"] for i in DEFAULT_CONTENT]}


# Public read — no auth required
@router.get("/public/content/{page}")
def get_public_content(page: str):
    doc = db.content.find_one({"page": page}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc
