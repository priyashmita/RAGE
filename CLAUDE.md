# RAGE Platform — Claude Code Context

## What is RAGE
RAGE (Radical Alliance for Gender Equity) is a matching and workflow platform for women founders in India. Three products:
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
| AI         | Gemini    | env: `GEMINI_API_KEY` |

## Verifying a deploy worked
```
curl https://rage-production.up.railway.app/api/health
```
Should return `status: ok` with content_pages_seeded count. If pages = 0, something is wrong.

## Tech Stack
- **Backend**: FastAPI (Python), pymongo, passlib[bcrypt], python-jose, pydantic v2
- **Frontend**: React (CRA + craco), Tailwind CSS, shadcn/ui, axios, react-router-dom v6
- **Auth**: JWT (Bearer token), stored in `localStorage` as `rage_token`

## Environment Variables
### Backend (set on Railway)
```
MONGO_URL=
DB_NAME=rage
CORS_ORIGINS=http://localhost:3000,https://rage-v5xv.vercel.app
JWT_SECRET=
JWT_EXPIRE_MINUTES=1440
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
GEMINI_API_KEY=
```

### Frontend (set on Vercel)
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
- `users` — `{ id, email, name, password_hash, role, status }`
- `enquiries` — `{ id, founder_id, product, status, ... }`
- `allocations` — `{ id, enquiry_id, member_id, cost_to_admin, payout_to_member, admin_workflow, member_response }`
- `ragers` — `{ id, name, email, phone, photo_url, title, company, bio, expertise[], categories[], location, linkedin, is_public, table_types[], availability }`
- `content` — CMS blocks `{ page, sections: {...} }` — auto-seeded on startup
- `reports` — Chatham House reports `{ id, title, period, summary, themes[], data_points[], notes, is_public, created_at, created_by }`

## Key File Locations
```
backend/app/
  main.py          — FastAPI app, CORS, auto-seed content on startup
  core/
    auth.py        — JWT, bcrypt, get_current_user, require_admin
    db.py          — MongoDB client singleton
  api/
    auth.py        — /auth/login, /auth/signup, /auth/me
    admin.py       — /admin/* + /public/reports + analytics + Chatham House reports
    member.py      — /member/* endpoints
    seed.py        — /seed/admin (bootstrap admin@rage.com / admin123)
    content.py     — /admin/content, /public/content/{page} (auto-detects legacy format)
    ragers.py      — /admin/ragers, /public/ragers (strips email+phone)

frontend/src/
  App.js           — all routes
  components/
    PublicLayout.js  — public nav/footer (logo h-12)
    AdminLayout.js   — admin sidebar nav
  contexts/
    AuthContext.js   — user state, login/signup/logout
  lib/
    api.js           — axios + auth interceptors (401 → /member-login)
  hooks/
    useSiteContent.js — fetches /public/content/{page}, merges with defaults
  pages/
    LandingPage.js, AboutPage.js, ClosedTablePage.js, PrivateTablePage.js
    SundayTablePage.js, NetworkPage.js, ContactPage.js, PrivacyPage.js
    InsightsPage.js  — public Chatham House reports at /insights
    LoginPage.js     — member login/signup
    admin/
      AdminLoginPage.js
      AdminDashboard.js
      AdminContentEditor.js  — CMS with add/remove array items, Re-seed button
      AdminRagersPage.js     — add/edit/delete Ragers (phone private)
      AdminAnalyticsPage.js  — platform stats + Chatham House report builder
      MatchingPanel.js       — (legacy, needs rebuild)
```

## Admin Panel Routes
| Path | Page |
|------|------|
| /admin | Dashboard + stats |
| /admin/content | CMS editor (Re-seed button top-right) |
| /admin/ragers | Add/edit/delete Ragers |
| /admin/analytics | Platform stats + publish/email/AI reports |

## Content System
- Pages: `brand`, `landing`, `about`, `closed_table`, `private_table`, `sunday_table`, `network`, `contact`, `legal`
- **Auto-seeded on every Railway deploy** — no manual seeding needed
- Legacy flat format (e.g. `hero_title`) auto-detected and replaced with DEFAULT_CONTENT
- Frontend uses `useSiteContent(pageName, defaults)` — merges DB content over local defaults
- Admin can Re-seed via button in /admin/content (top-right toolbar)

## Reports / Analytics
- Chatham House reports stored in `reports` collection
- `is_public: true` → appears at `/insights` on public site
- Email via Resend (`POST /admin/reports/{id}/email`)
- AI generation from transcript via Gemini (`POST /admin/reports/generate`)

## Important Notes
- CORS_ORIGINS must be comma-separated (main.py splits on comma)
- All MongoDB documents use `id` (UUID string), NOT `_id`
- Admin bootstrap: `POST /api/seed/admin` creates admin@rage.com / admin123
- Login pages use `Navigate` component (not useEffect) for redirect — avoids flash
- `operations.py` is dead code — safe to delete
- Rager phone/email never exposed on public API (`/public/ragers` strips them)
- MatchingPanel.js uses hardcoded URL — needs rebuild with proper api.js

## Build Roadmap
1. ✅ Authentication (bcrypt, JWT, protected routes, signup)
2. ✅ Public website pages (all 6 + insights)
3. ✅ Admin CMS with content editor
4. ✅ Rager management system
5. ✅ Analytics + Chatham House reports (publish, email, AI)
6. ⬜ Matching panel rebuild (currently broken placeholder)
7. ⬜ Enquiry form → founder flow
8. ⬜ Payment flow via Razorpay
9. ⬜ SEO (meta tags, Open Graph, sitemap)
