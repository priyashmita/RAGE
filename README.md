# R.A.G.E. — Radical Alliance for Gender Equity

Full-stack platform: React frontend + FastAPI backend + MongoDB.

## Prerequisites

- Python 3.11+
- Node 18+ and yarn
- MongoDB (local or Atlas)

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Then edit .env with your values
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
cp .env.example .env            # Then edit .env with your backend URL
yarn start
```

### Open

```
http://localhost:3000
Admin login: admin@rage.com / admin123
```

## Environment Variables

### Backend (.env)

| Variable | Required | Description |
|---|---|---|
| MONGO_URL | Yes | MongoDB connection string |
| DB_NAME | Yes | Database name |
| CORS_ORIGINS | Yes | Comma-separated allowed origins |
| JWT_SECRET | Yes | Strong random string for JWT signing |
| RAZORPAY_KEY_ID | No | Razorpay public key (leave empty to disable) |
| RAZORPAY_KEY_SECRET | No | Razorpay secret key |

### Frontend (.env)

| Variable | Required | Description |
|---|---|---|
| REACT_APP_BACKEND_URL | Yes | Backend API base URL |

## Production Deployment

### Frontend → Vercel
- Build: `yarn build`
- Output: `build/`
- Set `REACT_APP_BACKEND_URL` to your production backend URL

### Backend → Render / Railway / Any server
- Start: `uvicorn server:app --host 0.0.0.0 --port 8001`
- Set all env variables listed above
- MongoDB Atlas recommended for production

## Auto-Seeded Data

On first startup:
- Admin user created: `admin@rage.com` / `admin123`
- 8 pages of CMS content seeded from `content_seed.py`
- Database indexes created automatically
- All MongoDB collections auto-create on first write

## Important Notes

- **RAGE logo**: The logo image URL points to a CDN. Replace `LOGO_URL` in `Layout.js`, `PublicLayout.js`, and `LoginPage.js` with your own hosted image path.
- **JWT_SECRET**: Must be changed from default before production use.
- **Admin password**: Change immediately after first login.
- **Razorpay**: Bank transfer is active by default. Online payment activates when Razorpay keys are set.
