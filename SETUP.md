# KalzTunz — Local Setup Guide

> **Where do I work from?  The project root: `kalztunz/`**
> All terminal commands in this guide are run from that folder unless a step says otherwise.

---

## Table of Contents

1. [Project layout explained](#1-project-layout-explained)
2. [Prerequisites](#2-prerequisites)
3. [Quick-start (recommended — Docker)](#3-quick-start-recommended--docker)
4. [Manual local setup (no Docker)](#4-manual-local-setup-no-docker)
   - 4a. [Backend](#4a-backend-python--fastapi)
   - 4b. [Frontend](#4b-frontend-react--vite)
   - 4c. [Database](#4c-database-postgresql)
   - 4d. [Redis + Worker](#4d-redis--rq-worker)
5. [Environment variables](#5-environment-variables)
6. [Spotify setup (needed for Discover page)](#6-spotify-setup-needed-for-discover-page)
7. [Running everything together](#7-running-everything-together)
8. [Where to edit what](#8-where-to-edit-what)
9. [Common commands](#9-common-commands)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Project layout explained

```
kalztunz/                   ← PROJECT ROOT — work from here
│
├── main.py                 ← Python entry point alias (imports app.py)
├── app.py                  ← FastAPI application — ALL backend routes live here
├── tasks.py                ← RQ background tasks (chord extraction, pipeline)
├── worker.py               ← RQ worker process entry point
│
├── backend/                ← Python package — supporting modules only
│   ├── __init__.py
│   ├── auth.py             ← JWT + Google/GitHub OAuth2 routes
│   ├── models.py           ← SQLAlchemy ORM models (all 8 tables)
│   ├── database.py         ← DB engine, session, Base
│   ├── spotify.py          ← Spotify API proxy routes
│   ├── security.py         ← CORS, rate limiting, trusted hosts
│   ├── analytics.py        ← Usage metrics helpers
│   ├── cache.py            ← Redis caching helpers
│   ├── social.py           ← Follow/like/notify helpers
│   ├── social_api.py       ← Social feature routes
│   ├── validators.py       ← File upload validators
│   ├── password_strength.py
│   ├── performance.py
│   ├── logging_config.py
│   └── emailer_enhanced.py
│
├── alembic/                ← Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py   ← Creates all tables
│
├── frontend/               ← React + Vite app
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js      ← Dev proxy: /api → http://localhost:8000
│   └── src/
│       ├── main.jsx        ← React entry point
│       ├── App.jsx         ← Router, AuthContext, Nav, ThemeProvider
│       ├── App.css         ← Full design system (Playfair + Space Grotesk)
│       ├── ThemeContext.jsx
│       ├── hooks/
│       │   └── useSpotify.js
│       └── pages/
│           ├── Home.jsx
│           ├── Search.jsx
│           ├── Extraction.jsx
│           ├── Generate.jsx
│           ├── Library.jsx
│           ├── Settings.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Tutorial.jsx
│           └── AuthCallback.jsx
│
├── alembic.ini             ← Alembic config (reads DATABASE_URL from env)
├── requirements.txt        ← Python dependencies
├── .env.example            ← Copy this to .env and fill in values
├── Dockerfile              ← Multi-stage: builds frontend + runs backend
├── worker.Dockerfile       ← Separate container for the RQ worker
├── docker-compose.yml      ← Orchestrates all services (if you have it)
├── deploy.sh               ← Production deployment script
├── monitoring/             ← Prometheus + Grafana + Nginx configs
├── scripts/
│   └── init_db.sql         ← PostgreSQL extensions (uuid-ossp, pg_trgm)
└── uploads/                ← User-uploaded audio files (git-ignored)
```

### Why `app.py` and not `main.py`?

`uvicorn` and Docker both use `uvicorn app:app` — meaning "the `app` object inside `app.py`".
Renaming the file to `main.py` would break the Dockerfile and all deployment scripts.
`main.py` now exists as an **alias** — it imports from `app.py` and adds a `if __name__ == "__main__"` block so you can run `python main.py` locally if you prefer.

### Why `tasks.py` and `worker.py` at root (not inside `backend/`)?

- `tasks.py` — RQ enqueues jobs using **string references** like `"tasks.process_pipeline"`.
  Python resolves this relative to `sys.path`, which starts at the project root.
  Moving it inside `backend/` would make the string `"backend.tasks.process_pipeline"` and
  require updating every `q.enqueue()` call in `app.py`.

- `worker.py` — The Docker CMD is `python worker.py`. It must be at root.

**Rule:** `backend/` holds *support modules* that `app.py` imports.
`app.py`, `tasks.py`, `worker.py`, and `main.py` stay at root.

---

## 2. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) |
| Redis | 7+ | [redis.io](https://redis.io) |
| ffmpeg | any | `brew install ffmpeg` / `apt install ffmpeg` |
| Git | any | [git-scm.com](https://git-scm.com) |

Optional but recommended:
- **Docker Desktop** — lets you skip PostgreSQL + Redis installs entirely

---

## 3. Quick-start (recommended — Docker)

If you have Docker Desktop installed this is the fastest path:

```bash
# 1. Clone / extract the project
cd kalztunz

# 2. Copy the env file and fill in Spotify credentials (see step 6)
cp .env.example .env
# Edit .env — at minimum set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET

# 3. Start everything
docker compose up --build
```

This starts:

| Service | URL |
|---------|-----|
| Frontend (Vite dev or built) | http://localhost:5173 |
| FastAPI backend | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Grafana monitoring | http://localhost:3001 |

> **Note:** if you don't have `docker-compose.yml`, use the manual setup below.

---

## 4. Manual local setup (no Docker)

### 4a. Backend (Python + FastAPI)

All commands from the **project root** (`kalztunz/`):

```bash
# 1. Create virtual environment
python3 -m venv venv

# 2. Activate it
#    macOS / Linux:
source venv/bin/activate
#    Windows (cmd):
venv\Scripts\activate.bat
#    Windows (PowerShell):
venv\Scripts\Activate.ps1

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install PyTorch (CPU only — required for audio ML)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# 5. Copy env and configure
cp .env.example .env
# Open .env in your editor — see Section 5 for what to fill in

# 6. Run the dev server  (two equivalent ways)
uvicorn app:app --reload --port 8000
# OR
python main.py
```

The API is now at **http://localhost:8000**
Interactive docs: **http://localhost:8000/docs**

### 4b. Frontend (React + Vite)

Open a **second terminal**, from the project root:

```bash
cd frontend
npm install
npm run dev
```

The React app is now at **http://localhost:5173**

Vite is configured to proxy all `/api/*` requests to `http://localhost:8000`
so the frontend and backend communicate automatically during development.

### 4c. Database (PostgreSQL)

```bash
# If PostgreSQL is running locally, create the database:
psql -U postgres -c "CREATE USER kalztunz_user WITH PASSWORD 'secure_password';"
psql -U postgres -c "CREATE DATABASE kalztunz OWNER kalztunz_user;"
psql -U postgres -d kalztunz -f scripts/init_db.sql   # enables extensions

# Then run Alembic migrations (from project root, venv active):
alembic upgrade head
```

Your `.env` `DATABASE_URL` should match the credentials above:
```
DATABASE_URL=postgresql://kalztunz_user:secure_password@localhost:5432/kalztunz
```

### 4d. Redis + RQ Worker

Redis must be running for chord extraction to work (it queues jobs):

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu / Debian
sudo apt install redis-server && sudo systemctl start redis

# Windows — use WSL2 or the official Redis for Windows
```

Then in a **third terminal** (from project root, venv active):

```bash
python worker.py
```

The worker listens for extraction jobs and processes them in the background.

> **Without Redis/worker:** The app still runs and all pages load.
> The demo endpoints (`/api/demo/chords`, `/api/demo/generate`) work without Redis.
> Only actual file uploads to `/api/extract-chords` require the worker.

---

## 5. Environment variables

Copy `.env.example` to `.env` and set these values:

```bash
cp .env.example .env
```

### Required to start

```ini
# Database
DATABASE_URL=postgresql://kalztunz_user:YOUR_PASSWORD@localhost:5432/kalztunz
DB_PASSWORD=YOUR_PASSWORD

# Redis
REDIS_URL=redis://localhost:6379/0

# App security (generate with: openssl rand -hex 32)
SECRET_KEY=generate_a_random_64_char_hex_string_here

ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

### Required for Spotify (Discover page)

```ini
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

See [Section 6](#6-spotify-setup-needed-for-discover-page) for how to get these.

### Optional (OAuth login)

```ini
# Google OAuth — from console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth — from github.com/settings/developers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### Generate a SECRET_KEY

```bash
# macOS / Linux
openssl rand -hex 32

# Python (any OS)
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 6. Spotify setup (needed for Discover page)

The Discover/Search page is powered by Spotify's Web API. The credentials are **free**:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Log in with any Spotify account (free tier is fine)
3. Click **"Create app"**
4. Fill in:
   - App name: `KalzTunz`
   - Redirect URI: `http://localhost:8000/api/auth/spotify/callback`
   - APIs used: check **"Web API"**
5. Copy **Client ID** and **Client Secret** into your `.env`

```ini
SPOTIFY_CLIENT_ID=abc123...
SPOTIFY_CLIENT_SECRET=xyz789...
```

KalzTunz uses **Client Credentials flow** — no user login to Spotify is needed.
The credentials never reach the browser; the backend proxies all Spotify calls.

---

## 7. Running everything together

You need **four processes** running at the same time.
Use four terminal tabs/panes (or a tool like `tmux` or `foreman`):

```
Terminal 1 — Backend API
  cd kalztunz
  source venv/bin/activate
  uvicorn app:app --reload --port 8000

Terminal 2 — Frontend
  cd kalztunz/frontend
  npm run dev

Terminal 3 — Redis worker
  cd kalztunz
  source venv/bin/activate
  python worker.py

Terminal 4 — (optional) PostgreSQL / Redis logs
  redis-cli monitor     ← watch Redis job queue in real-time
```

Or use the `Procfile` shortcut if you have [Honcho](https://honcho.readthedocs.io/)
or [Foreman](https://github.com/nicowillis/foreman) installed:

```bash
# Install honcho (Python foreman clone)
pip install honcho

# Create Procfile (one-time)
cat > Procfile << 'EOF'
web:     uvicorn app:app --reload --port 8000
frontend: bash -c "cd frontend && npm run dev"
worker:  python worker.py
EOF

# Start everything
honcho start
```

---

## 8. Where to edit what

| What you want to change | File to edit | Location |
|------------------------|-------------|---------|
| Add/change an API route | `app.py` | root |
| Change auth logic (JWT, OAuth) | `backend/auth.py` | `backend/` |
| Change DB models/tables | `backend/models.py` then `alembic revision --autogenerate` | `backend/` |
| Change chord extraction algorithm | `tasks.py` | root |
| Change RQ worker config | `worker.py` | root |
| Change Spotify proxy logic | `backend/spotify.py` | `backend/` |
| Add email templates | `backend/emailer_enhanced.py` | `backend/` |
| Change any page UI | `frontend/src/pages/PageName.jsx` | `frontend/src/pages/` |
| Change global styles/theme | `frontend/src/App.css` | `frontend/src/` |
| Change nav / routing / auth context | `frontend/src/App.jsx` | `frontend/src/` |
| Change dark/light theme logic | `frontend/src/ThemeContext.jsx` | `frontend/src/` |
| Change Spotify hook | `frontend/src/hooks/useSpotify.js` | `frontend/src/hooks/` |
| Change DB connection | `backend/database.py` | `backend/` |
| Add a database migration | `alembic revision --autogenerate -m "description"` then `alembic upgrade head` | root |
| Change rate limits / CORS | `backend/security.py` | `backend/` |
| Change Python dependencies | `requirements.txt` | root |
| Change frontend dependencies | `frontend/package.json` | `frontend/` |
| Change Docker build | `Dockerfile` | root |
| Change deployment | `deploy.sh` | root |
| Change monitoring | `monitoring/` | `monitoring/` |

### Quick summary: **you always `cd` to root first**

```bash
cd kalztunz         # ← always start here

# Then go deeper only when working on frontend:
cd frontend
npm run dev
cd ..               # back to root when done
```

---

## 9. Common commands

```bash
# ── Backend ──────────────────────────────────────────────────

# Start dev server (auto-reloads on save)
uvicorn app:app --reload --port 8000

# Alternative using main.py
python main.py

# Check API is running
curl http://localhost:8000/health

# View all API routes
open http://localhost:8000/docs

# Run backend tests
pytest

# Format code
black . && isort .

# Lint
flake8 .

# ── Database migrations ────────────────────────────────────────

# Apply all pending migrations
alembic upgrade head

# Create a new migration after changing models.py
alembic revision --autogenerate -m "add user_preferences table"

# Check current migration status
alembic current

# Roll back one migration
alembic downgrade -1

# ── Frontend ──────────────────────────────────────────────────

# Start dev server (from frontend/ directory)
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Lint
cd frontend && npm run lint

# Preview production build
cd frontend && npm run preview

# ── Worker ───────────────────────────────────────────────────

# Start RQ worker
python worker.py

# Monitor job queue (Redis CLI)
redis-cli llen kalztunz          # pending jobs
redis-cli info memory            # Redis memory usage

# ── Docker ───────────────────────────────────────────────────

# Build and start all services
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f backend

# Stop everything
docker compose down

# Remove volumes (full reset including database)
docker compose down -v
```

---

## 10. Troubleshooting

### `ModuleNotFoundError: No module named 'backend'`

You are running Python from the wrong directory. Always run from the project root:
```bash
cd kalztunz      # ← must be here
uvicorn app:app --reload
```

### `redis.exceptions.ConnectionError`

Redis is not running. Start it:
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis
```
Or set `REDIS_URL=` to empty in `.env` — the app will run without the job queue
(only demo endpoints will work for chord extraction).

### Spotify returns empty results / 401 error

- Check that `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set in `.env`
- Verify the credentials at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
- The backend logs the Spotify token status on startup — check `uvicorn` output

### `alembic.exc.CommandError: Can't locate revision`

Run from the project root with the venv active:
```bash
source venv/bin/activate
alembic upgrade head
```

### Frontend shows blank page / CORS error

Make sure the backend is running on port 8000 and `.env` has:
```ini
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

### Port 8000 already in use

```bash
# Find what is using port 8000
lsof -i :8000         # macOS/Linux
netstat -ano | find "8000"   # Windows

# Kill it (macOS/Linux)
kill -9 $(lsof -ti :8000)
```

### `librosa` / audio errors on first extract

Install ffmpeg — it is required for video-to-audio conversion and some audio formats:
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows — download from ffmpeg.org and add to PATH
```

---

## Summary

| Question | Answer |
|----------|--------|
| Where do I work from? | **`kalztunz/` root** — always |
| Where is the main Python file? | `app.py` (or `main.py` which re-exports it) |
| Where are the API routes? | `app.py` + `backend/auth.py` + `backend/spotify.py` + `backend/social_api.py` |
| Where is the DB logic? | `backend/models.py` + `backend/database.py` |
| Where are background jobs? | `tasks.py` (processed by `worker.py`) |
| Where is the React app? | `frontend/src/` |
| Where are the pages? | `frontend/src/pages/` |
| What command starts the backend? | `uvicorn app:app --reload --port 8000` |
| What command starts the frontend? | `cd frontend && npm run dev` |
| What command runs migrations? | `alembic upgrade head` |
| What command starts the worker? | `python worker.py` |
