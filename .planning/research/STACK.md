# Technology Stack: Railway Deployment

**Project:** octapp — Bachelor Party Game
**Milestone:** v1.1 Deployment & Testing
**Researched:** 2026-04-10
**Scope:** What is needed to get this specific app live on Railway. Not a re-evaluation of the stack — the stack is already validated.

---

## Current State Assessment

The existing Dockerfile and railway.toml are fundamentally correct. No major rewrites needed. The gaps are operational: env vars not yet set in the Railway dashboard, a domain not yet generated, and a few Dockerfile hardening details worth addressing.

---

## Railway CLI Setup

### Installation

```bash
brew install railway
```

Or without Homebrew:
```bash
npm i -g @railway/cli
```

### First-Deploy Workflow (one-time)

```bash
# 1. Authenticate
railway login

# 2. Create or link the project
railway init          # creates new project and links this directory
# OR
railway link          # links to an existing Railway project

# 3. Set required environment variables (see section below)
railway variable set ADMIN_TOKEN=<your-secret-token>

# 4. Deploy
railway up

# 5. Generate a public URL
# Go to: Service → Settings → Networking → Public Networking → Generate Domain
# OR via CLI:
railway domain
```

### Ongoing Deploy Workflow

```bash
# Push a new deploy
railway up

# Stream logs from the running service
railway logs

# Build logs only
railway logs --build

# Last 100 lines
railway logs -n 100

# Run a local command with Railway env vars loaded (useful for debugging)
railway run bun run server/index.ts
```

Railway also auto-deploys on every push to the linked GitHub branch if you connect the repo in the dashboard. That is the recommended workflow once the first manual deploy succeeds — set it up under Service → Settings → Source → Connect GitHub Repo.

---

## Environment Variables

### Variables to Set Manually in Railway Dashboard (or via CLI)

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_TOKEN` | A random secret string (e.g. `openssl rand -hex 16`) | Gate for `/api/admin/session`. Required — server logs "(not set)" if missing but does not crash. Without it anyone can hit the admin endpoint. |

Use Railway's **Seal** feature for `ADMIN_TOKEN`: in the Variables tab, click the three-dot menu on the variable → Seal. Sealed variables are injected at runtime but never shown in the UI or returned by the API. This is the correct approach for a secret.

### Variables Railway Injects Automatically (do not set these yourself)

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `8080` | Railway injects this at runtime for all deployment types including Docker. The server already reads `process.env.PORT ?? 3000` — this will work as-is. |
| `RAILWAY_PUBLIC_DOMAIN` | `<name>.up.railway.app` | The public hostname. Use this if you ever need to construct URLs server-side (e.g., share links). Not needed by the current server code. |
| `RAILWAY_ENVIRONMENT_NAME` | `production` | Useful for conditional logging. Not needed now. |

**Important:** `PORT` is injected at runtime, not build time. The current Dockerfile sets `ENV PORT=3000` as a default. That default will be overridden by Railway's runtime injection of `PORT=8080`. No change needed — the server uses `process.env.PORT ?? 3000`, which correctly defers to Railway's injected value.

### Variables NOT to add

- `NODE_ENV=production` — Bun does not require this to switch modes. Do not add it unless a specific library breaks without it.
- `DATABASE_URL` — No database. Ephemeral in-memory state is intentional.
- Any build-time `ARG` declarations — The server reads env vars at runtime, not build time. No `ARG` directives needed in the Dockerfile.

---

## Dockerfile Considerations

### Current Dockerfile: Status

The existing Dockerfile is production-ready. Specific notes on each decision:

**Multi-stage build (builder + runner):** Correct. The `oven/bun:1-slim` runner image excludes build tools. Keep this.

**`oven/bun:1` and `oven/bun:1-slim` tags:** These resolve to the latest Bun 1.x release. As of April 2026, Bun 1.2.x is current. The `1` tag will float forward automatically on each deploy, which is acceptable for a short-lived project. If you want reproducible builds, pin to a specific version like `oven/bun:1.2.10`. For a one-time event, floating is fine.

**`bun.lock*` (wildcard):** The asterisk handles both `bun.lock` and `bun.lockb` (the binary lockfile format). Correct.

**`--frozen-lockfile` with fallback in production stage:**
```dockerfile
RUN bun install --production --frozen-lockfile 2>/dev/null || bun install --production
```
This fallback exists because the production stage has no lockfile copied. This is fine but slightly fragile. Since `server/index.ts` has no production dependencies currently, the install step is a no-op. No change required.

**`CMD ["bun", "run", "server/index.ts"]`:** This is exec form (JSON array). Railway injects `PORT` into the runtime environment, and Bun reads `process.env.PORT` directly — no shell variable expansion needed. Exec form is correct and preferred. Do not change to shell form.

**`ENV PORT=3000`:** This is a Dockerfile default. Railway overrides it at runtime with `PORT=8080`. The healthcheck in `railway.toml` will hit port 8080, which is what Railway uses. No conflict.

### One Optional Improvement

Add `ENV NODE_ENV=production` only if a library complains. Do not add it proactively — Bun does not need it.

---

## Railway WebSocket Considerations

### TLS Termination: Handled Automatically

Railway terminates TLS at the proxy layer. Your Bun server listens on plain HTTP/WebSocket (`ws://`). External clients connect via `wss://` — Railway handles the upgrade. You do not need to configure certificates or serve TLS from within the container.

Client-side WebSocket URL construction should use:
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
```
This automatically uses `wss://` in production (Railway) and `ws://` in local dev. Verify the existing client code uses this pattern.

### Idle Timeout: 10 Minutes TCP, Server Heartbeat Already Implemented

