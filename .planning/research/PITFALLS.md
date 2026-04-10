# Domain Pitfalls: Bun WebSocket + SvelteKit on Railway, Mobile Testing

**Domain:** Real-time multiplayer web game — SvelteKit static adapter + Bun WebSocket server, Railway deployment, iOS/Android mobile browsers
**Researched:** 2026-04-10
**Confidence:** HIGH for Railway proxy behaviour and iOS Safari known bugs; MEDIUM for Android-specific timing; HIGH for env var and Dockerfile analysis (from direct code inspection)

---

## Critical Pitfalls

Mistakes that cause the game to be silently broken with no obvious error.

---

### Pitfall 1: Railway's `*.up.railway.app` Domain Drops WebSocket Connections at ~30s

**Symptom:** WebSocket connects fine, game works for 20-30 seconds, then all clients silently disconnect. Reconnect loop begins. Health check still passes. Railway logs show nothing wrong.

**Cause:** Railway's edge proxy terminates long-lived connections on the shared `*.up.railway.app` domain for scaling reasons. This is a documented Railway limitation, not a bug in the server code. The proxy drops idle WebSocket frames that haven't had traffic in ~30 seconds.

**Current status:** The server already publishes a heartbeat PING every 30 seconds (`setInterval` in `server/index.ts`). However, 30s may be at the boundary — if the PING arrives at 30.1s the proxy may have already terminated the connection. The `*.up.railway.app` domain compounds this.

**Prevention:**
- Use a custom domain on Railway (the proxy behaviour is more permissive on custom domains than on `*.up.railway.app`). Railway staff explicitly recommend this for WebSocket apps.
- Reduce server heartbeat interval from 30s to 20s to give a 10s safety margin against the proxy timeout.
- The client already has a 35s missed-heartbeat detector, which is correct — keep it.

**Detection:** Open Railway logs during the game. If you see no WebSocket traffic after ~30s but the health check keeps returning 200, you are hitting this.

**Phase that must address this:** Railway deployment phase — set up custom domain before multi-device testing begins.

---

### Pitfall 2: iOS Safari Kills WebSocket Without Firing `onclose` When Screen Locks or App Backgrounds

**Symptom:** A player's phone screen locks mid-game. The server still shows them as `connected: true`. The client never sees `onclose`, so the reconnect loop never triggers. The player returns to find a stale game state and their score/tokens no longer updating.

