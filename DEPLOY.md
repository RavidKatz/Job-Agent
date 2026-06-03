# Deploying Job Agent (always-on web)

This app runs as a Docker container: a Node.js server plus a Python resume
extractor. It is built to deploy on a cloud platform connected to GitHub, so
every push redeploys automatically.

Files that make this work:
- `Dockerfile` — Node 20 + Python venv (`pypdf`, `python-docx`) + the app.
- `.dockerignore` — keeps local data and scratch files out of the image.
- `render.yaml` — one-click Blueprint for Render (disk + env + health check).

## Before you start

1. Push this repository to GitHub (the project already tracks `origin/main`):
   ```
   git push origin main
   ```
2. Decide on persistence and cost:
   - Accounts and saved applications live in `data/app-db.json`.
   - A **persistent disk** is needed so that file survives restarts/deploys.
   - An **always-on** instance (no idle sleep) and a disk require a paid plan
     on most platforms (typically a few USD/month).

## Option A — Render (recommended, uses `render.yaml`)

1. Create an account at https://render.com and connect your GitHub.
2. New → **Blueprint** → pick this repository. Render reads `render.yaml` and
   creates a Docker web service named `job-agent` with:
   - `HOST=0.0.0.0` and `PYTHON_EXE=/opt/venv/bin/python3`
   - a 1 GB disk mounted at `/app/data` (keeps the database)
   - health check at `/api/health`
3. Click **Apply** / **Deploy**. Render builds the Dockerfile and starts it.
4. Render assigns an HTTPS URL like `https://job-agent.onrender.com`. `PORT` and
   HTTPS are provided automatically — no code change needed.

Free vs paid on Render:
- Free web services **sleep when idle** and **cannot use a disk** (data is lost
  on restart). For truly always-on with saved data, use a paid instance
  (`plan: starter` in `render.yaml`).

## Option B — Railway

1. https://railway.app → New Project → Deploy from GitHub repo.
2. Railway detects the `Dockerfile`. Add a **Volume** mounted at `/app/data`.
3. Set variables `HOST=0.0.0.0` and `PYTHON_EXE=/opt/venv/bin/python3`.
4. Deploy. Railway gives an HTTPS domain.

## Option C — Fly.io

1. Install `flyctl`, run `fly launch` (it detects the `Dockerfile`).
2. Create a volume: `fly volumes create data --size 1`, mount it at `/app/data`.
3. Set secrets/env `HOST=0.0.0.0` and `PYTHON_EXE=/opt/venv/bin/python3`.
4. `fly deploy`.

## Verify the deployment

- Open the platform URL — the scan page should load.
- Health check: `https://<your-url>/api/health` returns `{"ok":true}`.
- Upload a CV and run a scan to confirm the Python extractor works in the
  container.

## Test the container locally (optional)

Requires Docker Desktop:
```
docker build -t job-agent .
docker run --rm -p 4317:4317 -e HOST=0.0.0.0 job-agent
```
Then open http://127.0.0.1:4317 .

## What I cannot do for you

For security reasons I cannot create the hosting account, enter payment
details, or click deploy on your behalf. Follow the steps above to do those
parts; I prepared all the configuration.

## Recommended hardening before public use

The app is currently a private-beta build. Before sharing publicly, consider:
- Marking the session cookie `Secure` (it is served over HTTPS in production).
- Moving accounts/applications from `data/app-db.json` to a managed database.
- Rate limiting and stricter upload validation.

These are follow-up changes and are intentionally not included here.