Railway's proxy has a 10-minute TCP idle timeout. The server already implements a 30-second pub/sub heartbeat:

```typescript
// server/index.ts line 71-73
setInterval(() => {
  server.publish("game", JSON.stringify({ type: "PING", ts: Date.now() }));
}, 30_000);
```

**This is correct.** 30 seconds is well within the 10-minute threshold. No change needed.

The Bun `idleTimeout: 120` (line 65) is the Bun-level per-connection timeout, which is secondary to the Railway proxy timeout. Both values are set correctly.

**One gap:** Clients must be subscribed to the `"game"` topic for this heartbeat to reach them. If a client is not yet subscribed (i.e., pre-JOIN state), the heartbeat does not keep their connection alive. For a pre-join idle connection, Railway may close it after 10 minutes — acceptable for this use case since players join quickly.

### HTTP Request Timeout: 5 Minutes Max

Railway enforces a 5-minute maximum for HTTP responses. WebSocket connections are exempt from this limit. The `/health` endpoint returns immediately, so no issue there.

### WebSocket vs HTTP Request Timeout

Use WebSocket for all game state communication. Never use long-polling or streaming HTTP responses — those would hit the 5-minute limit. The existing architecture is correct.

---

## railway.toml Review

Current file:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 10
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

### Assessment

**`builder = "dockerfile"`:** Required. Railway cannot auto-detect Bun projects with Railpack yet (as of April 2026). Keep this.

**`healthcheckPath = "/health"`:** Correct. The server has a `/health` route returning `200 OK`. Railway will poll this after deploy before switching traffic to the new container.

**`healthcheckTimeout = 10`:** 10 seconds. Bun starts in under 1 second for this server. 10 seconds is generous and correct. The Railway default is 300 seconds — overriding to 10 makes failed deploys surface faster.

**`restartPolicyType = "on-failure"`:** Correct for a production service. The server should not restart on normal exit (0), only on crashes.

**`restartPolicyMaxRetries = 3`:** Reasonable cap. After 3 crash-restart cycles, Railway stops retrying and marks the deployment failed, which will alert you.

### Optional Additions to Consider

```toml
[deploy]
# ... existing config ...
drainingSeconds = 5   # Give in-flight WS connections 5s to close gracefully on redeploy
```

`drainingSeconds` delays the SIGKILL signal after SIGTERM, giving connected WebSocket clients time to receive a final disconnect message. For a party game where a mid-game redeploy would be jarring, 5 seconds is a low-cost improvement. Not required for the first deploy — add it once you have confirmed the basic deploy works.

---

## Networking: Getting a Public URL

After the first successful deploy:

1. Go to the Railway dashboard
2. Select the service → Settings → Networking → Public Networking
3. Click **Generate Domain**
4. Railway assigns `<project-name>.up.railway.app` (or similar)
5. Share this URL with all players

The URL will be `https://<name>.up.railway.app`. WebSocket connections from the client should use `wss://<name>.up.railway.app/ws`.

**Custom domain:** Not needed for a one-time event. If desired, add a CNAME in your DNS provider pointing to the Railway-assigned domain, then add the custom domain under Service → Settings → Networking. Railway provisions a Let's Encrypt certificate automatically. Wait for certificate generation before testing WebSocket on the custom domain — WSS will fail until the cert is issued.

---

## What NOT to Add

| Thing | Why Not |
|-------|---------|
| Redis / external pub/sub | 5-10 players, single server, single process — in-memory pub/sub is correct |
| Persistent disk / SQLite | One-time event, no need for state survival across restarts |
| Horizontal scaling (numReplicas > 1) | WebSocket state is in-memory; multiple replicas would split state across instances. Stay at 1 replica. |
| Socket.IO | Native Bun WebSockets already validated and working |
| Nginx reverse proxy in front of Bun | Railway handles TLS and proxying; adding Nginx inside the container adds complexity with no benefit |
| `railway.json` | `railway.toml` already exists and is equivalent; don't add a second config format |
| dotenvx or encrypted .env files | Railway's sealed variables cover this use case |
| Railpack builder | Railpack does not yet detect Bun projects. Dockerfile is the right builder here. |

---

## Sources

- [Railway Bun Deployment Guide](https://docs.railway.com/guides/bun) — Dockerfile requirement confirmed, Railpack does not auto-detect Bun
- [Railway Config as Code Reference](https://docs.railway.com/config-as-code/reference) — All railway.toml deploy options
- [Railway Healthchecks](https://docs.railway.com/deployments/healthchecks) — Default 300s timeout, PORT used for healthcheck
- [Railway CLI Guide](https://docs.railway.com/guides/cli) — install, login, link, up, logs commands
- [Railway Variables Reference](https://docs.railway.com/reference/variables) — RAILWAY_PUBLIC_DOMAIN and other auto-injected vars
- [Railway Help Station: PORT in Docker](https://station.railway.com/questions/bug-report-port-env-variable-not-injec-8fe16b9c) — Railway injects PORT=8080 at runtime, confirmed by employee
- [Railway Help Station: WebSocket issues](https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69) — No special platform config needed for WS
- [Railway Help Station: Socket disconnects after 10 min](https://station.railway.com/questions/socket-disconnects-after-10-minutes-bbceef40) — 10-minute TCP idle timeout, 10-30s heartbeat recommended
- [Railway Help Station: 5-min HTTP timeout](https://station.railway.com/questions/any-workarounds-for-the-5-min-request-ti-b055adde) — WebSockets exempt from 5-min HTTP limit
- [Bun Docker Hub — oven/bun](https://hub.docker.com/r/oven/bun) — Image tags and versions
