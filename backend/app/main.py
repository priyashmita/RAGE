from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.member import router as member_router
from app.api.seed import router as seed_router

app = FastAPI()

origins = [os.getenv("CORS_ORIGINS", "http://localhost:3000")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "RAGE backend is running"}

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(member_router, prefix="/api")
app.include_router(seed_router, prefix="/api")
