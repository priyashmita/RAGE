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

    # Ensure uniqueness indexes (idempotent — safe to run on every deploy)
    db.users.create_index("email", unique=True, background=True)
    db.users.create_index("id",    unique=True, background=True)
    db.ragers.create_index("id",   unique=True, background=True)


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
