from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.member import router as member_router
from app.api.seed import router as seed_router
from app.api.content import router as content_router
from app.api.ragers import router as ragers_router

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

@app.get("/")
def home():
    return {"message": "RAGE backend is running"}

@app.get("/api/debug/cors")
def debug_cors():
    return {
        "configured_origins": origins,
        "cors_raw_env": cors_raw
    }

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(member_router, prefix="/api")
app.include_router(seed_router, prefix="/api")
app.include_router(content_router, prefix="/api")
app.include_router(ragers_router, prefix="/api")
