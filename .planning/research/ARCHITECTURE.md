# Architecture: Bun WebSocket + Railway Proxy Integration

**Project:** octapp (bachelor party game)
**Researched:** 2026-04-10
**Scope:** Railway production environment integration for Bun WebSocket + SvelteKit static

---

## Railway Proxy Layer: What It Does to Your Connections

Railway sits a reverse proxy in front of every service. All inbound traffic hits Railway's edge, which terminates TLS, then forwards to your container over plain HTTP/1.1 (or WebSocket over HTTP/1.1). Your Bun process never sees raw TLS — it receives already-decrypted connections.

**Confirmed behaviors (HIGH confidence — from Railway docs Specs & Limits page):**

| Behavior | Value | Implication for octapp |
|----------|-------|----------------------|
| TLS termination | At Railway edge | Bun receives `ws://` internally, clients use `wss://` |
| Max connection duration | 15 minutes | WebSocket sessions are force-closed at 15 min; client reconnect handles it |
| Proxy Keep-Alive idle timeout | 60 seconds | Any WebSocket silent for 60s is dropped by the proxy |
| Max concurrent connections | 10,000 per service | Not a concern for 5–10 player sessions |
| Max requests per second | 11,000 per domain | Not a concern |
| WebSocket protocol | HTTP/1.1 Upgrade only | Bun's WebSocket implementation uses HTTP/1.1 — compatible |
| TLS versions enforced | TLS 1.2 and TLS 1.3 | Handled entirely by Railway edge; Bun does not configure TLS |

**Proxy headers Railway injects on every request:**

```
X-Real-IP           — client's actual remote IP
X-Forwarded-Proto   — always "https" (even for WebSocket upgrades)
X-Forwarded-Host    — original hostname from the client
X-Railway-Edge      — edge region identifier
X-Request-Start     — Unix millisecond timestamp
X-Railway-Request-Id — per-request correlation ID
```

These headers arrive at Bun's `fetch()` handler before the WebSocket upgrade occurs. `X-Forwarded-Proto` will be `"https"` not `"wss"` — Railway's proxy normalizes it to `https` for both HTTP and WebSocket connections.

---

## PORT and HOST Binding

**The critical requirement:** Railway requires applications to bind on `0.0.0.0:$PORT`. Binding to `127.0.0.1` or `localhost` only is a deployment failure — Railway's proxy cannot reach a container bound to loopback only.

**Bun.serve default behavior (HIGH confidence — from Bun official docs):**

Bun.serve binds to `0.0.0.0` by default when no `hostname` is specified. The current `server/index.ts` does not set `hostname`, so it inherits `0.0.0.0` automatically. This is correct for Railway.

**Current PORT handling in `server/index.ts`:**

```ts
port: Number(process.env.PORT ?? 3000),
```

Railway injects `PORT` at runtime. The Dockerfile also sets `ENV PORT=3000` as a fallback for local runs. This pattern is correct — Railway's injected `PORT` takes precedence over the Dockerfile default at runtime.

**No `hostname` override needed.** The current code omits `hostname` which correctly defaults to `0.0.0.0`.

---

## TLS Termination: What It Means for WebSocket Clients

Railway terminates TLS at the edge. The flow is:

```
Client browser
  |-- wss://your-app.railway.app/ws  (TLS encrypted, port 443)
  |
Railway Edge (TLS termination)
  |-- ws://container:PORT/ws  (plain HTTP/1.1 Upgrade, unencrypted internally)
  |
Bun.serve on 0.0.0.0:PORT
```

**Implication for the client-side WebSocket URL:** The SvelteKit frontend must construct the WebSocket URL using `wss://` when running in production (since `window.location.protocol` will be `https:`), and `ws://` in local dev. The current client code should derive the scheme from `window.location.protocol`:

```ts
const scheme = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${scheme}://${window.location.host}/ws`;
```

If the client currently hardcodes `ws://` or always uses `wss://`, verify this construction. Using `wss://` against Railway's `https:` domain is correct. Using `ws://` against an `https:` domain will be blocked by browsers as a mixed-content violation.

**Bun does not need TLS configuration.** No `tls:` block in `Bun.serve` is needed or wanted — Railway handles certificates entirely.

---

## The 60-Second Idle Timeout: Critical for Gameplay

