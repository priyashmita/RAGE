import os
import re
import hashlib
import secrets
import bcrypt as _bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from app.core.db import db

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_THIS_NOW")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

MAX_LOGIN_ATTEMPTS = 5

# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

def validate_password_strength(password: str) -> str | None:
    """Returns error string or None if valid."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if len(password) > 128:
        return "Password must be under 128 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    return None

# ── Secure tokens ─────────────────────────────────────────────────────────────

def generate_secure_token() -> str:
    """Plain 32-byte hex token — sent in email link, never stored."""
    return secrets.token_hex(32)

def hash_token(plain_token: str) -> str:
    """SHA256 hash — only this is stored in the DB."""
    return hashlib.sha256(plain_token.encode()).hexdigest()

# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user: dict, expire_minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    minutes = expire_minutes if expire_minutes is not None else JWT_EXPIRE_MINUTES
    user_id = user.get("id") or str(user.get("_id", ""))
    payload = {
        "sub":   user_id,
        "email": user["email"],
        "role":  user.get("role", "founder"),
        "exp":   int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_rager_token(user: dict, rager_id: str) -> str:
    """Issue a rager JWT. sub = user.id; rager_id claim carries the profile id."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      user["id"],
        "email":    user.get("email", ""),
        "role":     "rager",
        "rager_id": rager_id,
        "exp":      int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ── Serialization ─────────────────────────────────────────────────────────────

def serialize_user(user: dict) -> dict:
    return {
        "id":         user.get("id") or str(user.get("_id", "")),
        "email":      user["email"],
        "name":       user.get("name", ""),
        "role":       user.get("role", "founder"),
        "status":     user.get("status", "active"),
        "contact_id": user.get("contact_id"),
    }

# ── Auth dependencies ─────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    status = user.get("status", "active")
    if status == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    if status == "locked":
        raise HTTPException(status_code=423, detail="Account locked — contact admin")

    return user

def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def get_current_rager(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id  = payload.get("sub")
        rager_id = payload.get("rager_id")
        if not user_id or payload.get("role") != "rager":
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    status = user.get("status", "active")
    if status == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    if status == "locked":
        raise HTTPException(status_code=423, detail="Account locked — contact admin")

    rid = rager_id or user.get("rager_id")
    if not rid:
        raise HTTPException(status_code=401, detail="No rager profile linked to this account")

    rager = db.ragers.find_one({"id": rid}, {"_id": 0})
    if not rager:
        raise HTTPException(status_code=401, detail="Rager profile not found")
    return rager

def require_rager(rager: dict = Depends(get_current_rager)):
    return rager
