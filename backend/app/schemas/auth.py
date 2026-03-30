from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "member"

class AuthUser(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    status: str

class LoginResponse(BaseModel):
    token: str
    user: AuthUser
