# Deploy PoleTransMonitor on Heroku + Vercel (with real-time WebSockets)

This project uses **Django REST** for HTTP and **Django Channels** over **WebSockets** for live readings (`/ws/monitor/<id>/`). Real-time monitoring only works if:

1. The API process is **ASGI** (e.g. **Daphne**), not plain `runserver` / WSGI-only.
2. **Redis** is configured (`CHANNEL_LAYERS` → `channels_redis`) so broadcasts reach connected browsers.
3. The frontend uses **`wss://`** (secure WebSocket) pointing at the **same backend host** as the API.

**Heroku** can run the backend + Redis + Postgres; **Vercel** hosts the static Vite build. The browser talks to Heroku for both REST and WebSockets.

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
       └─ Postgres (database)   ← use instead of SQLite on Heroku
```

---

## Part 1 — Backend on Heroku

### 1.1 Why not SQLite on Heroku?

Heroku’s filesystem is **ephemeral**. SQLite would be wiped on dyno restart. Use **Heroku Postgres** and point Django at `DATABASE_URL`.

### 1.2 Dependencies for Postgres (one-time code change)

Add to `backend/requirements.txt` (versions can be adjusted):

```text
dj-database-url>=2.1
psycopg2-binary>=2.9
```

In `backend/config/settings.py`, **replace** the current `DATABASES = { ... sqlite ... }` block with something like:

```python
import dj_database_url

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}
```

- Locally, without `DATABASE_URL`, you keep **SQLite**.
- On Heroku, set `DATABASE_URL` automatically via the Postgres add-on; Django uses **Postgres**.

Run migrations against Postgres after deploy (see below).

### 1.3 Redis add-on (required for WebSockets)

The app already reads **`REDIS_URL`** for `CHANNEL_LAYERS` in `settings.py`. On Heroku:

1. Add **Heroku Redis** (or another Redis add-on) to the app.
2. Ensure **`REDIS_URL`** is set (Heroku usually sets this for you).

If your add-on provides **`rediss://`** (TLS), newer `channels-redis` / `redis` clients often work with that URL directly. If you hit SSL errors, check the add-on docs and `channels-redis` TLS options.

### 1.4 `Procfile` (ASGI on `$PORT`)

Create **`backend/Procfile`** (no extension):

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

```bash
# Heroku CLI: logs
heroku logs --tail -a your-app-name

# Run Django shell on Heroku
heroku run python manage.py shell -a your-app-name

# Local sanity: same as README — Redis + Daphne
cd backend && daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

## Limitations & alternatives

- **Heroku free tier** is limited/discontinued in many accounts; use Eco/Standard dynos as appropriate.
- **Cold starts** on low-tier dynos can delay first request.
- If you outgrow a single dyno, research **Channels + Redis** scaling (multiple workers / multiple dynos sharing one Redis layer).

For **only** static hosting with WebSockets elsewhere, any host that supports **long-lived TCP** and **ASGI** (Fly.io, Railway, Render, a VPS with Daphne/Nginx) can replace Heroku; the same **`wss://` + Redis + Postgres** rules apply.