This is the most operationally significant Railway constraint for octapp.

**What happens:** Railway's proxy drops any WebSocket connection where no data frames have been sent or received for 60 consecutive seconds. The client's WebSocket `onclose` fires. Without reconnect logic, the player's session dies silently mid-game.

**What octapp currently does:** `server/index.ts` already implements a server-side heartbeat:

```ts
// Server-side heartbeat every 30s to prevent Railway 60s idle timeout (SYNC-03)
setInterval(() => {
  server.publish("game", JSON.stringify({ type: "PING", ts: Date.now() }));
}, 30_000);
```

This publishes a `PING` message to the `"game"` topic every 30 seconds. Every connected client subscribed to `"game"` receives this frame, which resets Railway's proxy idle timer. **This is the correct approach.** The 30-second interval provides a 30-second margin before the 60-second proxy timeout.

**Remaining gap:** The `PING` message only reaches clients subscribed to the `"game"` topic via `server.publish`. Verify that all connected WebSocket clients subscribe to `"game"` during `handleOpen`. If a client connects but hasn't joined a session yet (e.g., still on the join screen), they may not be subscribed to `"game"` and won't receive the heartbeat — they could be dropped after 60 seconds of inactivity on the join screen.

**Client-side PING handling:** The client should either silently discard `PING` messages or respond with a `PONG` frame. Most proxy idle timers reset on either direction of traffic. Discarding silently is fine — the server-to-client PING frame itself resets the proxy timer.

---

## The 15-Minute Hard Cutoff: Reconnect Is Not Optional

Railway force-closes all WebSocket connections at 15 minutes regardless of activity. This is not a bug — it is documented platform behavior.

**What octapp already has:** Client-side reconnect with exponential backoff and full-state snapshot on reconnect (validated in Phase 01: Foundation, confirmed in PROJECT.md requirements).

**What the full-state-on-reconnect design buys you:** When Railway severs the connection at 15 minutes, the client reconnects, re-sends its session code, and receives the current full game state. From the player's perspective, the game resumes in under a second. This architecture already handles the Railway constraint correctly.

**Bun `idleTimeout: 120` in the websocket config:** This is the Bun-level application timeout (120 seconds). The Railway proxy timeout (60 seconds) is shorter, so in practice the Railway proxy will drop idle connections before Bun's own idle timeout triggers. The server-side heartbeat prevents both from firing during active sessions. The Bun `idleTimeout` acts as a backstop to clean up connections Railway has already dropped.

---

## Session State: In-Memory Is Acceptable, With Awareness

The game's session state (game progress, scores, chapter state) lives entirely in Bun process memory. This is appropriate for this use case with the following understanding:

**What a Railway redeploy does:** Any new Railway deployment (code push, config change, manual restart) starts a fresh Bun process. In-memory state is wiped. All connected clients are disconnected and receive a `close` event. Their reconnect logic fires, they re-connect to the new process, but `getSession(sessionCode)` returns `undefined` — the session is gone.

**Risk profile for octapp:** The game is played over a single night. If Railway redeploys mid-game (e.g., due to a crash and restart), the session resets. For a one-time event this is a meaningful risk — a crash mid-game loses all game progress.

**Railway restart policy in `railway.toml`:**
```toml
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

This restarts on crash, not on success. Deliberate deploys (code pushes) still cause a restart. The risk window is: an unhandled exception crashes the server mid-game.

**Mitigation recommendation (not blocking for MVP):** Add a top-level `process.on("uncaughtException")` handler with logging to prevent crashes from unhandled rejections. This reduces the restart risk during a live game session.

---

## Component Map: New vs. Modified

### No New Components Required

The current architecture (Bun.serve single-port HTTP + WebSocket + static files) is fully compatible with Railway's proxy model. No separate nginx sidecar, no separate static file CDN, no load balancer config is needed.

### Verified Compatible (No Changes Required)

| Component | Status | Reason |
|-----------|--------|--------|
| `Bun.serve` port binding | Compatible | Defaults to `0.0.0.0`; `PORT` from env |
| `/health` endpoint | Compatible | Already implemented; `railway.toml` references it |
| TLS configuration | Not needed | Railway edge handles TLS entirely |
| Heartbeat interval (30s) | Compatible | Correct for 60s proxy idle timeout |
| Client reconnect + full-state | Compatible | Handles both 15-min cutoff and crash restarts |
| Dockerfile multi-stage build | Compatible | Copies `build/` and `server/` correctly |
| `ADMIN_TOKEN` env var gate | Compatible | Railway env vars injected at runtime |

### Must Verify Before Deploying

| Item | Check | Risk if Wrong |
|------|-------|---------------|
| Client WebSocket URL construction | Uses `wss://` when `location.protocol === "https:"` | Mixed-content browser block; no WebSocket connection in production |
| `handleOpen` subscribes all clients to `"game"` topic | Check `handlers.ts` | Clients not subscribed miss heartbeat PING; idle-dropped after 60s on join screen |
| `ADMIN_TOKEN` set in Railway env vars | Set via Railway dashboard | Admin login returns 401 in production |
| `PORT` not hardcoded in Railway service settings | Railway injects dynamically | Port conflict or server not reachable |

