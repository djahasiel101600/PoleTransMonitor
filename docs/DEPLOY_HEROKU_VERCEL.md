# Deploy PoleTransMonitor on Heroku + Vercel (with real-time WebSockets)

This project uses **Django REST** for HTTP and **Django Channels** over **WebSockets** for live readings (`/ws/monitor/<id>/`). Real-time monitoring only works if:

1. The API process is **ASGI** (e.g. **Daphne**), not plain `runserver` / WSGI-only.
2. **Redis** is configured (`CHANNEL_LAYERS` → `channels_redis`) so broadcasts reach connected browsers.
3. The frontend uses **`wss://`** (secure WebSocket) pointing at the **same backend host** as the API.

**Heroku** can run the backend + Redis + Postgres; **Vercel** hosts the static Vite build. The browser talks to Heroku for both REST and WebSockets.

### Fresh deploy (no SQLite / no data to move)

You don’t need to migrate anything from SQLite—Heroku Postgres starts **empty**; the **release** phase runs `migrate` and creates tables.

**Heroku (backend)** — in Dashboard or CLI:

1. New app → connect repo → set **Root Directory** to `backend`.
2. Add-ons: **Heroku Postgres** + **Heroku Redis** (or equivalent). `DATABASE_URL` and `REDIS_URL` are set for you.
3. **Config Vars:** `SECRET_KEY` (long random string), `DEBUG=False`, `ALLOWED_HOSTS=your-app.herokuapp.com`, `CORS_ORIGINS=https://your-app.vercel.app` (your real Vercel URL).
4. Deploy. Then once: `heroku run python manage.py createsuperuser -a your-app-name`.

**Vercel (frontend):** Root `frontend`, build `npm run build`, output `dist`. Set `VITE_API_URL=https://your-app.herokuapp.com/api` and `VITE_WS_URL=wss://your-app.herokuapp.com`, then redeploy.

---

## Architecture (production)

```
Browser (Vercel)
  ├─ HTTPS  → Heroku  REST API  (/api/...)
  └─ WSS    → Heroku  WebSocket  (/ws/monitor/<id>/)

ESP32 / devices
  └─ HTTPS  → Heroku  REST API  (readings, device config, etc.)

Heroku dyno
  └─ Daphne (ASGI) + Django + Channels
       └─ Redis (channel layer)  ← required for WS fan-out
       └─ Postgres (database)   ← required (`DATABASE_URL`)
```

---

## Part 1 — Backend on Heroku

### 1.1 Database

The backend uses **PostgreSQL only** via **`DATABASE_URL`**. Heroku’s Postgres add-on sets this automatically. (SQLite is not supported.)

### 1.2 Postgres + static files (already in the repo)

The backend is prepped for Heroku:

- **`requirements.txt`**: includes `dj-database-url`, `psycopg2-binary`, and **`whitenoise`** (serves Django admin static files in production).
- **`config/settings.py`**: requires **`DATABASE_URL`** (PostgreSQL); parses it with `dj_database_url.parse(...)`.
- **`Procfile`**: `web` runs **Daphne**; `release` runs **migrations**.
- **`runtime.txt`**: Python version for Heroku.
- **`.slugignore`**: excludes `.env` and dev cruft from the slug.

Run migrations on each deploy via the **release** phase (see `Procfile`).

### 1.3 Redis add-on (required for WebSockets)

The app already reads **`REDIS_URL`** for `CHANNEL_LAYERS` in `settings.py`. On Heroku:

1. Add **Heroku Redis** (or another Redis add-on) to the app.
2. Ensure **`REDIS_URL`** is set (Heroku usually sets this for you).

If your add-on provides **`rediss://`** (TLS), newer `channels-redis` / `redis` clients often work with that URL directly. If you hit SSL errors, check the add-on docs and `channels-redis` TLS options.

### 1.4 `Procfile` (ASGI on `$PORT`)

**`backend/Procfile`** is already committed:

```procfile
web: daphne -b 0.0.0.0 -p $PORT config.asgi:application
release: python manage.py migrate --noinput
```

- **`web`**: serves HTTP **and** WebSocket upgrades on one process (Daphne).
- **`release`**: runs migrations on each deploy (Heroku release phase).

### 1.5 Environment variables (Heroku Config Vars)

| Variable | Example / notes |
|----------|------------------|
| `SECRET_KEY` | Long random string; **never** commit. |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `your-app.herokuapp.com` (comma-separated if multiple). |
| `CORS_ORIGINS` | Your Vercel site(s), e.g. `https://your-app.vercel.app` (no trailing slash). |
| `REDIS_URL` | From Redis add-on (often auto-set). |
| `DATABASE_URL` | From Postgres add-on (often auto-set). |

Optional: if you use a **custom domain** on Heroku, add it to `ALLOWED_HOSTS` and use that domain in the frontend env vars below.

### 1.6 Monorepo: deploy only `backend/`

In the Heroku app **Settings → Buildpacks**, use the official **Python** buildpack.

Set **Root Directory** to `backend` (Heroku Dashboard → Deploy / General, depending on UI):

- So `requirements.txt`, `manage.py`, and `Procfile` are found under `backend/`.

Alternatively, deploy from a branch/folder that only contains the backend; the important part is that **`requirements.txt` and `Procfile` live in the directory Heroku builds**.

### 1.7 Create superuser (once)

```bash
heroku run python manage.py createsuperuser -a your-app-name
```

### 1.8 Verify WebSockets on Heroku

- Heroku’s router supports **WebSocket** upgrades to your `web` dyno.
- Use **one** Daphne process per dyno for typical loads; scale out only if you understand Channels + Redis multi-dyno behavior (sticky sessions are not required for this setup if all dynos share the same Redis channel layer).

---

## Part 2 — Frontend on Vercel

