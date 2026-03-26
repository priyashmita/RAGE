from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hmac
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'rage-fallback-secret')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 48

# Razorpay
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
razorpay_client = None
try:
    import razorpay
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except ImportError:
    pass

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VALID_ROLES = ['founder', 'expert', 'member', 'sponsor', 'admin']
EXPERTISE_CATEGORIES = [
    'technology', 'marketing', 'finance', 'operations', 'strategy',
    'product', 'design', 'sales', 'hr', 'legal', 'fundraising', 'growth'
]

# ── Auth Helpers ──
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {'user_id': user_id, 'role': role, 'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(status_code=403, detail='Insufficient permissions')
        return user
    return checker

async def log_audit(user_id: str, action: str, entity_type: str, entity_id: str, details: str = ""):
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()), 'user_id': user_id, 'action': action,
        'entity_type': entity_type, 'entity_id': entity_id, 'details': details,
        'created_at': datetime.now(timezone.utc).isoformat()
    })

# ── Shared Scoring Engine ──
def score_candidates(request_tags, candidates, urgency=''):
    """Score a pool of candidates against request tags. Returns top 10 sorted by score."""
    tags = set(t.lower() for t in request_tags)
    results = []
    for c in candidates:
        c_tags = set(t.lower() for t in c.get('tags', []))
        overlap = tags & c_tags
        if not overlap:
            continue
        score = (len(overlap) / max(len(tags), 1)) * 60
        avail = c.get('availability', '')
        if avail == 'immediate':
            score += 20
        elif avail == 'this_week':
            score += 10
        if c.get('rating'):
            score += min(c['rating'] * 4, 20)
        if urgency == 'this_week' and avail in ('immediate', 'this_week'):
            score += 5
        results.append({
            'candidate_id': c.get('id', c.get('user_id', '')),
            'candidate_name': c.get('name', ''),
            'candidate_type': c.get('_pool_type', 'expert'),
            'score': round(score, 1),
            'matched_tags': list(overlap),
            'availability': avail,
            'participation_mode': c.get('participation_mode', ''),
            'free_hours_remaining': max(c.get('free_hours_total', 0) - c.get('free_hours_used', 0), 0) if c.get('participation_mode') in ('volunteer', 'both') else 0,
            'hourly_rate': c.get('hourly_rate', 0),
        })
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:10]

# ── SITE CONTENT ROUTES (public read, admin write) ──
@api_router.get("/content/{page}")
async def get_page_content(page: str):
    doc = await db.site_content.find_one({'page': page}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail='Page content not found')
    return doc

@api_router.get("/admin/content")
async def admin_get_all_content(user=Depends(require_role('admin'))):
    return await db.site_content.find({}, {'_id': 0}).sort('page', 1).to_list(20)

