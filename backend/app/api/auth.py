import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.db import db
from app.core.auth import (
    verify_password, hash_password, validate_password_strength,
    create_access_token, serialize_user, get_current_user,
    generate_secure_token, hash_token, MAX_LOGIN_ATTEMPTS,
)
from app.core.audit import write_audit
from app.core.email_utils import send_email, FRONTEND_URL, reset_email_html

router = APIRouter()

# ── Request models ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:       EmailStr
    password:    str
    remember_me: bool = False

class SignupRequest(BaseModel):
    email:    EmailStr
    password: str
    name:     str
    role:     str = "founder"

class SetupPasswordRequest(BaseModel):
    token:            str
    password:         str
    confirm_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token:            str
    password:         str
    confirm_password: str

ALLOWED_SELF_SIGNUP_ROLES = {"founder"}

# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/auth/login")
def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user  = db.users.find_one({"email": email}, {"_id": 0})

    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    status = user.get("status", "active")
    if status == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    if status == "locked":
        raise HTTPException(status_code=423, detail="Account locked — contact admin")
    if status == "pending_setup":
        raise HTTPException(
            status_code=403,
            detail="Account not activated — check your email for the setup link",
        )

    if not verify_password(payload.password, user["password_hash"]):
        attempts = user.get("failed_login_attempts", 0) + 1
        update: dict = {"failed_login_attempts": attempts}
        if attempts >= MAX_LOGIN_ATTEMPTS:
            update["status"]    = "locked"
            update["locked_at"] = datetime.now(timezone.utc).isoformat()
        db.users.update_one({"email": email}, {"$set": update})
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=423,
                detail="Account locked after too many failed attempts — contact admin",
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    expire_minutes = 7 * 24 * 60 if payload.remember_me else 24 * 60
    token = create_access_token(user, expire_minutes=expire_minutes)

    db.users.update_one({"email": email}, {"$set": {
        "failed_login_attempts": 0,
        "last_login_at":         datetime.now(timezone.utc).isoformat(),
    }})

    return {"token": token, "user": serialize_user(user)}


# ── Signup (self-serve) ───────────────────────────────────────────────────────