**Cause:** iOS aggressively suspends TCP connections when the screen locks or the browser tabs. WebKit has a documented bug (WebKit bug #247943) where `onclose` is not fired when the OS kills the connection. The connection appears alive on both ends but is dead.

**Current mitigation in code:** The client has a 35-second heartbeat watchdog (`HEARTBEAT_TIMEOUT_MS = 35_000`). If no PING arrives in 35s, the client treats itself as disconnected and forces a reconnect. This is the correct defence.

**Remaining risk:** If the server heartbeat fires at 30s and the client timer is 35s, there's a 5s window. If the iOS device backgrounds at 31s and the next heartbeat would be at 60s, the watchdog won't fire for 35 more seconds. Combined: up to ~65 seconds of stale state before the client notices. For a party game this is acceptable but worth knowing.

**Prevention:**
- Keep the server heartbeat at ≤20s (see Pitfall 1) which also tightens this window to ≤55s.
- The `visibilitychange` event on the client can be used to force a reconnect check when the user returns to the tab — not currently implemented. Consider adding this in the bug-fix phase.
- Do NOT increase `HEARTBEAT_TIMEOUT_MS` above 35s.

**Phase that must address this:** Bug-fix phase after real-device testing. Likely surfaces during testing.

---

### Pitfall 3: `ADMIN_TOKEN` Not Set in Railway Variables — Admin Endpoint Returns 401 Silently

**Symptom:** Admin navigates to the app, enters the token or hits `/api/admin/session`, gets a 401. If no feedback is shown to the user, it looks like a network error or blank page. Token value in Railway is missing or has a trailing space.

**Cause:** `server/index.ts` logs `"(not set)"` if `ADMIN_TOKEN` is undefined — but that log is only visible in Railway's service logs, not in the browser. Railway's Variables UI does not strip trailing whitespace from values pasted into the UI, so `ADMIN_TOKEN=secret ` (with trailing space) never matches `token === process.env.ADMIN_TOKEN`.

**Prevention:**
- In Railway Variables, use the Raw Editor (paste `KEY=VALUE` with no surrounding whitespace) rather than the per-key input which can silently include clipboard whitespace.
- On first deploy, immediately check Railway logs for the `[octapp] Admin token: (not set)` line. If seen, the variable was not applied.
- Redeploy (not restart) after adding variables — Railway injects env vars at build/start time, and a restart may not pick up new variables in all cases.

**Phase that must address this:** Railway deployment phase, first task.

---

### Pitfall 4: `PORT` Not Bound to `0.0.0.0` — Railway Proxy Cannot Reach the Server

**Symptom:** Railway health check times out. Deploy succeeds but the service URL returns "Connection refused" or times out. Logs show the server started on `port 3000` but Railway still reports unhealthy.

**Cause:** Bun's `Bun.serve()` defaults to `localhost` (127.0.0.1) when no `hostname` is specified. Railway's proxy reaches the container via an external interface, not loopback. The server must listen on `0.0.0.0`.

**Current code:** `server/index.ts` does not set `hostname`. This is a real gap.

```typescript
// Current — binds to 127.0.0.1 by default
const server = Bun.serve<WSData>({
  port: Number(process.env.PORT ?? 3000),
  ...
});

// Required for Railway
const server = Bun.serve<WSData>({
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
  ...
});
```

**Prevention:** Add `hostname: "0.0.0.0"` to `Bun.serve()` before first deploy. This is the single most common Bun-on-Railway failure mode.

**Phase that must address this:** Railway deployment phase, before first deploy attempt. This is a deploy blocker.

---

### Pitfall 5: Health Check Passes While WebSocket Endpoint Is Broken

**Symptom:** Railway dashboard shows the service as healthy (green). The app loads in the browser. But `/ws` upgrade requests return 400 ("WebSocket upgrade failed") or are silently dropped. No Railway alert fires.

**Cause:** Railway's health check calls `GET /health` and checks for HTTP 200. The health check has no knowledge of WebSocket state. The server could have a bug in the WebSocket upgrade path (e.g., a Bun version incompatibility, a crash in `handleOpen`, or a missing `ws.subscribe("game")` call) while `/health` continues returning 200. The health check gives false confidence.

**Known Bun WebSocket issue:** Bun has reported issues where WebSocket upgrade can silently fail if the `fetch` handler returns `undefined` instead of `undefined` from the upgrade path — the current code returns `undefined` on successful upgrade which is correct, but this is worth verifying in the Bun version used in the Docker image.

**Prevention:**
- After deploy, manually test the WebSocket endpoint: open browser DevTools > Network > WS tab, navigate to the app, and confirm `/ws` shows a 101 Switching Protocols response.
- Add a second smoke-test: open the admin panel, verify the session code appears, then open a second tab and join as a player — if the player list updates in the admin view, WebSockets are working end-to-end.
- Do not rely on Railway's health check as proof that WebSockets work.

**Phase that must address this:** Multi-device validation phase — the explicit smoke-test sequence must include WebSocket confirmation, not just page load.

---

### Pitfall 6: `wss://` vs `ws://` — HTTPS Page Cannot Connect to Insecure WebSocket

**Symptom:** Browser console shows: `Mixed Content: The page was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'`. WebSocket connection is blocked. App silently stays in "reconnecting" state.

**Cause:** All Railway deployments are served over HTTPS. Browsers enforce that HTTPS pages cannot initiate `ws://` (insecure) WebSocket connections — only `wss://`. The client code in `socket.ts` already derives protocol correctly:

```typescript
const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
```

This logic is correct. The risk is a developer hardcoding `ws://` in a `.env.local` override and not noticing the same code runs in production — or a future refactor that breaks the derivation.

**Prevention:** Never hardcode `ws://` anywhere. Confirm the derivation logic runs on every connect (not just first connect). The current implementation is correct — protect it during any refactor.

**Phase that must address this:** Deploy verification. Confirm in browser DevTools that the WS connection shows `wss://` not `ws://`.

---

## Moderate Pitfalls

---

### Pitfall 7: Android Chrome Suspends JavaScript Timers When Screen Locks

**Symptom:** An Android player locks their screen for 60+ seconds. When they unlock, their client is stuck in a stale state. However, unlike iOS, `onclose` may have fired — they may see "reconnecting" correctly. But their reconnect REJOIN message may be delayed, causing a visible join/rejoin flicker or a brief period where their player appears offline.

**Cause:** Chrome on Android suspends `setTimeout` and `setInterval` when the screen is off. The client-side heartbeat watchdog timer (`setTimeout` in `socket.ts`) stops counting. When the screen turns on, the timer may fire immediately (as if 35s just passed) triggering a reconnect, or it may not fire at all if the OS had already killed the TCP connection and Chrome's `onclose` fired first.

**Prevention:** The current reconnect logic handles this correctly — `onclose` triggers `scheduleReconnect()`, and `REJOIN` on reconnect restores state. The only visible effect is a brief "reconnecting" indicator. This is acceptable for the use case.

**Monitoring:** During multi-device testing, deliberately lock an Android phone for 90s and verify the player rejoins cleanly without needing a full page refresh.

---

### Pitfall 8: DeviceMotion Permission Required on iOS — Must Be Requested Inside a User Gesture

**Symptom:** The phone sensor minigame (tilt meter) shows the permission dialog but then the motion data is always zero, or the permission dialog never appears.

**Cause:** iOS 13+ requires `DeviceMotionEvent.requestPermission()` to be called inside a user gesture handler (e.g., a button `click` event). If it is called on page load or from a `setTimeout`, it is silently denied without a dialog. This is a Safari security restriction, not a WebSocket issue, but it surfaces during real-device testing.

**Prevention:** The permission gate must be triggered by a direct user tap, not programmatically. Verify the sensor game's permission button is a real click handler, not a deferred call. Test on a real iOS device — simulator does not fire DeviceMotion events.

**Phase that must address this:** Bug-fix phase after real-device testing.

---

### Pitfall 9: Bun `idleTimeout` on WebSocket Closes Connections Before Heartbeat Reaches Client

**Symptom:** Players get disconnected every ~2 minutes even with the 30s server heartbeat running.

**Cause:** `server/index.ts` sets `idleTimeout: 120` (seconds) on the WebSocket server. The `PING` broadcast goes to the `"game"` topic via `server.publish("game", ...)`, but players who have not yet sent a message (not yet subscribed via `ws.subscribe("game")` call in `handleOpen`) may not receive it. More importantly, `idleTimeout` measures inactivity on the Bun WebSocket level — if the client sends no data, Bun may close the connection at 120s even if the server heartbeat is sending data.

**Current code note:** The client sends a `PONG` message in response to every `PING` (`socket.ts` line 101). This resets Bun's idle timer. The flow is: server publishes PING → client receives → client sends PONG → Bun marks connection as active. This is correct behaviour.

**Risk:** If the client's `send()` is called when `readyState !== OPEN` (e.g., during a brief reconnect window), the PONG is silently dropped. Bun's idle timer is not reset. After 120s of no client-to-server traffic, Bun closes the socket. The client sees `onclose`, reconnects, and rejoins cleanly — but there is a brief disruption.

**Prevention:** The current 120s idle timeout gives 4 heartbeat cycles of margin (4 × 30s). Keep this ratio. The PONG response is the correct approach. No change needed unless disruptions are observed during testing.

---

### Pitfall 10: Server State Lost on Railway Redeploy or Restart

**Symptom:** Admin sets up the game, then a Railway restart occurs (crash, deploy, manual restart). All game state is gone — session code changes, all players must rejoin, all setup is lost.

**Cause:** All game state is in-memory (`server/state.ts`). Railway containers are ephemeral. This is intentional for this project (one-time event, no persistence needed), but it is a sharp edge during the pre-event setup phase if Railway restarts the container.

**Prevention:**
- Complete setup and lock it in (SAVE_SETUP) as close to game time as possible.
- Do not set up the game hours ahead and leave it idle — Railway may restart the container.
- Have a backup: export the SAVE_SETUP payload (chapters, powerUpCatalog, startingTokens) to a local file so it can be quickly re-entered if needed.
- During the party: `restartPolicyType = "on-failure"` is set — Railway will restart on crashes, which will reset state. Keep the host device (admin) connected throughout.

**Phase that must address this:** Operational awareness — document the game-night runbook to set up the game within 30 minutes of starting, not hours ahead.

---

### Pitfall 11: SvelteKit Static Adapter — No Server-Side Rendering, `PUBLIC_` Env Vars Are Build-Time Only

**Symptom:** Any env var prefixed `PUBLIC_` (from `$env/static/public`) shows as `undefined` in the deployed app, or shows the value from the build machine rather than Railway's configured value.

**Cause:** `svelte.config.js` uses `@sveltejs/adapter-static`. Static adapter pre-renders all routes at build time. `$env/static/public` vars are inlined at build time by Vite — they are baked into the JavaScript bundle. If Railway injects a `PUBLIC_` variable at runtime, it has no effect because the bundle was already built with whatever was available at `bun run build` time.

**Current code:** The codebase does not use `$env/static/public` — the WebSocket URL is derived from `window.location` at runtime, not from an env var. This is the correct pattern for a static-adapter app. The only env var the server reads is `ADMIN_TOKEN` and `PORT`, both at runtime.

**Risk:** If a future developer tries to add a `PUBLIC_SOMETHING` variable in Railway's dashboard expecting it to change the deployed app's behaviour, it will have no effect.

**Prevention:** Never use `$env/static/public` or `import.meta.env.VITE_*` in this project for values that need to vary per environment. All runtime configuration must be handled server-side (via Railway env vars read by `server/index.ts`) or derived dynamically in the client (as `window.location` already is).

---

## Minor Pitfalls

---

### Pitfall 12: `bun.lock*` Wildcard in Dockerfile May Miss Lock File

**Symptom:** `bun install` in Docker doesn't use the lock file, installs slightly different package versions than local dev, silent behaviour change.

**Cause:** The Dockerfile copies `bun.lock*` (wildcard). If the lock file is named `bun.lockb` (binary format) and the wildcard doesn't match, Docker silently omits it and `--frozen-lockfile` may fail or be skipped.

**Current code:** `COPY package.json bun.lock* ./` — the `*` is a shell glob that Docker COPY expands. Bun's lock file is named `bun.lockb`. The glob `bun.lock*` should match `bun.lockb`.

**Prevention:** Verify the lock file name: `ls bun.lock*` in the project root. If it is `bun.lockb`, the glob works correctly. If a future Bun version changes the lock file name, update the Dockerfile.

---

### Pitfall 13: Railway `healthcheckTimeout = 10` May Be Too Short During Cold Start

**Symptom:** First deploy fails health check. Railway marks the deploy as failed and rolls back. Server logs show the container started successfully, but the health check timed out before `Bun.serve()` was ready.

**Cause:** `healthcheckTimeout = 10` seconds. Bun cold start in the slim Docker image is fast (typically <2s), but if the Railway runtime is under load or the image needs to be pulled, the container may take longer to reach the health endpoint.

**Prevention:** Consider increasing to `healthcheckTimeout = 30`. The cost of a false failure (rollback + retry) is higher than the cost of a 30s wait. At 10s, there's limited margin.

---

### Pitfall 14: Railway Free Tier / Sleeping Service — First WebSocket Request After Sleep Gets 502

**Symptom:** The service wakes up on first HTTP request (the SvelteKit page loads), but the WebSocket upgrade request fires ~200ms later before the Bun process is fully warm. The upgrade returns 502.

**Cause:** Railway's free tier (Hobby plan) may sleep idle services. The first request wakes the container, but there's a gap between the HTTP response and the WebSocket being ready.

**Current mitigation:** The client has exponential backoff reconnect. A 502 on first WebSocket attempt triggers `onerror` → `onclose` → reconnect after 500ms. By then the server is warm.

**Prevention:** The client's reconnect logic already handles this. No code change needed. Be aware that the first join attempt at the start of the party may show a brief "reconnecting" state — this is normal and self-resolves within 1-2 seconds.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Railway initial deploy | PORT binding to 127.0.0.1 (Pitfall 4) | Add `hostname: "0.0.0.0"` before first push |
| Railway initial deploy | ADMIN_TOKEN missing or whitespace (Pitfall 3) | Check logs immediately after deploy |
| Railway domain setup | 30s proxy timeout on `*.up.railway.app` (Pitfall 1) | Set up custom domain before testing |
| WebSocket smoke test | Health check passes, WS broken (Pitfall 5) | Use browser DevTools WS tab to confirm 101 |
| iOS real-device testing | Screen lock silent disconnect (Pitfall 2) | Test lock/unlock cycle explicitly |
| iOS real-device testing | DeviceMotion permission gate (Pitfall 8) | Test sensor game on real device, not simulator |
| Android real-device testing | Timer suspension on screen lock (Pitfall 7) | Lock screen for 90s, verify clean rejoin |
| Pre-party setup | State lost on restart (Pitfall 10) | Set up within 30 min of game start |
| Any future env var work | Static adapter bakes PUBLIC_ at build time (Pitfall 11) | Use server-side env vars or window.location |

---

## Sources

- Railway WebSocket known issues: [Railway Help Station — WebSocket Connection Issues](https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69)
- Railway 30s proxy timeout: [Railway Help Station — Socket disconnects after 10 minutes](https://station.railway.com/questions/socket-disconnects-after-10-minutes-bbceef40)
- Railway timeout workarounds: [Any workarounds for the 5 min request timeout?](https://station.railway.com/questions/any-workarounds-for-the-5-min-request-ti-b055adde)
- iOS Safari silent close: [WebKit bug #247943 — WebSocket onclose not fired](https://bugs.webkit.org/show_bug.cgi?id=247943)
- iOS background suspension: [Apple Developer Forums — Prevent WebSocket from closing](https://developer.apple.com/forums/thread/716118)
- Safari iOS 26 WebSocket upgrade bug: [Debugging WebSocket Upgrade Failures Safari iOS26](https://www.jackpearce.co.uk/posts/debugging-websocket-upgrade-failures-safari-ios26/)
- Android Chrome timer suspension: [primus/primus issue — Android devices reconnect on screen off](https://github.com/primus/primus/issues/350)
- General WebSocket timeout guide: [WebSocket.org — Fix Timeout and Silent Dropped Connections](https://websocket.org/guides/troubleshooting/timeout/)
- Bun WebSocket Railway template: [Railway Help Station — Bun WebSockets](https://station.railway.com/templates/bun-web-sockets-2cabbb7d)
- SvelteKit env var handling: [SvelteKit $env/static/public docs](https://svelte.dev/docs/kit/$env-static-public)
- Bun WebSocket docs: [Bun WebSockets](https://bun.com/docs/runtime/http/websockets)
- Railway Bun deployment guide: [Railway — Deploy a Bun App](https://docs.railway.com/guides/bun)