### Should Add (Low Effort, Meaningful Safety)

| Item | Why | Where |
|------|-----|-------|
| `process.on("uncaughtException", ...)` | Prevents silent crashes mid-game; logs the error | `server/index.ts` |
| Client-side PING discard | Prevents PING frames from being treated as unknown message types | Client WebSocket message handler |

---

## Deploy Order

Railway deploys a single service. There is no multi-service dependency graph. The correct sequence:

1. Set environment variables in Railway dashboard (`ADMIN_TOKEN`, leave `PORT` to Railway)
2. Connect GitHub repo to Railway service
3. Railway builds using the Dockerfile (multi-stage: build SvelteKit → copy to slim runner)
4. Railway runs `bun run server/index.ts` (CMD in Dockerfile)
5. Railway proxy routes public HTTPS/WSS traffic to container port

No migration step, no seed step, no separate process required.

---

## Data Flow: Production vs. Local Dev

```
LOCAL DEV:
  Browser → ws://localhost:3000/ws → Bun.serve (no proxy, no TLS)

RAILWAY PRODUCTION:
  Browser → wss://app.railway.app/ws (TLS, port 443)
    → Railway Edge (TLS termination)
    → ws://container:$PORT/ws (HTTP/1.1 Upgrade, no TLS)
      → Bun.serve websocket handler
        → handleOpen / handleMessage / handleClose
          → in-memory session state
            → server.publish("game", ...) → all subscribed clients
```

The data flow through the application layer is identical. The only structural difference is the TLS termination layer inserted by Railway. Bun receives plain WebSocket frames in both environments.

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| 60s proxy idle timeout | HIGH | Railway Docs — Specs & Limits page (confirmed) |
| 15-minute connection cutoff | HIGH | Railway Docs — SSE vs WebSocket guide (confirmed) |
| TLS termination at edge | HIGH | Railway Docs — Specs & Limits page (confirmed) |
| Bun defaults to 0.0.0.0 | HIGH | Bun official docs (confirmed) |
| `X-Forwarded-Proto` = "https" | HIGH | Railway Docs — Specs & Limits page (confirmed) |
| Heartbeat at 30s is sufficient | HIGH | 30s < 60s proxy timeout; well-established pattern |
| In-memory state loss on restart | HIGH | Fundamental to how Railway deployments work |
| 10,000 concurrent connection limit | HIGH | Railway Docs — Specs & Limits page (confirmed) |

---

## Sources

- [Railway Networking Specs & Limits](https://docs.railway.com/networking/public-networking/specs-and-limits) — proxy keep-alive timeout, TLS enforcement, connection limits, proxy headers
- [Railway SSE vs WebSocket Guide](https://docs.railway.com/guides/sse-vs-websockets) — 15-minute connection duration limit, reconnect requirement
- [Railway Public Networking Docs](https://docs.railway.com/public-networking) — HOST/PORT binding requirements
- [Bun HTTP Server Docs](https://bun.com/docs/runtime/http/server) — Bun.serve defaults to 0.0.0.0
- [Railway Bun WebSocket Game Server Template](https://railway.com/deploy/bun-websocket-game-server) — KEEPALIVE_MS pattern, /health endpoint pattern
- [Railway Help Station — WebSocket connection issues](https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69) — community-reported production behavior
