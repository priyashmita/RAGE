from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class User(BaseModel):
    email: EmailStr
    password_hash: str
    role: str = "member"
    status: str = "active"

class Allocation(BaseModel):
    enquiry_id: str
    member_id: str
    cost_to_admin: float
    payout_to_member: float
    admin_workflow: str = "sent"
    member_response: str = "pending"
    decline_reason: Optional[str] = None
