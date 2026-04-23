from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.member import router as member_router
from app.api.seed import router as seed_router
from app.api.content import router as content_router, DEFAULT_CONTENT
from app.api.ragers import router as ragers_router
from app.api.matching import router as matching_router
from app.api.rager_auth import router as rager_auth_router
from app.api.contacts import router as contacts_router
from app.api.users import router as users_router
from app.api.founder import router as founder_router
from app.api.public_outreach import router as public_outreach_router
from app.api.events import router as events_router
from app.api.events_public import router as events_public_router
from app.api.podcast import router as podcast_router
from app.core.db import db

app = FastAPI()

cors_raw = os.getenv("CORS_ORIGINS", "*")
if cors_raw.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _is_legacy_sections(sections: dict) -> bool:
    return bool(sections) and all(isinstance(v, str) for v in sections.values())


@app.on_event("startup")
def auto_seed_content():
    """On every deploy: upsert any page that is missing or has legacy flat format."""
    for item in DEFAULT_CONTENT:
        existing = db.content.find_one({"page": item["page"]}, {"_id": 0})
        existing_sections = existing.get("sections", {}) if existing else {}
        if not existing or not existing_sections or _is_legacy_sections(existing_sections):
            db.content.replace_one({"page": item["page"]}, item, upsert=True)

    # ── Core uniqueness indexes ──────────────────────────────────────────────
    db.users.create_index("email", unique=True, background=True)
    db.users.create_index("id",    unique=True, background=True)
    db.ragers.create_index("id",   unique=True, background=True)

    # ── Enquiries ────────────────────────────────────────────────────────────
    # is_archived used on every list query; compound covers filter+sort together
    db.enquiries.create_index("id",         unique=True, sparse=True, background=True)
    db.enquiries.create_index("is_archived",                          background=True)
    db.enquiries.create_index([("is_archived", 1), ("created_at", -1)], background=True)

    # ── Allocations ──────────────────────────────────────────────────────────
    # enquiry_id: matching workflow & rager dashboard lookups
    # member_id / rager_id: podcast scoring & rager portal
    # status: pending-queue counts in stats
    db.allocations.create_index("id",         unique=True, sparse=True, background=True)
    db.allocations.create_index("enquiry_id",               background=True)
    db.allocations.create_index("member_id",                background=True)
    db.allocations.create_index("rager_id",                 background=True)
    db.allocations.create_index("status",                   background=True)
    db.allocations.create_index([("enquiry_id", 1), ("status", 1)], background=True)

    # ── Private Table ────────────────────────────────────────────────────────
    db.events.create_index("id",         unique=True, background=True)
    db.invites.create_index("id",        unique=True, background=True)
    db.invites.create_index("token",     unique=True, sparse=True, background=True)
    db.invites.create_index("event_id",  background=True)
    # rager_id is the hottest lookup — scored per-rager in every candidate refresh
    db.invites.create_index("rager_id",  background=True)
    db.invites.create_index([("rager_id", 1), ("rsvp_status",  1)], background=True)
    db.invites.create_index([("rager_id", 1), ("invite_sent",  1)], background=True)
    db.prereads.create_index("id",        unique=True, sparse=True, background=True)
    db.prereads.create_index("invite_id", unique=True, sparse=True, background=True)
    db.seatings.create_index("id",        unique=True, background=True)
    db.seatings.create_index("event_id",  background=True)

    # ── Podcast Intelligence ─────────────────────────────────────────────────
    # people: working identity layer (rager_id → live from ragers)
    db.podcast_people.create_index("id",       unique=True, background=True)
    db.podcast_people.create_index("rager_id", unique=True, sparse=True, background=True)
    db.podcast_people.create_index("status",               background=True)
    # content: looked up by person and topic
    db.podcast_content.create_index("id",        unique=True, background=True)
    db.podcast_content.create_index("person_id",            background=True)
    db.podcast_content.create_index("topic_ids",            background=True)
    # topics: looked up by slug, sorted by name
    # slug index must be sparse — docs created before slug was generated have no slug field
    db.podcast_topics.create_index("id",   unique=True, background=True)
    try:
        db.podcast_topics.drop_index("slug_1")
    except Exception:
        pass
    db.podcast_topics.create_index("slug", unique=True, sparse=True, background=True)
    # candidates: primary sort key is score
    db.podcast_candidates.create_index("id",        unique=True, background=True)
    db.podcast_candidates.create_index("person_id", unique=True, background=True)
    db.podcast_candidates.create_index("score",                  background=True)
    db.podcast_candidates.create_index("topic_ids",              background=True)
    # pairs: sorted by score, looked up by either person
    db.podcast_pairs.create_index("id",                   unique=True, background=True)
    db.podcast_pairs.create_index("compatibility_score",            background=True)
    db.podcast_pairs.create_index("person_1_id",                    background=True)
    db.podcast_pairs.create_index("person_2_id",                    background=True)
    # tables (4-person): sorted by score, looked up by topic
    db.podcast_tables.create_index("id",         unique=True, background=True)
    db.podcast_tables.create_index("score",                   background=True)
    db.podcast_tables.create_index("topic_id",                background=True)
    db.podcast_tables.create_index("status",                  background=True)
    # decisions: looked up per candidate in detail view
    db.podcast_invite_decisions.create_index("id",           unique=True, background=True)
    db.podcast_invite_decisions.create_index("candidate_id",            background=True)


@app.get("/")
def home():
    return {"message": "RAGE backend is running"}


@app.get("/api/health")
def health():
    """Quick status check — use this to confirm a deploy worked."""
    content_pages = [d["page"] for d in db.content.find({}, {"page": 1, "_id": 0})]
    return {
        "status":               "ok",
        "content_pages_seeded": len(content_pages),
        "pages":                content_pages,
        "ragers":               db.ragers.count_documents({}),
        "users":                db.users.count_documents({}),
        "contacts":             db.contacts.count_documents({"is_deleted": False}),
    }


@app.get("/api/debug/cors")
def debug_cors():
    return {"configured_origins": origins, "cors_raw_env": cors_raw}


app.include_router(auth_router,      prefix="/api")
app.include_router(admin_router,     prefix="/api")
app.include_router(member_router,    prefix="/api")
app.include_router(seed_router,      prefix="/api")
app.include_router(content_router,   prefix="/api")
app.include_router(ragers_router,    prefix="/api")
app.include_router(matching_router,  prefix="/api")
app.include_router(rager_auth_router, prefix="/api")
app.include_router(contacts_router,  prefix="/api")
app.include_router(users_router,     prefix="/api")
app.include_router(founder_router,        prefix="/api")
app.include_router(public_outreach_router, prefix="/api")
app.include_router(events_router,         prefix="/api")
app.include_router(events_public_router,  prefix="/api")
app.include_router(podcast_router,        prefix="/api")
