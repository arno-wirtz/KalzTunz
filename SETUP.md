# KalzTunz — Setup Guide

## Quick Start (Local Dev)

```bash
# 1. Clone / unzip project
cd kalztunz

# 2. Backend deps
pip install --only-binary=scipy -r requirements.txt

# 3. Copy and edit env
cp .env.example .env
# edit .env — set SECRET_KEY, DB credentials, Spotify keys

# 4. Run database migrations
alembic upgrade head

# 5. Build React frontend (outputs to ./dist — served by FastAPI)
cd frontend && npm install && npm run build && cd ..

# 6. Start (single command — serves everything on port 8000)
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Visit http://localhost:8000
```

## Development Mode (hot reload)

```bash
# Terminal 1 — FastAPI backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Vite dev server (proxies /api to :8000)
cd frontend && npm run dev

# Visit http://localhost:5173 (dev) or http://localhost:8000 (production build)
```

## Docker (single container)

```bash
docker-compose up --build
# App available at http://localhost:8000
```

## Deploy to Render (single service)

1. Push to GitHub
2. In Render dashboard → New Web Service → connect repo
3. Build command: `pip install --only-binary=scipy -r requirements.txt && cd frontend && npm ci && npm run build && cd ..`
4. Start command: `gunicorn -w 2 -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:$PORT`
5. Add environment variables from the table below
6. Add a PostgreSQL database → copy connection string to `DATABASE_URL`
7. Add a Redis instance → copy URL to `REDIS_URL`

### Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing key (32+ chars) | `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `REDIS_URL` | Redis URL for job queue | `redis://:pass@host:6379/0` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `kalztunz.onrender.com,*.onrender.com` |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | From Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | From Spotify Developer Dashboard |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | From GitHub Developer Settings |

## APIs You Should Integrate

### Already Integrated
- ✅ **Spotify Web API** — track search, artist lookup, 30s previews (Client Credentials)
- ✅ **librosa** — audio feature extraction, chroma, BPM, key detection

### Recommended Next Integrations

| API | Purpose | Free Tier |
|---|---|---|
| **Cloudinary** | Avatar image upload, resize, CDN delivery | 25 GB storage free |
| **SendGrid** | Transactional email (verify accounts, password reset) | 100 emails/day free |
| **Sentry** | Error tracking for frontend + backend | 5k errors/month free |
| **Last.fm** | Artist biography, similar artists, scrobbling | Free |
| **Musixmatch** | Lyrics display for Spotify tracks | 2k calls/day free |
| **Stripe** | Premium subscription payments | Pay-per-transaction |
| **Anthropic Claude API** | AI chord explanations, lyric hints, theory Q&A | Pay-per-token |
| **Pusher / Ably** | Real-time collaboration, live chord sync | Free tier available |

### Cloudinary Setup (avatar upload)
```python
# pip install cloudinary
import cloudinary, cloudinary.uploader
cloudinary.config(cloud_name="...", api_key="...", api_secret="...")
result = cloudinary.uploader.upload(file_data, folder="kalztunz/avatars",
    transformation=[{"width":200,"height":200,"crop":"fill","gravity":"face"}])
url = result["secure_url"]
```

### Anthropic Claude API (in-app AI)
```javascript
// Already wired via the Anthropic API in artifacts capability
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: `Explain the chord progression: ${progression}` }]
  })
})
```