@router.post("/auth/signup")
def signup(payload: SignupRequest):
    email = payload.email.lower().strip()

    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    err = validate_password_strength(payload.password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    role = payload.role if payload.role in ALLOWED_SELF_SIGNUP_ROLES else "founder"
    now  = datetime.now(timezone.utc).isoformat()

    # Contact-first: create Contact before User
    contact_id = str(uuid.uuid4())
    db.contacts.insert_one({
        "id":                contact_id,
        "name":              payload.name.strip(),
        "email":             email,
        "phone":             None,
        "company":           None,
        "title":             None,
        "city":              None,
        "tags":              [role] if role in ("founder", "rager") else [],
        "source":            "self_signup",
        "status":            "engaged",
        "user_id":           None,
        "notes":             None,
        "last_activity_at":  now,
        "last_contacted_at": None,
        "is_deleted":        False,
        "created_at":        now,
        "updated_at":        now,
    })

    user_id = str(uuid.uuid4())
    user = {
        "id":                    user_id,
        "contact_id":            contact_id,
        "email":                 email,
        "name":                  payload.name.strip(),
        "password_hash":         hash_password(payload.password),
        "role":                  role,
        "status":                "active",
        "invite_token_hash":     None,
        "invite_token_expires":  None,
        "invite_sent_at":        None,
        "reset_token_hash":      None,
        "reset_token_expires":   None,
        "failed_login_attempts": 0,
        "locked_at":             None,
        "last_login_at":         now,
        "created_at":            now,
        "updated_at":            now,
    }
    db.users.insert_one(user)
    user.pop("_id", None)

    db.contacts.update_one({"id": contact_id}, {"$set": {"user_id": user_id}})

    token = create_access_token(user)
    return {"token": token, "user": serialize_user(user)}


# ── Me / Logout ───────────────────────────────────────────────────────────────

@router.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

@router.post("/auth/logout")
def logout():
    return {"ok": True}


# ── Validate token ────────────────────────────────────────────────────────────

@router.get("/auth/validate-token")
def validate_token(
    token: str = Query(...),
    type:  str = Query(...),
):
    """Called before rendering setup / reset form to check link validity."""
    if type not in ("invite", "reset"):
        raise HTTPException(status_code=400, detail="type must be 'invite' or 'reset'")

    token_hash = hash_token(token)
    now        = datetime.now(timezone.utc).isoformat()

    field = "invite_token_hash"    if type == "invite" else "reset_token_hash"
    exp   = "invite_token_expires" if type == "invite" else "reset_token_expires"

    user = db.users.find_one(
        {field: token_hash, exp: {"$gt": now}},
        {"_id": 0},
    )
    if not user:
        return {"valid": False, "email": None, "expires_at": None}

    parts  = user["email"].split("@")
    masked = (parts[0][:2] + "***@" + parts[1]) if len(parts) == 2 else "***"
    return {"valid": True, "email": masked, "expires_at": user.get(exp)}


# ── Setup password (invite flow) ──────────────────────────────────────────────

@router.post("/auth/setup-password")
def setup_password(payload: SetupPasswordRequest):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    err = validate_password_strength(payload.password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    token_hash = hash_token(payload.token)
    now        = datetime.now(timezone.utc).isoformat()

    user = db.users.find_one(
        {"invite_token_hash": token_hash, "invite_token_expires": {"$gt": now}},
        {"_id": 0},
    )
    if not user:
        raise HTTPException(status_code=400, detail="Setup link is invalid or has expired")

    db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash":         hash_password(payload.password),
        "status":                "active",
        "invite_token_hash":     None,
        "invite_token_expires":  None,
        "failed_login_attempts": 0,
        "last_login_at":         now,
        "updated_at":            now,
    }})

    if user.get("contact_id"):
        db.contacts.update_one(
            {"id": user["contact_id"]},
            {"$set": {"status": "engaged", "updated_at": now}},
        )

    write_audit(
        action="account.setup_complete",
        entity_type="user",
        entity_id=user["id"],
        metadata={"role": user.get("role"), "contact_id": user.get("contact_id")},
    )

    updated = db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"token": create_access_token(updated), "user": serialize_user(updated)}


# ── Forgot password ───────────────────────────────────────────────────────────

@router.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.lower().strip()
    user  = db.users.find_one(
        {"email": email, "status": {"$in": ["active", "locked"]}},
        {"_id": 0},
    )

    if user:
        plain_token = generate_secure_token()
        expires     = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()

        db.users.update_one({"id": user["id"]}, {"$set": {
            "reset_token_hash":    hash_token(plain_token),
            "reset_token_expires": expires,
        }})

        reset_url = f"{FRONTEND_URL}/reset-password?token={plain_token}"
        send_email(
            to_email=email,
            to_name=user.get("name", ""),
            template="password_reset",
            subject="Reset your RAGE password",
            html_body=reset_email_html(user.get("name", "there"), reset_url),
            entity_type="user",
            entity_id=user["id"],
        )

    return {"ok": True, "message": "If that email exists, we've sent a reset link"}


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/auth/reset-password")
def reset_password(payload: ResetPasswordRequest):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    err = validate_password_strength(payload.password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    token_hash = hash_token(payload.token)
    now        = datetime.now(timezone.utc).isoformat()

    user = db.users.find_one(
        {"reset_token_hash": token_hash, "reset_token_expires": {"$gt": now}},
        {"_id": 0},
    )
    if not user:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash":         hash_password(payload.password),
        "status":                "active",
        "reset_token_hash":      None,
        "reset_token_expires":   None,
        "failed_login_attempts": 0,
        "locked_at":             None,
        "last_login_at":         now,
        "updated_at":            now,
    }})

    write_audit(
        action="password.reset_complete",
        entity_type="user",
        entity_id=user["id"],
        metadata={"reset_at": now},
    )

    updated = db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"token": create_access_token(updated), "user": serialize_user(updated)}
