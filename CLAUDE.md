# RAGE Platform — Claude Code Context

## What is RAGE
RAGE is a matching and workflow platform for women founders in India. Three products:
- **Closed Table** — paid 1:1 expert advisory sessions (founder pays, expert gets paid, RAGE takes margin)
- **Private Table** — curated dinners connecting founders and industry leaders
- **Sunday Table** — documentary series featuring women-led businesses

## Deployed Infrastructure
| Service    | Platform  | URL |
|------------|-----------|-----|
| Frontend   | Vercel    | https://rage-v5xv.vercel.app |
| Backend    | Railway   | https://rage-production.up.railway.app |
| Database   | MongoDB Atlas | env: `MONGO_URL` |
| Payments   | Razorpay  | env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Email      | Resend    | env: `RESEND_API_KEY` |

## Tech Stack
- **Backend**: FastAPI (Python), pymongo, passlib[bcrypt], python-jose, pydantic v2
- **Frontend**: React (CRA + craco), Tailwind CSS, shadcn/ui, axios, react-router-dom v6
- **Auth**: JWT (Bearer token), stored in `localStorage` as `rage_token`

## Environment Variables
### Backend (`backend/.env`)
```
MONGO_URL=
DB_NAME=rage
CORS_ORIGINS=http://localhost:3000,https://rage-v5xv.vercel.app
JWT_SECRET=
JWT_EXPIRE_MINUTES=1440
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
```

### Frontend (`frontend/.env`)
```
REACT_APP_BACKEND_URL=https://rage-production.up.railway.app
```

## User Roles
- `admin` — full access, manages all enquiries, allocations, members
- `founder` — submits Closed Table requests, sees own sessions
- `expert` — receives allocation proposals, accepts/declines
- `member` — general RAGE network member
- `sponsor` — sponsor/investor access

## Data Model (MongoDB collections)
- `users` — `{ id (uuid), email, name, password_hash, role, status }`
- `enquiries` — `{ id (uuid), founder_id, product, status, ... }`
- `allocations` — `{ id (uuid), enquiry_id, member_id, cost_to_admin, payout_to_member, admin_workflow, member_response }`
- `ragers` — member/expert profiles (to be built)
- `content` — CMS content blocks (to be built)

## Key File Locations
```
backend/
  app/
    main.py          — FastAPI app, CORS config, router includes
    core/
      auth.py        — JWT, bcrypt, get_current_user, require_admin
      db.py          — MongoDB client singleton
    api/
      auth.py        — /auth/login, /auth/signup, /auth/me
      admin.py       — /admin/* (require_admin protected)
      member.py      — /member/* (member-facing endpoints)
      seed.py        — /seed/admin (bootstrap admin user)
    schemas/
      auth.py        — LoginRequest, SignupRequest, AuthUser, LoginResponse
    models/
      schemas.py     — shared Pydantic models

frontend/src/
  App.js             — routes, ProtectedRoute, DashboardRouter
  contexts/
    AuthContext.js   — user state, login/signup/logout, token management
  lib/
    api.js           — axios instance, auth interceptors
  pages/
    LoginPage.js     — login + signup form
    admin/
      AdminDashboard.js
      MatchingPanel.js
      AdminContentEditor.js
    FounderDashboard.js
    ExpertDashboard.js
    MemberDashboard.js
```

## Build Roadmap (in order)
1. ✅ Fix authentication (bcrypt, JWT, protected routes, signup endpoint)
2. Fix matching page showing real data
3. Build Rager (member) management system
4. Complete allocation and session flow
5. Payment flow via Razorpay
6. Public website pages (homepage, three tables, Ragers directory, enquiry form)
7. Admin CMS (edit page content, manage Rager profiles, toggle public visibility)
8. SEO (meta tags, Open Graph, sitemap)

## Important Notes
- CORS_ORIGINS must be comma-separated when multiple origins needed (main.py parses it)
- All MongoDB documents use `id` (UUID string), NOT `_id` — `_id` is always excluded from queries
- The 401 interceptor in `api.js` redirects to `/member-login` (not `/login`)
- Admin bootstrap: `POST /api/seed/admin` creates admin@rage.com / admin123 if not exists
- `operations.py` is dead code — not imported, can be deleted when cleaning up
