# Phase 5 Context: Railway Deploy & Smoke Test

## Phase Goal

Get the app live on a public Railway URL with ADMIN_TOKEN secured and WebSocket connection verified — ready for multi-device testing in Phase 6.

## Decisions

### Deploy Method
**GitHub integration** — Connect the repo to Railway so every `git push` to main triggers an automatic redeploy.

Why: Phase 7 involves bug fixes. GitHub integration means push-to-fix, no manual `railway up` steps between iterations.

### ADMIN_TOKEN Strategy
**Generate a random token** in the plan and display it clearly for the user to copy.

The plan should:
1. Generate a secure random string (e.g., `openssl rand -hex 16` or similar)
2. Include step-by-step instructions for setting it in Railway dashboard using the Raw Editor (avoids trailing whitespace bugs)
3. Provide the full bookmark URL: `https://<railway-domain>/admin?token=<generated-token>`

The user will save this as a browser bookmark on their PC for the event.

### Smoke Test Bar
**Minimal verification** — Phase 5 is done when:
1. `GET /health` returns HTTP 200 in production
2. Network DevTools shows a `101 Switching Protocols` response for the WebSocket connection (not just the health check)
3. Admin URL loads the dashboard with the correct token; returns 401 with wrong/missing token

Full multi-device join testing is Phase 6. Phase 5 just proves the infra is live and healthy.

## Known Facts (from research — no code changes needed)

- **wss://** — Already handled in `src/lib/socket.ts:183` via `window.location.protocol` check. No change needed.
- **Bun hostname** — `Bun.serve()` defaults to `0.0.0.0`. No `hostname` override needed.
- **PORT** — Server reads `process.env.PORT ?? 3000`. Railway injects PORT at runtime. No change needed.
- **Heartbeat** — 30s server heartbeat (server/index.ts) is sufficient for Railway's 60s idle timeout.
- **Health check** — `GET /health` is already implemented. `railway.toml` already points to it.

## Railway Dashboard Setup Steps (for planner to include in plan)

1. Create new Railway project (web UI or `railway init`)
2. Connect GitHub repo (Deploy → GitHub → select repo → select branch: `main`)
3. Set `ADMIN_TOKEN` env var via Raw Editor (avoids trailing whitespace from regular input)
4. Trigger first deploy (Railway auto-deploys on connection, or click Deploy)
5. Generate public domain (Service → Settings → Networking → Generate Domain)
6. Verify Railway logs show: `Admin token: ***` (masked, not `(not set)`)

## Canonical Refs

- `server/index.ts` — Bun.serve config, health check, heartbeat
- `railway.toml` — healthcheckPath, Dockerfile builder config
- `Dockerfile` — multi-stage build, CMD entry point
- `src/lib/socket.ts` — WebSocket URL construction (wss:// handling at line 183)
- `.planning/research/PITFALLS.md` — Deployment pitfalls (ADMIN_TOKEN trailing whitespace, health check false confidence)
- `.planning/research/STACK.md` — Railway CLI commands, env var setup instructions

## Deferred Ideas

- Custom domain (Railway `*.up.railway.app` CDN idle timeout risk accepted for now)
- `drainingSeconds` in railway.toml for graceful redeploys
- `visibilitychange` iOS screen lock recovery (scoped to Phase 7)
