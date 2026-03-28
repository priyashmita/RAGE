from fastapi import APIRouter, HTTPException, Depends
from app.core.db import db
from app.core.auth import verify_password, create_access_token, serialize_user, get_current_user
from app.schemas.auth import LoginRequest, LoginResponse, AuthUser

router = APIRouter()

@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    user = db.users.find_one({"email": payload.email.lower().strip()}, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user)

    return {
        "token": token,
        "user": serialize_user(user)
    }

@router.get("/auth/me", response_model=AuthUser)
def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)
