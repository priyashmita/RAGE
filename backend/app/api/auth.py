import uuid
from fastapi import APIRouter, HTTPException, Depends
from app.core.db import db
from app.core.auth import verify_password, hash_password, create_access_token, serialize_user, get_current_user
from app.schemas.auth import LoginRequest, SignupRequest, LoginResponse, AuthUser

router = APIRouter()

ALLOWED_ROLES = {"member", "founder", "expert", "sponsor"}

@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    try:
        user = db.users.find_one({"email": payload.email.lower().strip()}, {"_id": 0})

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token(user)
        return {"token": token, "user": serialize_user(user)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

@router.post("/auth/signup", response_model=LoginResponse)
def signup(payload: SignupRequest):
    email = payload.email.lower().strip()

    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    role = payload.role if payload.role in ALLOWED_ROLES else "member"

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "role": role,
        "status": "active"
    }
    db.users.insert_one(user)
    user.pop("_id", None)

    token = create_access_token(user)
    return {"token": token, "user": serialize_user(user)}

@router.get("/auth/me", response_model=AuthUser)
def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)
