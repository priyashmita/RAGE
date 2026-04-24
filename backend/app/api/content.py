from fastapi import APIRouter, Depends, HTTPException
from app.core.db import db
from app.core.auth import require_admin

router = APIRouter()

# Each page's sections structure MUST match the D (defaults) object in the
# corresponding frontend page component — useSiteContent deep-merges them.
DEFAULT_CONTENT = [
    {
        "page": "brand",
        "sections": {
            "logo_url": "",
            "name": "RAGE",
            "tagline": "For Women Who Mean Business",
            "footer_copyright": "© 2025 RAGE. All rights reserved.",
            "footer_tagline": "For Women Who Mean Business"
        }
    },
    {
        "page": "landing",
        "sections": {
            "hero": {
                "overline": "A Curated Network",
                "title": "For Women Who Mean Business",
                "body": "RAGE connects India's most ambitious women founders with the expertise, community, and capital they need to build something real.",
                "image_url": "",
                "cta_primary_text": "See How It Works",
                "cta_primary_link": "/private-table",
                "cta_secondary_text": "Request a Table"
            },
            "problem": {
                "overline": "The Gap",
                "title": "Women founders in India are underserved — not for lack of ambition, but for lack of access.",
                "body": "The right rooms, the right advisors, the right conversations. RAGE exists to close that gap."
            },
            "stats": [
                {"value": "20+", "label": "Expert Ragers", "sub": "Vetted operators & investors"},
                {"value": "3", "label": "Formats", "sub": "Advisory, dinners, documentary"},
                {"value": "48h", "label": "Turnaround", "sub": "From request to matched expert"},
                {"value": "100%", "label": "Confidential", "sub": "Off the record, always"}
            ],
            "focus": {
                "overline": "Why RAGE",
                "title": "Real access. Real expertise. Real conversations.",
                "items": [
                    {"num": "01", "title": "Closed Table", "text": "One-on-one advisory sessions with vetted senior operators and investors."},
                    {"num": "02", "title": "Private Table", "text": "Off-the-record dinners with a curated group of women founders."},
                    {"num": "03", "title": "Sunday Table", "text": "A documentary series featuring the real stories behind women-led businesses."}
                ]
            },
            "formats": {
                "overline": "Three Formats",
                "title": "Three ways to work with RAGE",
                "body": "Whether you need targeted advice, peer community, or a platform to share your story — RAGE has a format for you.",
                "items": [
                    {"tag": "Advisory", "title": "Closed Table", "desc": "Paid 1:1 sessions with vetted advisors. Get targeted help on your biggest challenge.", "price": "From ₹5,000", "link": "/closed-table"},
                    {"tag": "Community", "title": "Private Table", "desc": "Curated off-the-record dinners for founders building serious companies.", "price": "By invitation", "link": "/private-table"},
                    {"tag": "Documentary", "title": "Sunday Table", "desc": "Short films featuring the decisions and turning points behind women-led businesses.", "price": "Sponsorship open", "link": "/sunday-table"}
                ]
            },
            "users": {
                "overline": "Who Is RAGE For",
                "title": "Built for the women building India's future",
                "body": "RAGE serves founders, institutions, and organisations who believe in the power of women-led enterprise.",
                "items": [
                    {"label": "Women Founders", "desc": "Building companies that need the right expertise and community at the right moment."},
                    {"label": "Financial Institutions & Funds", "desc": "Looking to source and support the next generation of women-led businesses."},
                    {"label": "Governments & Multilaterals", "desc": "Building programmes and ecosystems that support women entrepreneurship at scale."}
                ]
            },
            "network_preview": {
                "overline": "The Network",
                "title": "India's best operators. All women.",
                "body": "RAGE Ragers are senior operators, investors, founders, and specialists — vetted, available, and genuinely invested in the success of the founders they work with.",
                "stats": [
                    {"value": "20+", "label": "Ragers"},
                    {"value": "10+", "label": "Sectors"},
                    {"value": "100%", "label": "Women"}
                ],
                "image_url": ""
            },
            "why_different": {
                "overline": "Why Different",
                "title": "Not a networking event. Not a mentorship programme.",
                "body": "RAGE is a working platform. Every format is designed to produce real outcomes — not connections, not inspiration, but actual progress.",
                "items": [
                    {"title": "Curated, not open", "desc": "Every advisor and every founder is vetted. Quality over quantity, always."},
                    {"title": "Paid, not free", "desc": "Paid sessions create accountability. Advisors show up. Founders come prepared."},
                    {"title": "Off the record", "desc": "Everything stays in the room. No LinkedIn posts. No case studies without consent."},
                    {"title": "Outcome-focused", "desc": "Every session ends with a written summary and clear next steps."}
                ]
            },
            "cta": {
                "title": "Ready to build with RAGE?",
                "body": "Whether you need advice, community, or a platform — we're here.",
                "cta_primary_text": "Request a Closed Table",
                "cta_secondary_text": "Explore Formats"
            }
        }
    },
    {
        "page": "about",
        "sections": {
            "hero": {
                "overline": "About",
                "title": "We exist for the women building the future of Indian business.",
                "body": "RAGE is a curated network, platform, and community. Not a networking event. Not a mentorship programme. A working infrastructure for women founders who are serious about building."
            },
            "mission": {
                "title": "Why RAGE exists",
                "quote": "The most talented women founders in India are not failing for lack of ability. They are failing for lack of access.",
                "body": "Access to the right advisors. The right rooms. The right conversations at the right moment. RAGE exists to close that gap — permanently.",
                "body2": "We do this through three formats: Closed Table (1:1 advisory), Private Table (curated dinners), and Sunday Table (documentary). Each is designed to produce real outcomes, not connections."
            },
            "business_first": {
                "overline": "Our Philosophy",
                "title": "Business first. Always.",
                "body": "RAGE is not a women's empowerment initiative. It's a business infrastructure platform that happens to serve women exclusively. The work is real. The stakes are real.",
                "items": [
                    {"num": "01", "title": "No performance", "text": "No inspiration content. No panels about being a woman in business. Just actual work."},
                    {"num": "02", "title": "Earned access", "text": "Every Rager and every founder in our network has earned their seat. Quality is non-negotiable."},
                    {"num": "03", "title": "Real accountability", "text": "Paid sessions, written summaries, clear next steps. We measure outcomes, not activities."}
                ]
            },
            "community": {
                "overline": "The Network",
                "title": "20+ of India's best operators. All women.",
                "body": "RAGE Ragers are senior operators, investors, founders, and specialists who have agreed to make themselves available to the founders in our network.",
                "stats": [
                    {"value": "20+", "label": "Ragers"},
                    {"value": "10+", "label": "Sectors"},
                    {"value": "₹50Cr+", "label": "Capital deployed"}
                ],
                "image_url": "",
                "highlights": [
                    "Former and current C-suite operators across India's leading companies",
                    "Investors with combined deployment of ₹50Cr+ in women-led businesses",
                    "Specialists in legal, finance, marketing, operations, and technology"
                ]
            },
            "focus_areas": {
                "overline": "What We Cover",
                "title": "Every stage. Every challenge.",
                "items": [
                    {"title": "Early Stage", "points": ["Idea validation", "First hires", "Product-market fit", "Pre-seed fundraising"]},
                    {"title": "Growth Stage", "points": ["Series A/B preparation", "Scaling operations", "Marketing & brand", "International expansion"]},
                    {"title": "Institutional", "points": ["Governance & compliance", "Strategic partnerships", "Exit planning", "Board composition"]}
                ]
            },
            "team": [
                {"name": "", "title": "", "bio": "", "photo_url": ""}
            ],
            "cta": {
                "title": "Become part of the RAGE network.",
                "body": "Whether you're a founder looking for support, or an operator who wants to give back — we'd like to hear from you."
            }
        }
    },
    {
        "page": "closed_table",
        "sections": {
            "hero": {
                "overline": "Closed Table",
                "title": "One-on-one advisory. No fluff.",
                "body": "Closed Table connects women founders with vetted senior advisors for paid, structured 1:1 working sessions. You come with a problem. You leave with a plan."
            },
            "how_it_works": {
                "title": "How it works",
                "steps": [
                    {"step": "01", "label": "Submit", "desc": "Tell us what you need help with, who you are, and your budget."},
                    {"step": "02", "label": "Match", "desc": "We find the right advisor within 48 hours. You approve before we proceed."},
                    {"step": "03", "label": "Session", "desc": "A focused 60–90 minute working session. No intros. Straight to the problem."},
                    {"step": "04", "label": "Follow-up", "desc": "You receive a written summary with clear next steps within 24 hours."}
                ]
            },
            "rules": {
                "title": "The rules",
                "items": [
                    {"title": "Strictly confidential", "desc": "Nothing leaves the session. No case studies, no references without explicit consent."},
                    {"title": "Time-boxed", "desc": "60–90 minutes. Focused. No meandering."},
                    {"title": "Founder-vetted advisors", "desc": "Every Rager has been assessed for real operating experience — not just credentials."},
                    {"title": "No retainer traps", "desc": "One session at a time. No commitment beyond what you book."}
                ]
            },
            "tiers": [
                {"name": "Foundation", "price": "₹5,000", "desc": "60-minute session with a specialist advisor."},
                {"name": "Deep Dive", "price": "₹10,000", "desc": "90-minute session with written summary and 1 follow-up call."},
                {"name": "Board-level", "price": "₹25,000+", "desc": "Senior C-suite or investor. Complex strategic challenges."}
            ],
            "precedents": {
                "overline": "What founders bring",
                "title": "There's no wrong question.",
                "body": "Fundraising strategy, hiring decisions, co-founder conflicts, regulatory challenges, pricing models, board dynamics — if it's real and it matters, bring it.",
                "items": []
            },
            "faqs": [
                {"q": "How long is a session?", "a": "60–90 minutes depending on the tier you book."},
                {"q": "Is everything confidential?", "a": "Yes. Nothing leaves the session without your explicit consent."},
                {"q": "Can I book more than one session?", "a": "Yes. There's no limit and no retainer commitment."}
            ],
            "cta": {
                "title": "Ready to book a session?",
                "body": "Tell us what you need. We'll match you within 48 hours."
            }
        }
    },
    {
        "page": "private_table",
        "sections": {
            "hero": {
                "overline": "Private Table",
                "title": "Dinner. Off the record.",
                "subtitle": "A curated evening for founders building serious companies.",
                "image_url": ""
            },
            "what": {
                "title": "What is Private Table?",
                "body": "Private Table brings together 8–12 women founders for an off-the-record dinner. No speakers. No agenda. No LinkedIn posts. Just honest conversation between people who are actually building something.",
                "rules": [
                    "No recording. No social media. What's said at the table stays at the table.",
                    "No pitching. This is not a networking event.",
                    "Curated guest list. Every person in the room has been vetted by RAGE."
                ]
            },
            "table_types": [
                {"name": "Founders Table", "desc": "8–10 founders at similar stages. Peer conversation.", "fee": "By invitation"},
                {"name": "Capital Table", "desc": "Founders + select investors. Introductions, not pitches.", "fee": "By invitation"},
                {"name": "Sector Table", "desc": "Founders from a single sector. Deep domain conversation.", "fee": "By invitation"}
            ],
            "flow": {
                "overline": "The Evening",
                "title": "How an evening runs",
                "steps": [
                    {"time": "7:00 PM", "label": "Arrival", "desc": "Drinks. No nametags."},
                    {"time": "7:30 PM", "label": "Dinner begins", "desc": "Seated. Introductions only."},
                    {"time": "8:00 PM", "label": "Open conversation", "desc": "One theme. No moderator."},
                    {"time": "9:30 PM", "label": "Close", "desc": "No formal ending. No follow-up required."}
                ]
            },
            "economics": {
                "stats": [
                    {"value": "8–12", "label": "Founders per dinner"},
                    {"value": "4–6", "label": "Dinners per year"},
                    {"value": "0", "label": "Recordings"}
                ],
                "note": "Private Table is by invitation only. Submit an enquiry to be considered."
            },
            "upcoming": [
                {"title": "", "date": "", "location": "", "type": "Founders Table", "desc": ""}
            ],
            "faqs": [
                {"q": "Who gets invited?", "a": "Women founders building serious companies. Every guest is vetted by RAGE."},
                {"q": "Is there a cost to attend?", "a": "Private Table is by invitation only. There is no ticket price."},
                {"q": "What is discussed?", "a": "There is no set agenda. One theme is introduced at the start of dinner and the conversation flows from there."}
            ],
            "cta": {
                "title": "Request an invitation",
                "body": ""
            }
        }
    },
    {
        "page": "sunday_table",
        "sections": {
            "hero": {
                "overline": "Sunday Table",
                "title": "The real stories behind women-led business.",
                "body": "Sunday Table is RAGE's documentary series — short, honest films about the decisions, setbacks, and turning points that define women-led businesses in India."
            },
            "format": {
                "title": "What is Sunday Table?",
                "body": "Each episode follows one founder. No host. No interview format. Just the founder, their story, and the moments that actually mattered.",
                "body2": "Season 1 launches in 2025. Six episodes. Six founders. All different. All real."
            },
            "episodes": {
                "theme": "Season 1 — In Development",
                "list": [
                    {
                        "title": "",
                        "people": [
                            {"name": "", "company": ""},
                            {"name": "", "company": ""},
                            {"name": "", "company": ""},
                            {"name": "", "company": ""}
                        ],
                        "desc": "",
                        "date": ""
                    }
                ]
            },
            "production": [
                {"label": "Format", "text": "Short documentary. 20–30 minutes per episode."},
                {"label": "Distribution", "text": "YouTube primary. Instagram short-form clips."},
                {"label": "Cadence", "text": "6 episodes per season. Fortnightly release."}
            ],
            "sponsorship": {
                "overline": "Partner With Us",
                "title": "Sponsor Sunday Table",
                "body": "Sunday Table reaches a highly targeted audience of women founders, investors, and business leaders. Sponsorship is limited to organisations whose values align with RAGE's.",
                "rules": [
                    "No editorial interference. Sponsors do not influence story selection.",
                    "Logo placement and verbal credit only.",
                    "Limited to 2 sponsors per season."
                ],
                "stats": []
            },
            "faqs": [
                {"q": "How do I apply to be featured?", "a": "Submit an enquiry through the Contact page and tell us about your business and story."},
                {"q": "Is there a cost to be featured?", "a": "No. Sunday Table is editorially independent. There is no fee to be featured."},
                {"q": "Who owns the footage?", "a": "RAGE retains distribution rights. Founders retain rights to their own story."}
            ],
            "cta": {
                "title": "Interested in sponsoring?",
                "body": "We're selective. If you think there's a fit, send us a note."
            }
        }
    },
    {
        "page": "network",
        "sections": {
            "hero": {
                "overline": "The Network",
                "title": "India's best operators. All women.",
                "body": "RAGERS are the core network behind R.A.G.E.—a curated group of experienced operators, investors, founders, and leaders across capital, entrepreneurship, policy, and technology. They engage through structured formats, not informal advisory—contributing to Private Tables, Closed Tables, and other platform interactions where their experience directly supports access, decisions, and credibility. This is not a directory. It is an active, high-trust network where participation is intentional, relevant, and outcome-oriented."
            },
            "stats": [
                {"value": "20+", "label": "Active Ragers"},
                {"value": "10+", "label": "Sectors covered"},
                {"value": "100%", "label": "Women"},
                {"value": "48h", "label": "Average response time"}
            ],
            "domains": [
                "Finance & Fundraising", "Legal & Compliance", "Marketing & Brand",
                "Operations & Scale", "Technology & Product", "Strategy & Growth",
                "People & Culture", "Sales & Distribution", "Media & Communications",
                "International Expansion"
            ],
            "members": [],
            "faqs": [
                {"q": "How do I book a Rager?", "a": "Submit a Closed Table request and we'll match you with the right advisor within 48 hours."},
                {"q": "Can I request a specific Rager?", "a": "Yes. If you have someone in mind, mention their name in your submission."},
                {"q": "How are Ragers vetted?", "a": "Every Rager is assessed for real operating experience, not just credentials. We review their background before inviting them to join."}
            ],
            "cta": {
                "title": "Want to become a Rager?",
                "body": "We're always looking for senior operators who want to give back. If that's you, get in touch."
            }
        }
    },
    {
        "page": "contact",
        "sections": {
            "hero": {
                "overline": "Contact",
                "title": "Get in touch.",
                "body": "For Closed Table enquiries, partnership proposals, press requests, or anything else. We reply within 48 hours."
            },
            "details": {
                "email": "hello@rageforgood.com",
                "note": "We respond to all enquiries within 48 hours."
            },
            "cta": {
                "title": "Submit an enquiry",
                "body": "Tell us what you need and we'll come back to you."
            }
        }
    },
    {
        "page": "legal",
        "sections": {
            "hero": {
                "overline": "Legal",
                "title": "Terms & Privacy",
                "body": ""
            },
            "terms_title": "Terms & Conditions",
            "terms_body": "By using RAGE services, you agree to these terms. RAGE provides introductions and facilitated advisory sessions but does not guarantee specific outcomes. All sessions are confidential. RAGE reserves the right to decline or terminate any engagement at its discretion.",
            "privacy_title": "Privacy Policy",
            "privacy_body": "RAGE collects only the information necessary to deliver our services. We do not sell or share your data with third parties without your explicit consent. You may request deletion of your data at any time by emailing hello@rageforgood.com.",
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
    # Force-reseed every page so structure is always current
    for item in DEFAULT_CONTENT:
        db.content.replace_one(
            {"page": item["page"]},
            item,
            upsert=True
        )
    return {"status": "seeded", "pages": [i["page"] for i in DEFAULT_CONTENT]}


@router.post("/admin/content/seed/{page}")
def seed_content_page(page: str, admin=Depends(require_admin)):
    item = next((d for d in DEFAULT_CONTENT if d["page"] == page), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"No default content for page '{page}'")
    db.content.replace_one({"page": page}, item, upsert=True)
    return {"status": "seeded", "page": page}


def _is_legacy_sections(sections: dict) -> bool:
    """Old DB content uses flat string keys like hero_title. New format has nested dicts."""
    if not sections:
        return False
    return all(isinstance(v, str) for v in sections.values())


# Public — no auth required (two URL aliases for compatibility)
@router.get("/public/content/{page}")
def get_public_content(page: str):
    doc = db.content.find_one({"page": page}, {"_id": 0})
    # Return DB content only if it uses the current nested format and has actual content
    sections = doc.get("sections", {}) if doc else {}
    if doc and sections and not _is_legacy_sections(sections):
        return doc
    # Fall back to hardcoded defaults (covers missing OR legacy-format docs)
    default = next((d for d in DEFAULT_CONTENT if d["page"] == page), None)
    if default:
        return default
    raise HTTPException(status_code=404, detail="Not found")

@router.get("/content/{page}")
def get_public_content_alias(page: str):
    return get_public_content(page)