### 2.1 Build settings

| Setting | Value |
|--------|--------|
| **Root Directory** | `frontend` |
| **Framework** | Vite (or “Other” with the commands below) |
| **Build command** | `npm run build` |
| **Output directory** | `dist` |

### 2.2 Environment variables (Vercel)

Set **Production** (and Preview if you want) variables to match your **Heroku** URL:

| Variable | Production example |
|----------|---------------------|
| `VITE_API_URL` | `https://your-app.herokuapp.com/api` |
| `VITE_WS_URL` | `wss://your-app.herokuapp.com` |

**Important:**

- Use **`https`** for the REST base (`VITE_API_URL`).
- Use **`wss`** (not `ws`) for `VITE_WS_URL` so the browser allows secure WebSockets from your HTTPS Vercel page.
- **No path** on `VITE_WS_URL`: the app builds paths like `${WS_BASE}/ws/monitor/...` (see `frontend/src/hooks/useMonitorWebSocket.ts`).

Redeploy the frontend after changing these variables (Vite bakes them in at build time).

### 2.3 CORS

Your Heroku `CORS_ORIGINS` must include the exact Vercel origin, e.g.:

`https://your-project.vercel.app`

---

## Part 3 — Real-time monitoring checklist

- [ ] Heroku **`web`** process runs **Daphne** + `config.asgi:application` (not Gunicorn WSGI only).
- [ ] **Redis** add-on attached; **`REDIS_URL`** valid; `CHANNEL_LAYERS` uses Redis (already in `settings.py`).
- [ ] **Postgres** (or another persistent DB) via **`DATABASE_URL`**; migrations ran.
- [ ] Frontend **`VITE_WS_URL`** is **`wss://<same-host-as-api>`**.
- [ ] User is **logged in** (JWT); the WebSocket client sends the token in the query string as the app already does.

If live charts don’t update, check the browser **Network → WS** for failed handshakes (401 → auth; 404 → wrong URL; mixed content → use `wss` + `https`).

---

## Part 4 — Firmware / devices

Devices should call the **public HTTPS** API on Heroku, e.g.:

- Base URL in firmware / portal: `https://your-app.herokuapp.com`

Update WiFi portal or `config.h` accordingly. Ensure **`ALLOWED_HOSTS`** and **`CORS_ORIGINS`** don’t block device traffic (devices use REST, not browser CORS, for typical `POST` paths—but keep HTTPS certificate trust in mind on the ESP32 stack).

---

## Part 5 — Security hardening (recommended)

- `DEBUG=False`, strong `SECRET_KEY`.
- Restrict `ALLOWED_HOSTS` to real hostnames.
- Use **HTTPS** everywhere (Heroku and Vercel provide this).
- Rotate JWT / device keys per your ops policy; review `docs/DEVICE_CONFIG_SYNC.md` if you use device API keys.

---

## Quick reference commands

### Heroku CLI (after [installing the CLI](https://devcenter.heroku.com/articles/heroku-cli))

Replace `YOUR_APP` and URLs with your real names. **Monorepo:** in the Heroku app **Settings**, set **Root Directory** to `backend` (required for GitHub deploys). If you deploy with **`git push heroku`**, push from a setup where the **project root is `backend/`**, or use GitHub integration instead.

```bash
heroku login

# Create app (region optional)
heroku create YOUR_APP

# Datastores (plan slugs change over time — pick an available Postgres + Redis tier in your account)
heroku addons:create heroku-postgresql:essential-0 -a YOUR_APP
heroku addons:create heroku-redis:mini -a YOUR_APP

# App settings (generate your own SECRET_KEY; example uses Python)
heroku config:set DEBUG=False -a YOUR_APP
heroku config:set SECRET_KEY="paste-a-long-random-string" -a YOUR_APP
heroku config:set ALLOWED_HOSTS=YOUR_APP.herokuapp.com -a YOUR_APP
heroku config:set CORS_ORIGINS=https://YOUR_PROJECT.vercel.app -a YOUR_APP

# Postgres/Redis URLs are usually set automatically by the add-ons — don’t overwrite unless you know why.

# After a successful deploy (release phase runs migrations)
heroku run python manage.py createsuperuser -a YOUR_APP

# Operate
heroku logs --tail -a YOUR_APP
heroku run python manage.py shell -a YOUR_APP
heroku ps -a YOUR_APP
```

Open the app: `heroku open -a YOUR_APP` (API root may 404 unless you added a route — try `/api/` or `/admin/`).

### Vercel CLI (optional; Dashboard works too)

```bash
npm i -g vercel
cd frontend
vercel login
vercel link    # follow prompts, set root to this folder if needed
# Production env (Vite reads these at build time)
vercel env add VITE_API_URL production      # e.g. https://YOUR_APP.herokuapp.com/api
vercel env add VITE_WS_URL production       # e.g. wss://YOUR_APP.herokuapp.com
vercel --prod
```

Or set **VITE_API_URL** / **VITE_WS_URL** under Project → Settings → Environment Variables in the Vercel Dashboard, then **Redeploy**.

### Local sanity (not Heroku)

```bash
# From repo root, with Redis running and DATABASE_URL in backend/.env
cd backend && daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

## Limitations & alternatives

- **Heroku free tier** is limited/discontinued in many accounts; use Eco/Standard dynos as appropriate.
- **Cold starts** on low-tier dynos can delay first request.
- If you outgrow a single dyno, research **Channels + Redis** scaling (multiple workers / multiple dynos sharing one Redis layer).

For **only** static hosting with WebSockets elsewhere, any host that supports **long-lived TCP** and **ASGI** (Fly.io, Railway, Render, a VPS with Daphne/Nginx) can replace Heroku; the same **`wss://` + Redis + Postgres** rules apply.