@api_router.put("/admin/content/{page}")
async def admin_update_content(page: str, request: Request, user=Depends(require_role('admin'))):
    body = await request.json()
    sections = body.get('sections')
    if not sections:
        raise HTTPException(status_code=400, detail='sections field required')
    result = await db.site_content.update_one(
        {'page': page},
        {'$set': {'sections': sections, 'updated_at': datetime.now(timezone.utc).isoformat(), 'updated_by': user['id']}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Page not found')
    await log_audit(user['id'], 'update_content', 'site_content', page, f'Updated {page} page content')
    return {'status': 'updated'}

# ── Pydantic Models ──
class SignupInput(BaseModel):
    email: str
    password: str
    name: str
    role: str = 'member'

class LoginInput(BaseModel):
    email: str
    password: str

class FounderRequestInput(BaseModel):
    title: str
    description: str
    categories: List[str] = []
    urgency: str = 'normal'
    budget_range: str = ''

class ExpertProfileInput(BaseModel):
    name: str = ''
    bio: str = ''
    expertise_areas: List[str] = []
    tags: List[str] = []
    hourly_rate: float = 0
    availability: str = 'this_week'

class MatchResponseInput(BaseModel):
    status: str

class EventInput(BaseModel):
    title: str
    description: str = ''
    date: str
    venue: str = ''
    total_seats: int
    price_per_seat: int
    image_url: str = ''

class PaymentOrderInput(BaseModel):
    event_id: str
    seats: int = 1

class PaymentVerifyInput(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    event_id: str
    seats: int = 1

class CreditAdjustInput(BaseModel):
    user_id: str
    amount: int
    description: str

class SponsorLeadInput(BaseModel):
    company_name: str
    contact_name: str
    email: str
    phone: str = ''
    package_interest: str = ''
    message: str = ''

class EnquiryInput(BaseModel):
    name: str
    email: str
    company: str = ''
    interest: str = 'general'
    message: str = ''

class ClosedTableRequestInput(BaseModel):
    name: str
    email: str
    company: str = ''
    role: str = ''
    problem_statement: str
    decision_type: str
    business_stage: str = ''
    urgency: str = 'this_month'
    help_needed: List[str] = []
    preferred_format: str = 'not_sure'
    notes: str = ''

class NetworkMemberInput(BaseModel):
    name: str
    email: str = ''
    phone: str = ''
    company: str = ''
    title: str = ''
    bio: str = ''
    tags: List[str] = []
    industries: List[str] = []
    stage_experience: List[str] = []
    geography: List[str] = []
    is_rage_member: bool = True
    participation_mode: str = 'both'
    free_hours_total: int = 300
    free_hours_used: int = 0
    hourly_rate: float = 0
    can_accept_closed_table: bool = True
    can_accept_private_table: bool = True
    availability: str = 'this_week'
    status: str = 'active'
    notes: str = ''

class HoursAdjustInput(BaseModel):
    amount: int
    description: str = ''

class SessionCreateInput(BaseModel):
    match_id: str
    scheduled_at: str
    duration_minutes: int = 60

# ── AUTH ROUTES ──
@api_router.post("/auth/signup")
async def signup(data: SignupInput):
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail='Invalid role')
    existing = await db.users.find_one({'email': data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    user_id = str(uuid.uuid4())
    user = {
        'id': user_id, 'email': data.email, 'name': data.name,
        'password_hash': hash_password(data.password), 'role': data.role,
        'status': 'active', 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    # Role-specific initialization
    if data.role == 'expert':
        await db.experts.insert_one({
            'id': str(uuid.uuid4()), 'user_id': user_id, 'name': data.name,
            'bio': '', 'expertise_areas': [], 'tags': [], 'hourly_rate': 0,
            'availability': 'this_week', 'rating': 3.0, 'status': 'active',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    if data.role == 'member':
        plan_id = str(uuid.uuid4())
        await db.member_plans.insert_one({
            'id': plan_id, 'user_id': user_id, 'plan_type': 'free',
            'free_minutes_total': 300, 'free_minutes_used': 0, 'is_paid': False,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        await db.member_credit_ledger.insert_one({
            'id': str(uuid.uuid4()), 'user_id': user_id, 'type': 'credit',
            'amount': 300, 'balance_after': 300, 'description': 'Initial free credit: 5 hours',
            'session_id': '', 'created_at': datetime.now(timezone.utc).isoformat()
        })
    token = create_token(user_id, data.role)
    # Get user from DB to ensure we have clean data without _id
    created_user = await db.users.find_one({'id': user_id}, {'_id': 0})
    safe_user = {k: v for k, v in created_user.items() if k != 'password_hash'}
    await log_audit(user_id, 'signup', 'user', user_id, f'Role: {data.role}')
    return {'token': token, 'user': safe_user}

@api_router.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    if user.get('status') != 'active':
        raise HTTPException(status_code=403, detail='Account disabled')
    token = create_token(user['id'], user['role'])
    safe_user = {k: v for k, v in user.items() if k != 'password_hash'}
    return {'token': token, 'user': safe_user}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    safe = {k: v for k, v in user.items() if k != 'password_hash'}
    return safe

# ── FOUNDER ROUTES ──
@api_router.post("/founders/requests")
async def create_founder_request(data: FounderRequestInput, user=Depends(require_role('founder', 'admin'))):
    req = {
        'id': str(uuid.uuid4()), 'founder_id': user['id'], 'founder_name': user['name'],
        'title': data.title, 'description': data.description, 'categories': data.categories,
        'urgency': data.urgency, 'budget_range': data.budget_range, 'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.founder_requests.insert_one(req)
    await log_audit(user['id'], 'create_request', 'founder_request', req['id'], data.title)
    return {k: v for k, v in req.items() if k != '_id'}

@api_router.get("/founders/requests")
async def get_founder_requests(user=Depends(require_role('founder', 'admin'))):
    query = {} if user['role'] == 'admin' else {'founder_id': user['id']}
    reqs = await db.founder_requests.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)
    return reqs

@api_router.get("/founders/matches")
async def get_founder_matches(user=Depends(require_role('founder', 'admin'))):
    query = {} if user['role'] == 'admin' else {'founder_id': user['id']}
    matches = await db.matches.find(query, {'_id': 0}).sort('score', -1).to_list(100)
    return matches

@api_router.get("/founders/sessions")
async def get_founder_sessions(user=Depends(require_role('founder', 'admin'))):
    query = {} if user['role'] == 'admin' else {'founder_id': user['id']}
    sessions = await db.sessions.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)
    return sessions

# ── EXPERT ROUTES ──
@api_router.get("/experts/profile")
async def get_expert_profile(user=Depends(require_role('expert'))):
    profile = await db.experts.find_one({'user_id': user['id']}, {'_id': 0})
    if not profile:
        raise HTTPException(status_code=404, detail='Expert profile not found')
    return profile

@api_router.put("/experts/profile")
async def update_expert_profile(data: ExpertProfileInput, user=Depends(require_role('expert'))):
    update = data.model_dump(exclude_unset=True)
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.experts.update_one({'user_id': user['id']}, {'$set': update})
    profile = await db.experts.find_one({'user_id': user['id']}, {'_id': 0})
    return profile

@api_router.get("/experts/matches")
async def get_expert_matches(user=Depends(require_role('expert'))):
    matches = await db.matches.find({'expert_id': user['id']}, {'_id': 0}).sort('matched_at', -1).to_list(100)
    # Enrich with request details
    for m in matches:
        req = await db.founder_requests.find_one({'id': m['request_id']}, {'_id': 0})
        if req:
            m['request_title'] = req.get('title', '')
            m['request_description'] = req.get('description', '')
    return matches

@api_router.put("/experts/matches/{match_id}/respond")
async def respond_to_match(match_id: str, data: MatchResponseInput, user=Depends(require_role('expert'))):
    if data.status not in ['accepted', 'declined']:
        raise HTTPException(status_code=400, detail='Status must be accepted or declined')
    match = await db.matches.find_one({'id': match_id, 'expert_id': user['id']}, {'_id': 0})
    if not match:
        raise HTTPException(status_code=404, detail='Match not found')
    await db.matches.update_one({'id': match_id}, {'$set': {'status': data.status, 'responded_at': datetime.now(timezone.utc).isoformat()}})
    await log_audit(user['id'], f'match_{data.status}', 'match', match_id)
    updated = await db.matches.find_one({'id': match_id}, {'_id': 0})
    return updated

# ── MATCHING ENGINE ──
@api_router.post("/admin/matching/run/{request_id}")
async def run_matching(request_id: str, user=Depends(require_role('admin'))):
    request = await db.founder_requests.find_one({'id': request_id}, {'_id': 0})
    if not request:
        raise HTTPException(status_code=404, detail='Request not found')
    experts = await db.experts.find({'status': 'active'}, {'_id': 0}).to_list(500)
    for e in experts:
        e['_pool_type'] = 'expert'
        e['id'] = e.get('user_id', e.get('id', ''))
    scored = score_candidates(request.get('categories', []), experts, request.get('urgency', ''))
    matches = []
    for s in scored:
        matches.append({
            'id': str(uuid.uuid4()), 'request_id': request_id,
            'source_type': 'founder_request', 'source_id': request_id,
            'expert_id': s['candidate_id'], 'expert_name': s['candidate_name'],
            'candidate_type': s['candidate_type'],
            'founder_id': request['founder_id'], 'score': s['score'],
            'matched_tags': s['matched_tags'], 'status': 'pending',
            'matched_at': datetime.now(timezone.utc).isoformat(), 'admin_notes': ''
        })
    if matches:
        await db.matches.insert_many([{**m} for m in matches])
    await db.founder_requests.update_one({'id': request_id}, {'$set': {'status': 'matched'}})
    await log_audit(user['id'], 'run_matching', 'founder_request', request_id, f'Found {len(matches)} matches')
    return {'matches_found': len(matches), 'matches': [{k: v for k, v in m.items() if k != '_id'} for m in matches]}

# ── MEMBER / TIME BANK ROUTES ──
@api_router.get("/members/plan")
async def get_member_plan(user=Depends(require_role('member'))):
    plan = await db.member_plans.find_one({'user_id': user['id']}, {'_id': 0})
    if not plan:
        raise HTTPException(status_code=404, detail='No plan found')
    return plan

@api_router.get("/members/ledger")
async def get_member_ledger(user=Depends(require_role('member'))):
    entries = await db.member_credit_ledger.find({'user_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return entries

# ── EVENT ROUTES ──
@api_router.get("/events")
async def list_events(user=Depends(get_current_user)):
    events = await db.events.find({'status': 'active'}, {'_id': 0}).sort('date', 1).to_list(50)
    return events

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, user=Depends(get_current_user)):
    event = await db.events.find_one({'id': event_id}, {'_id': 0})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    return event

@api_router.get("/events/{event_id}/bookings")
async def get_my_bookings(event_id: str, user=Depends(get_current_user)):
    bookings = await db.event_bookings.find({'event_id': event_id, 'user_id': user['id']}, {'_id': 0}).to_list(20)
    return bookings

# ── PAYMENT CONFIG (public) ──
@api_router.get("/payment-config")
async def get_payment_config():
    return {
        'razorpay_available': razorpay_client is not None,
        'bank_transfer_available': True,
        'bank_transfer_note': 'Our team will share bank transfer details after you reserve your seats.'
    }

# ── PAYMENT ROUTES ──
class BankTransferBookingInput(BaseModel):
    event_id: str
    seats: int = 1

@api_router.post("/bookings/bank-transfer")
async def create_bank_transfer_booking(data: BankTransferBookingInput, user=Depends(get_current_user)):
    event = await db.events.find_one({'id': data.event_id}, {'_id': 0})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    if event.get('available_seats', 0) < data.seats:
        raise HTTPException(status_code=400, detail='Not enough seats available')
    amount = data.seats * event['price_per_seat']
    payment = {
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'user_name': user['name'],
        'user_email': user['email'], 'type': 'event_booking', 'method': 'bank_transfer',
        'amount': amount, 'event_id': data.event_id, 'seats': data.seats,
        'event_title': event.get('title', ''),
        'razorpay_order_id': '', 'razorpay_payment_id': '', 'razorpay_signature': '',
        'status': 'pending', 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    booking = {
        'id': str(uuid.uuid4()), 'event_id': data.event_id, 'user_id': user['id'],
        'user_name': user['name'], 'user_email': user['email'], 'seats': data.seats,
        'total_amount': amount, 'payment_id': payment['id'],
        'payment_method': 'bank_transfer', 'status': 'awaiting_payment',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.event_bookings.insert_one(booking)
    # Hold seats
    result = await db.events.update_one(
        {'id': data.event_id, 'available_seats': {'$gte': data.seats}},
        {'$inc': {'available_seats': -data.seats}}
    )
    if result.modified_count == 0:
        await db.payments.update_one({'id': payment['id']}, {'$set': {'status': 'failed'}})
        await db.event_bookings.update_one({'id': booking['id']}, {'$set': {'status': 'failed'}})
        raise HTTPException(status_code=400, detail='Seats no longer available')
    await log_audit(user['id'], 'bank_transfer_booking', 'event_booking', booking['id'], f'{event["title"]} — {data.seats} seat(s) — awaiting payment')
    return {'status': 'reserved', 'booking': {k: v for k, v in booking.items() if k != '_id'}, 'payment_id': payment['id']}

@api_router.put("/admin/bookings/{booking_id}/payment-status")
async def admin_update_booking_payment(booking_id: str, status: str, user=Depends(require_role('admin'))):
    valid = ['pending', 'bank_details_shared', 'payment_received', 'confirmed', 'failed', 'refunded']
    if status not in valid:
        raise HTTPException(status_code=400, detail=f'Invalid status. Must be one of: {valid}')
    booking = await db.event_bookings.find_one({'id': booking_id}, {'_id': 0})
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    booking_update = {'status': 'confirmed' if status == 'payment_received' else ('cancelled' if status in ('failed', 'refunded') else booking.get('status', 'awaiting_payment'))}
    if status == 'confirmed':
        booking_update['status'] = 'confirmed'
    await db.event_bookings.update_one({'id': booking_id}, {'$set': booking_update})
    # Update linked payment
    if booking.get('payment_id'):
        await db.payments.update_one({'id': booking['payment_id']}, {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()}})
    # Restore seats on failure/refund
    if status in ('failed', 'refunded') and booking.get('status') != 'cancelled':
        await db.events.update_one({'id': booking['event_id']}, {'$inc': {'available_seats': booking.get('seats', 0)}})
    await log_audit(user['id'], f'booking_payment_{status}', 'event_booking', booking_id)
    return {'status': 'updated'}

@api_router.post("/payments/create-order")
async def create_payment_order(data: PaymentOrderInput, user=Depends(get_current_user)):
    if not razorpay_client:
        raise HTTPException(status_code=503, detail='Payment system not configured. Contact admin to set up Razorpay keys.')
    event = await db.events.find_one({'id': data.event_id}, {'_id': 0})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    if event.get('available_seats', 0) < data.seats:
        raise HTTPException(status_code=400, detail='Not enough seats available')
    amount = data.seats * event['price_per_seat'] * 100  # Convert to paise
    try:
        order = razorpay_client.order.create({
            'amount': amount, 'currency': 'INR', 'payment_capture': 1,
            'receipt': f"evt_{event['id'][:8]}_{str(uuid.uuid4())[:8]}"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Razorpay error: {str(e)}')
    payment = {
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'type': 'event_booking',
        'amount': amount, 'event_id': data.event_id, 'seats': data.seats,
        'razorpay_order_id': order['id'], 'razorpay_payment_id': '',
        'razorpay_signature': '', 'status': 'created',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    return {
        'order_id': order['id'], 'amount': amount, 'currency': 'INR',
        'razorpay_key_id': RAZORPAY_KEY_ID, 'payment_id': payment['id']
    }

@api_router.post("/payments/verify")
async def verify_payment(data: PaymentVerifyInput, user=Depends(get_current_user)):
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail='Payment verification not configured')
    body = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode('utf-8'), body.encode('utf-8'), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        raise HTTPException(status_code=400, detail='Payment verification failed')
    # Update payment record
    await db.payments.update_one(
        {'razorpay_order_id': data.razorpay_order_id},
        {'$set': {'razorpay_payment_id': data.razorpay_payment_id, 'razorpay_signature': data.razorpay_signature, 'status': 'captured', 'verified_at': datetime.now(timezone.utc).isoformat()}}
    )
    # Create booking
    event = await db.events.find_one({'id': data.event_id}, {'_id': 0})
    if not event or event.get('available_seats', 0) < data.seats:
        raise HTTPException(status_code=400, detail='Seats no longer available')
    booking = {
        'id': str(uuid.uuid4()), 'event_id': data.event_id, 'user_id': user['id'],
        'user_name': user['name'], 'seats': data.seats,
        'total_amount': data.seats * event['price_per_seat'],
        'razorpay_payment_id': data.razorpay_payment_id, 'status': 'confirmed',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.event_bookings.insert_one(booking)
    # Decrement seats atomically
    result = await db.events.update_one(
        {'id': data.event_id, 'available_seats': {'$gte': data.seats}},
        {'$inc': {'available_seats': -data.seats}}
    )
    if result.modified_count == 0:
        await db.event_bookings.update_one({'id': booking['id']}, {'$set': {'status': 'failed'}})
        raise HTTPException(status_code=400, detail='Seat booking failed - overbooking prevented')
    await log_audit(user['id'], 'booking_confirmed', 'event_booking', booking['id'], f'Event: {event["title"]}, Seats: {data.seats}')
    return {'status': 'success', 'booking': {k: v for k, v in booking.items() if k != '_id'}}

# ── CLOSED TABLE REQUEST ROUTES (public, no auth) ──
DECISION_TYPE_CATEGORIES = {
    'fundraising': ['finance', 'fundraising'],
    'hiring': ['hr', 'operations'],
    'gtm': ['marketing', 'sales', 'growth'],
    'strategic_pivot': ['strategy', 'product'],
    'partnership': ['strategy', 'sales'],
    'financial_structuring': ['finance', 'legal'],
    'policy': ['legal', 'operations'],
    'product': ['product', 'technology', 'design'],
    'other': ['strategy'],
}

@api_router.post("/closed-table-requests")
async def create_closed_table_request(data: ClosedTableRequestInput):
    categories = DECISION_TYPE_CATEGORIES.get(data.decision_type, ['strategy'])
    req = {
        'id': str(uuid.uuid4()),
        **data.model_dump(),
        'categories': categories,
        'status': 'new',
        'admin_notes': '',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.closed_table_requests.insert_one(req)
    await log_audit('system', 'closed_table_request', 'closed_table_request', req['id'], f'{data.name} — {data.decision_type}')
    return {k: v for k, v in req.items() if k != '_id'}

@api_router.get("/admin/closed-table-requests")
async def admin_get_closed_table_requests(user=Depends(require_role('admin'))):
    return await db.closed_table_requests.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)

@api_router.put("/admin/closed-table-requests/{request_id}/status")
async def admin_update_ct_status(request_id: str, status: str, admin_notes: str = '', user=Depends(require_role('admin'))):
    valid = ['new', 'reviewed', 'shortlisted', 'matched', 'session_created', 'converted', 'closed']
    if status not in valid:
        raise HTTPException(status_code=400, detail=f'Invalid status. Must be one of: {valid}')
    update = {'status': status, 'updated_at': datetime.now(timezone.utc).isoformat()}
    if admin_notes:
        update['admin_notes'] = admin_notes
    result = await db.closed_table_requests.update_one({'id': request_id}, {'$set': update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Request not found')
    await log_audit(user['id'], f'ct_status_{status}', 'closed_table_request', request_id, admin_notes)
    return {'status': 'updated'}

@api_router.post("/admin/ct-requests/{request_id}/match")
async def ct_generate_matches(request_id: str, user=Depends(require_role('admin'))):
    ct = await db.closed_table_requests.find_one({'id': request_id}, {'_id': 0})
    if not ct:
        raise HTTPException(status_code=404, detail='CT request not found')
    await db.matches.delete_many({'ct_request_id': request_id})
    # Build combined pool: network_members (primary) + experts (secondary)
    members = await db.network_members.find({'status': 'active', 'can_accept_closed_table': True}, {'_id': 0}).to_list(500)
    for m in members:
        m['_pool_type'] = 'network_member'
    experts = await db.experts.find({'status': 'active'}, {'_id': 0}).to_list(500)
    for e in experts:
        e['_pool_type'] = 'expert'
        e['id'] = e.get('user_id', e.get('id', ''))
    pool = members + experts
    scored = score_candidates(ct.get('categories', []), pool, ct.get('urgency', ''))
    matches = []
    for s in scored:
        is_free = s['participation_mode'] in ('volunteer', 'both') and s['free_hours_remaining'] > 0
        matches.append({
            'id': str(uuid.uuid4()), 'ct_request_id': request_id, 'request_id': '',
            'source_type': 'closed_table', 'source_id': request_id,
            'expert_id': s['candidate_id'], 'expert_name': s['candidate_name'],
            'candidate_type': s['candidate_type'],
            'founder_id': '', 'founder_name': ct.get('name', ''),
            'score': s['score'], 'matched_tags': s['matched_tags'],
            'participation_mode': s.get('participation_mode', ''),
            'is_free_eligible': is_free,
            'hourly_rate': s.get('hourly_rate', 0),
            'free_hours_remaining': s.get('free_hours_remaining', 0),
            'status': 'suggested',
            'matched_at': datetime.now(timezone.utc).isoformat(), 'admin_notes': ''
        })
    if matches:
        await db.matches.insert_many([{**m} for m in matches])
    await db.closed_table_requests.update_one({'id': request_id}, {'$set': {'status': 'matched', 'updated_at': datetime.now(timezone.utc).isoformat()}})
    await log_audit(user['id'], 'ct_match', 'closed_table_request', request_id, f'{len(matches)} matched')
    return {'matches_found': len(matches), 'matches': [{k: v for k, v in m.items() if k != '_id'} for m in matches]}

@api_router.get("/admin/ct-requests/{request_id}/matches")
async def ct_get_matches(request_id: str, user=Depends(require_role('admin'))):
    return await db.matches.find({'ct_request_id': request_id}, {'_id': 0}).sort('score', -1).to_list(50)

@api_router.post("/admin/ct-requests/{request_id}/create-session")
async def ct_create_session(request_id: str, match_id: str, user=Depends(require_role('admin'))):
    ct = await db.closed_table_requests.find_one({'id': request_id}, {'_id': 0})
    if not ct:
        raise HTTPException(status_code=404, detail='CT request not found')
    match = await db.matches.find_one({'id': match_id, 'ct_request_id': request_id}, {'_id': 0})
    if not match:
        raise HTTPException(status_code=404, detail='Match not found for this CT request')
    scheduled = datetime.now(timezone.utc) + timedelta(days=3)
    session = {
        'id': str(uuid.uuid4()), 'match_id': match_id,
        'ct_request_id': request_id,
        'founder_id': '', 'founder_name': ct.get('name', ''),
        'founder_email': ct.get('email', ''), 'founder_company': ct.get('company', ''),
        'expert_id': match['expert_id'], 'expert_name': match.get('expert_name', ''),
        'problem_statement': ct.get('problem_statement', ''),
        'decision_type': ct.get('decision_type', ''),
        'scheduled_at': scheduled.isoformat(),
        'duration_minutes': 90, 'status': 'scheduled',
        'credits_used': 0, 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sessions.insert_one(session)
    await db.matches.update_one({'id': match_id}, {'$set': {'status': 'session_created'}})
    await db.closed_table_requests.update_one(
        {'id': request_id},
        {'$set': {'status': 'session_created', 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    await log_audit(user['id'], 'ct_session_created', 'session', session['id'], f'CT: {ct.get("name")} + Expert: {match.get("expert_name")}')
    return {k: v for k, v in session.items() if k != '_id'}

# ── NETWORK MEMBER MANAGEMENT (admin) ──
@api_router.get("/admin/network-members")
async def admin_list_members(user=Depends(require_role('admin'))):
    return await db.network_members.find({}, {'_id': 0}).sort('name', 1).to_list(500)

@api_router.post("/admin/network-members")
async def admin_add_member(data: NetworkMemberInput, user=Depends(require_role('admin'))):
    member = {'id': str(uuid.uuid4()), **data.model_dump(), 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()}
    await db.network_members.insert_one(member)
    await log_audit(user['id'], 'add_member', 'network_member', member['id'], data.name)
    return {k: v for k, v in member.items() if k != '_id'}

@api_router.put("/admin/network-members/{member_id}")
async def admin_update_member(member_id: str, data: NetworkMemberInput, user=Depends(require_role('admin'))):
    update = data.model_dump()
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.network_members.update_one({'id': member_id}, {'$set': update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Member not found')
    await log_audit(user['id'], 'update_member', 'network_member', member_id, data.name)
    return await db.network_members.find_one({'id': member_id}, {'_id': 0})

@api_router.put("/admin/network-members/{member_id}/deactivate")
async def admin_deactivate_member(member_id: str, user=Depends(require_role('admin'))):
    result = await db.network_members.update_one({'id': member_id}, {'$set': {'status': 'deactivated', 'updated_at': datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Member not found')
    await log_audit(user['id'], 'deactivate_member', 'network_member', member_id)
    return {'status': 'deactivated'}

@api_router.post("/admin/network-members/{member_id}/adjust-hours")
async def admin_adjust_member_hours(member_id: str, data: HoursAdjustInput, user=Depends(require_role('admin'))):
    member = await db.network_members.find_one({'id': member_id}, {'_id': 0})
    if not member:
        raise HTTPException(status_code=404, detail='Member not found')
    new_used = max(member.get('free_hours_used', 0) + data.amount, 0)
    await db.network_members.update_one({'id': member_id}, {'$set': {'free_hours_used': new_used, 'updated_at': datetime.now(timezone.utc).isoformat()}})
    await log_audit(user['id'], 'adjust_hours', 'network_member', member_id, f'{data.amount} min: {data.description}')
    return {'free_hours_used': new_used, 'free_hours_remaining': max(member.get('free_hours_total', 300) - new_used, 0)}

# ── ENQUIRY ROUTES (public, no auth) ──
@api_router.post("/enquiries")
async def create_enquiry(data: EnquiryInput):
    enquiry = {
        'id': str(uuid.uuid4()), **data.model_dump(),
        'status': 'new', 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.enquiries.insert_one(enquiry)
    return {k: v for k, v in enquiry.items() if k != '_id'}

@api_router.get("/admin/enquiries")
async def admin_get_enquiries(user=Depends(require_role('admin'))):
    return await db.enquiries.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)

# ── SPONSOR ROUTES ──
@api_router.post("/sponsors/leads")
async def create_sponsor_lead(data: SponsorLeadInput):
    lead = {
        'id': str(uuid.uuid4()), **data.model_dump(),
        'status': 'new', 'pipeline_stage': 'inquiry',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sponsor_leads.insert_one(lead)
    return {k: v for k, v in lead.items() if k != '_id'}

@api_router.get("/sponsors/leads")
async def get_sponsor_leads(user=Depends(require_role('admin', 'sponsor'))):
    leads = await db.sponsor_leads.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return leads

# ── ADMIN ROUTES ──
@api_router.get("/admin/users")
async def admin_get_users(user=Depends(require_role('admin'))):
    users = await db.users.find({}, {'_id': 0, 'password_hash': 0}).sort('created_at', -1).to_list(500)
    return users

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_role(user_id: str, role: str, user=Depends(require_role('admin'))):
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail='Invalid role')
    result = await db.users.update_one({'id': user_id}, {'$set': {'role': role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='User not found')
    await log_audit(user['id'], 'change_role', 'user', user_id, f'New role: {role}')
    return {'status': 'updated'}

@api_router.put("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, status: str, user=Depends(require_role('admin'))):
    await db.users.update_one({'id': user_id}, {'$set': {'status': status}})
    await log_audit(user['id'], 'change_status', 'user', user_id, f'New status: {status}')
    return {'status': 'updated'}

@api_router.get("/admin/requests")
async def admin_get_requests(user=Depends(require_role('admin'))):
    reqs = await db.founder_requests.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return reqs

@api_router.get("/admin/matches")
async def admin_get_matches(user=Depends(require_role('admin'))):
    matches = await db.matches.find({}, {'_id': 0}).sort('matched_at', -1).to_list(200)
    return matches

@api_router.put("/admin/matches/{match_id}")
async def admin_update_match(match_id: str, status: str, admin_notes: str = '', user=Depends(require_role('admin'))):
    update = {'status': status}
    if admin_notes:
        update['admin_notes'] = admin_notes
    await db.matches.update_one({'id': match_id}, {'$set': update})
    await log_audit(user['id'], 'update_match', 'match', match_id, f'Status: {status}')
    return {'status': 'updated'}

@api_router.get("/admin/sessions")
async def admin_get_sessions(user=Depends(require_role('admin'))):
    sessions = await db.sessions.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return sessions

@api_router.post("/admin/sessions")
async def admin_create_session(data: SessionCreateInput, user=Depends(require_role('admin'))):
    match = await db.matches.find_one({'id': data.match_id}, {'_id': 0})
    if not match:
        raise HTTPException(status_code=404, detail='Match not found')
    session = {
        'id': str(uuid.uuid4()), 'match_id': data.match_id,
        'founder_id': match['founder_id'], 'expert_id': match['expert_id'],
        'expert_name': match.get('expert_name', ''), 'scheduled_at': data.scheduled_at,
        'duration_minutes': data.duration_minutes, 'status': 'scheduled',
        'credits_used': 0, 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sessions.insert_one(session)
    await db.matches.update_one({'id': data.match_id}, {'$set': {'status': 'session_created'}})
    await log_audit(user['id'], 'create_session', 'session', session['id'])
    return {k: v for k, v in session.items() if k != '_id'}

@api_router.put("/admin/sessions/{session_id}/complete")
async def admin_complete_session(session_id: str, user=Depends(require_role('admin'))):
    session = await db.sessions.find_one({'id': session_id}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    duration = session.get('duration_minutes', 60)
    # Deduct credits from founder if they're a member
    founder = await db.users.find_one({'id': session['founder_id']}, {'_id': 0})
    if founder:
        plan = await db.member_plans.find_one({'user_id': founder['id']}, {'_id': 0})
        if plan:
            remaining = plan['free_minutes_total'] - plan['free_minutes_used']
            deduct = min(duration, remaining)
            await db.member_plans.update_one(
                {'user_id': founder['id']},
                {'$inc': {'free_minutes_used': deduct}}
            )
            new_balance = remaining - deduct
            await db.member_credit_ledger.insert_one({
                'id': str(uuid.uuid4()), 'user_id': founder['id'], 'type': 'debit',
                'amount': deduct, 'balance_after': max(new_balance, 0),
                'description': f'Session with {session.get("expert_name", "expert")} ({deduct} min)',
                'session_id': session_id, 'created_at': datetime.now(timezone.utc).isoformat()
            })
            if new_balance <= 0:
                await db.member_plans.update_one({'user_id': founder['id']}, {'$set': {'is_paid': True}})
    await db.sessions.update_one({'id': session_id}, {'$set': {'status': 'completed', 'credits_used': duration, 'completed_at': datetime.now(timezone.utc).isoformat()}})
    await log_audit(user['id'], 'complete_session', 'session', session_id)
    return {'status': 'completed'}

@api_router.post("/admin/events")
async def admin_create_event(data: EventInput, user=Depends(require_role('admin'))):
    event = {
        'id': str(uuid.uuid4()), **data.model_dump(),
        'available_seats': data.total_seats, 'status': 'active',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event)
    await log_audit(user['id'], 'create_event', 'event', event['id'], data.title)
    return {k: v for k, v in event.items() if k != '_id'}

@api_router.put("/admin/events/{event_id}")
async def admin_update_event(event_id: str, data: EventInput, user=Depends(require_role('admin'))):
    update = data.model_dump()
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.events.update_one({'id': event_id}, {'$set': update})
    return {'status': 'updated'}

@api_router.get("/admin/payments")
async def admin_get_payments(user=Depends(require_role('admin'))):
    payments = await db.payments.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return payments

@api_router.get("/admin/bookings")
async def admin_get_bookings(user=Depends(require_role('admin'))):
    bookings = await db.event_bookings.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return bookings

@api_router.post("/admin/credits/adjust")
async def admin_adjust_credits(data: CreditAdjustInput, user=Depends(require_role('admin'))):
    plan = await db.member_plans.find_one({'user_id': data.user_id}, {'_id': 0})
    if not plan:
        raise HTTPException(status_code=404, detail='No plan found for user')
    current_balance = plan['free_minutes_total'] - plan['free_minutes_used']
    new_balance = current_balance + data.amount
    if data.amount > 0:
        await db.member_plans.update_one({'user_id': data.user_id}, {'$inc': {'free_minutes_total': data.amount}})
    else:
        await db.member_plans.update_one({'user_id': data.user_id}, {'$inc': {'free_minutes_used': abs(data.amount)}})
    await db.member_credit_ledger.insert_one({
        'id': str(uuid.uuid4()), 'user_id': data.user_id,
        'type': 'credit' if data.amount > 0 else 'debit',
        'amount': abs(data.amount), 'balance_after': max(new_balance, 0),
        'description': data.description, 'session_id': '',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    await log_audit(user['id'], 'adjust_credits', 'member_plan', data.user_id, f'{data.amount} min: {data.description}')
    return {'status': 'adjusted', 'new_balance': max(new_balance, 0)}

@api_router.get("/admin/audit-logs")
async def admin_get_audit_logs(user=Depends(require_role('admin'))):
    logs = await db.audit_logs.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
    return logs

@api_router.get("/admin/stats")
async def admin_get_stats(user=Depends(require_role('admin'))):
    users_count = await db.users.count_documents({})
    requests_count = await db.founder_requests.count_documents({})
    matches_count = await db.matches.count_documents({})
    sessions_count = await db.sessions.count_documents({})
    events_count = await db.events.count_documents({})
    payments_count = await db.payments.count_documents({'status': 'captured'})
    members_count = await db.network_members.count_documents({'status': 'active'})
    ct_count = await db.closed_table_requests.count_documents({})
    return {
        'users': users_count, 'requests': requests_count, 'matches': matches_count,
        'sessions': sessions_count, 'events': events_count, 'payments': payments_count,
        'network_members': members_count, 'ct_requests': ct_count
    }

@api_router.get("/categories")
async def get_categories():
    return EXPERTISE_CATEGORIES

# ── PRIVATE TABLE CURATION ──
@api_router.post("/admin/private-table/{event_id}/curate")
async def pt_curate_attendees(event_id: str, user=Depends(require_role('admin'))):
    """Simple curation: score network members against event theme/tags."""
    event = await db.events.find_one({'id': event_id}, {'_id': 0})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    event_tags = event.get('tags', event.get('categories', []))
    if not event_tags:
        # Fallback: use all active members sorted by rating/availability
        members = await db.network_members.find({'status': 'active', 'can_accept_private_table': True}, {'_id': 0}).to_list(50)
        return {'candidates': [{'candidate_id': m['id'], 'candidate_name': m['name'], 'score': 0, 'matched_tags': [], 'participation_mode': m.get('participation_mode', ''), 'hourly_rate': m.get('hourly_rate', 0)} for m in members], 'note': 'No event tags set — showing all eligible members. Add tags to event for scored matching.'}
    members = await db.network_members.find({'status': 'active', 'can_accept_private_table': True}, {'_id': 0}).to_list(500)
    for m in members:
        m['_pool_type'] = 'network_member'
    scored = score_candidates(event_tags, members)
    return {'candidates': scored, 'note': ''}

# ── STARTUP ──
@app.on_event("startup")
async def startup():
    admin = await db.users.find_one({'email': 'admin@rage.com'}, {'_id': 0})
    if not admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            'id': admin_id, 'email': 'admin@rage.com', 'name': 'RAGE Admin',
            'password_hash': hash_password('admin123'), 'role': 'admin',
            'status': 'active', 'created_at': datetime.now(timezone.utc).isoformat()
        })
        logger.info("Admin user seeded: admin@rage.com / admin123")
    # Seed site content
    existing_content = await db.site_content.count_documents({})
    if existing_content == 0:
        from content_seed import SEED
        now = datetime.now(timezone.utc).isoformat()
        for page, sections in SEED.items():
            await db.site_content.insert_one({
                'id': str(uuid.uuid4()), 'page': page, 'sections': sections,
                'published': True, 'updated_at': now, 'updated_by': 'system'
            })
        logger.info(f"Site content seeded: {len(SEED)} pages")
    # Create indexes
    await db.users.create_index('email', unique=True)
    await db.users.create_index('id', unique=True)
    await db.founder_requests.create_index('founder_id')
    await db.matches.create_index('request_id')
    await db.matches.create_index('expert_id')
    await db.sessions.create_index('founder_id')
    await db.events.create_index('status')
    await db.payments.create_index('razorpay_order_id')
    await db.network_members.create_index('status')
    await db.network_members.create_index('tags')

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
