# Project Research Summary

**Project:** octapp — Bachelor Party Game
**Domain:** Real-time multiplayer web game, Railway cloud deployment, mobile browser testing
**Milestone:** v1.1 — Deployment & Testing
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

octapp is a SvelteKit static-adapter frontend + Bun WebSocket server already validated in previous phases. This milestone is purely operational: get the working local build live on Railway, verify it behaves on real iOS and Android hardware, and fix the mobile-specific bugs that only surface on physical devices. The stack, architecture, and game logic are settled — no technology decisions remain open.

The deployment path is low-friction. The existing Dockerfile, railway.toml, and server code are production-ready with two caveats: ADMIN_TOKEN must be set in the Railway dashboard (the only manual env var step), and a custom Railway domain should be provisioned before multi-device testing to avoid the shared-CDN idle-timeout behaviour on `*.up.railway.app`. Code-wise, `wss://` handling is already correct in `src/lib/socket.ts` (line 183 derives protocol from `window.location.protocol`), and `Bun.serve()` defaults to `0.0.0.0` so no hostname fix is needed — one researcher was mistaken on this point.

The primary risks are mobile-specific and only discoverable on real devices: iOS Safari silently killing WebSocket connections on screen lock (the 35s heartbeat watchdog already mitigates this), the DeviceMotion permission gate silently failing if not triggered inside a user gesture, and the `*.up.railway.app` CDN 30s idle-drop (mitigated by custom domain + existing 30s server heartbeat which is sufficient for the confirmed 60s proxy idle timeout). All three have clear prevention strategies and none require architectural changes.

---

## Key Findings

### Stack Additions Needed (Minimal — Mostly Operational)

The existing stack requires no new libraries or services. What v1.1 adds is operational tooling only.

**One-time setup actions:**
- Railway CLI (`brew install railway` or `npm i -g @railway/cli`) — for `railway login`, `railway link`, `railway up`, `railway logs`
- Railway dashboard: generate a public domain under Service → Settings → Networking → Public Networking
- Railway dashboard: set `ADMIN_TOKEN` (only manual env var — see below)

**Core technologies already in place:**
- Bun 1.x (oven/bun:1 Docker image) — WebSocket server runtime; floating `1` tag acceptable for a one-time event
- SvelteKit with static adapter — pre-renders all routes at build time; WebSocket URL derived from `window.location` at runtime (correct pattern for static adapter)
- Railway Dockerfile builder — Railpack does not yet auto-detect Bun; Dockerfile path is required and already configured in railway.toml

**What NOT to add:** Redis, SQLite, nginx sidecar, Socket.IO, horizontal scaling, or dotenvx. All are unnecessary for 5–10 players on a single ephemeral server.

### Environment Variables

| Variable | Source | Action Required |
|----------|--------|----------------|
| `ADMIN_TOKEN` | Manual — Railway dashboard | Set before first deploy. Use Raw Editor to avoid trailing-whitespace bugs. Seal the variable. |
| `PORT` | Railway injects automatically (`8080`) | Do NOT set. Server already reads `process.env.PORT ?? 3000`; Railway's value takes precedence. |
| `RAILWAY_PUBLIC_DOMAIN` | Railway injects automatically | Read-only reference if needed server-side. Not needed by current code. |

**ADMIN_TOKEN is the only manual setup step in the Railway dashboard.**

### Expected Test Coverage (What Must Pass)

Multi-device testing has three roles: Admin (PC browser), Groom (iPhone), Party Member (Android phone). These scenarios must pass for the night to work:

**Table stakes — game-breaking if they fail:**
- Three-device join with correct role assignment
- Chapter unlock broadcasts to all devices within 2 seconds
- Trivia answer registers and score appears on admin view
- Sensor (tilt) minigame: iOS DeviceMotion permission gate appears and motion data flows
- Token earn/spend with correct server-authoritative balance
- Screen lock recovery: reconnect fires and full-state snapshot restores game view

**Differentiators (validate the party feel, not blocking):**
- Sub-1s broadcast latency for power-up activation
- Haptic feedback on win/loss (Android only — iOS Safari has no Vibration API)
- All three devices show chapter transition overlay within 2 seconds

**Defer to second pass:** Portrait lock edge cases, font rendering on low-DPI Android, custom domain vs `*.up.railway.app` SSL cert timing.

### Architecture: No New Components Required

The current single-process Bun.serve architecture (HTTP + WebSocket + static file serving on one port) is fully compatible with Railway's proxy model. Railway terminates TLS at the edge; Bun receives plain WebSocket frames internally. No nginx sidecar, no separate static CDN, no load balancer config is needed.

**Verified compatible, no code changes required:**

| Component | Status | Verified Fact |
|-----------|--------|---------------|
| `wss://` protocol switching | Already correct | `src/lib/socket.ts` line 183 derives protocol from `window.location.protocol` |
| `Bun.serve()` host binding | Already correct | Bun defaults to `0.0.0.0` when no `hostname` is specified (confirmed in Bun docs) |
| Server heartbeat (30s) | Already correct | Railway proxy idle timeout is 60s; 30s heartbeat provides 30s margin |
| `PORT` from env | Already correct | `process.env.PORT ?? 3000`; Railway injects `PORT=8080` at runtime |
| `/health` endpoint | Already correct | Returns 200; railway.toml references it with 10s timeout |
| Client reconnect + full-state | Already correct | Handles Railway's 15-minute hard connection cutoff |

**Should add (low effort, meaningful safety):**
- `process.on("uncaughtException", ...)` handler in `server/index.ts` — prevents silent crash leading to state wipe mid-game
- Client-side PING discard — prevents PING frames surfacing as unknown message type in client log
- `drainingSeconds = 5` in railway.toml — gives in-flight WS connections 5s to close gracefully on redeploy

**One architecture risk:** In-memory state is wiped on any Railway restart (crash, redeploy, manual restart). With `restartPolicyType = "on-failure"`, a crash mid-game resets all session state. Operational mitigation: complete game setup within 30 minutes of game start, not hours ahead.

### Critical Pitfalls

1. **`*.up.railway.app` CDN drops WebSocket at ~30s** — The shared Railway CDN terminates idle connections faster than the documented 60s proxy timeout. Fix: provision a custom domain before multi-device testing. The more permissive proxy behaviour on custom domains makes heartbeat timing non-critical.

2. **iOS Safari kills WebSocket silently on screen lock** — `onclose` does not fire (WebKit bug #247943). The existing 35s client-side heartbeat watchdog already handles this. Test explicitly: lock groom's iPhone for 15 seconds mid-trivia, verify state restores on unlock.

3. **`ADMIN_TOKEN` missing or has trailing whitespace** — Server logs `"(not set)"` in Railway logs only, not in the browser. Use Railway's Raw Editor when setting the variable. Check Railway logs immediately after first deploy for this message.

4. **Health check passes while WebSocket is broken** — Railway's `GET /health` check has no knowledge of WebSocket state. After each deploy, manually verify the WS connection in browser DevTools (Network → WS tab, confirm 101 Switching Protocols). Do not rely on the green health indicator as WebSocket proof.

5. **DeviceMotion permission silently denied on iOS** — `DeviceMotionEvent.requestPermission()` must be called synchronously inside a direct user gesture handler. Calling it on page load or in a `setTimeout` produces no dialog and no error — just zero motion data. Only testable on a real iOS device, not simulator.

6. **State lost on Railway restart** — Any deploy or crash wipes in-memory session state. Set up the game close to start time. Export the SAVE_SETUP payload locally as a backup.

---

## Implications for Roadmap

### Phase 1: Railway Deploy and Smoke Test
**Rationale:** Everything else depends on having a live URL. Catch deployment blockers in isolation before inviting three people to test simultaneously.
**Delivers:** Live HTTPS URL, confirmed WebSocket 101 in DevTools, ADMIN_TOKEN verified in Railway logs.
**Actions:**
- `railway login` + `railway link` + `railway up`
- Set `ADMIN_TOKEN` in Railway dashboard (Raw Editor, then Seal)
- Generate domain under Service → Settings → Networking
- Confirm `/health` returns 200; confirm WebSocket shows 101 in browser DevTools
- Check Railway logs for `"Admin token: (not set)"` — if seen, redeploy after fixing
**Avoids:** Pitfall 3 (missing ADMIN_TOKEN), Pitfall 5 (false health check confidence)
**Research flag:** Standard patterns — no deeper research needed.

### Phase 2: Custom Domain and Connection Stability
**Rationale:** The `*.up.railway.app` CDN 30s idle drop is a silent game-breaker that looks like a server bug. Resolve this before multi-device testing to avoid false debugging rabbit holes.
**Delivers:** Stable WebSocket connection surviving 5+ minutes of idle, confirmed via Railway logs showing no unexpected close events.
**Actions:**
- Configure custom domain in Railway dashboard (preferred) OR reduce heartbeat from 30s to 20s as fallback
- Optionally add `drainingSeconds = 5` to railway.toml
- Optionally add `process.on("uncaughtException", ...)` to server/index.ts
- Monitor Railway logs for 5 minutes with no game activity — confirm no disconnects
**Avoids:** Pitfall 1 (`*.up.railway.app` 30s CDN drop)
**Research flag:** Standard patterns — Railway dashboard custom domain setup is documented.

### Phase 3: Three-Device Join and Core Flow
**Rationale:** Validates the deployment works for the actual party configuration before drilling into individual minigame issues.
**Delivers:** All three roles connected simultaneously, chapter unlock broadcast within 2s, scores updating on admin view.
**Test sequence (run in order):**
1. Admin opens live URL on PC — verify no console errors, code generated
2. Groom joins via code on iPhone — verify role assignment and waiting view
3. Party member joins on Android — verify group waiting view
4. Admin unlocks Chapter 1 — verify all three update within 2 seconds
5. Admin triggers trivia — verify groom sees minigame view
**Avoids:** Pitfall 6 (mixed-content wss vs ws — already fixed, but verify in DevTools)
**Research flag:** Standard patterns.

### Phase 4: Mobile-Specific Bug Hunt
**Rationale:** The bugs that only appear on physical devices cannot be found earlier. This phase is explicitly discovery-driven.
**Delivers:** All table-stakes scenarios passing on real hardware.
**High-priority test cases:**
- Sensor (tilt) minigame on groom's iPhone — DeviceMotion permission gate (Pitfall 5 / FEATURES Pitfall 8)
- Screen lock recovery — groom iPhone locked 15s mid-trivia, verify state restore (Pitfall 2)
- Android screen lock 90s — verify clean rejoin without full page refresh (Pitfall 7)
- Token earn race: rapid taps on party phone — verify no negative balance
- Android back button mid-game — verify does not exit session
- iOS viewport keyboard push on join code entry (low risk, verify quickly)
**Avoids:** Pitfall 2, Pitfall 7, Pitfall 8
**Research flag:** Needs real-device validation — sensor minigame permission flow cannot be confirmed in simulator. Real iOS device required.

### Phase Ordering Rationale

- Phase 1 before everything: no live URL means no real-device testing is possible.
- Phase 2 before three-device testing: CDN drop would cause false failures in Phase 3, wasting test session time.
- Phase 3 before Phase 4: establishing baseline connectivity catches deployment issues before spending time on mobile-specific edge cases.
- Phase 4 is discovery-driven by design: not all bugs are known ahead of time. Budget time for iteration.

### Research Flags

**Needs real-device validation (cannot be confirmed by code inspection or simulator):**
- Phase 4: DeviceMotion permission gate on physical iOS device
- Phase 4: Screen lock WebSocket recovery on iOS Safari (WebKit bug — behaviour varies by iOS version)
- Phase 4: Android back-button history stack behaviour (varies by SvelteKit router usage)

**Standard patterns (no deeper research needed):**
- Phase 1: Railway CLI deploy workflow — well-documented
- Phase 2: Custom domain setup — Railway dashboard UI
- Phase 3: Multi-device WebSocket join — existing reconnect + full-state architecture already validated in Phase 01

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new technologies. Railway CLI and Dockerfile patterns confirmed from Railway official docs. |
| Features | HIGH | Test scenarios derived from real failure modes documented across multiple sources. Mobile-specific issues are well-known. |
| Architecture | HIGH | Railway proxy behaviour (60s idle timeout, 15-min cutoff, TLS termination, 0.0.0.0 binding) confirmed from Railway Specs & Limits page and Bun official docs. |
| Pitfalls | HIGH for Railway/iOS; MEDIUM for Android timing | iOS Safari WebKit bugs are filed and confirmed. Android timer suspension behaviour varies by manufacturer. |

**Overall confidence: HIGH**

### Gaps to Address During Execution

- **`*.up.railway.app` vs custom domain idle timeout:** PITFALLS.md reports ~30s CDN drop on the shared domain; ARCHITECTURE.md confirms 60s from the Railway Specs & Limits page. These are not contradictory — the CDN layer in front of `*.up.railway.app` is more aggressive than the documented proxy timeout. Custom domain sidesteps this entirely. Validate in Phase 2 by monitoring logs before committing to heartbeat interval change.
- **Heartbeat interval (30s vs 20s):** The existing 30s heartbeat is confirmed sufficient against the 60s proxy idle timeout. If custom domain is not configured, reducing to 20s provides extra margin against the CDN layer. Decision point: resolve in Phase 2 based on observed behaviour.
- **`visibilitychange` reconnect on iOS tab return:** Not currently implemented. The 35s watchdog handles it eventually. Flag for Phase 4 bug-fix pass if screen-lock testing reveals noticeable recovery delay.
- **Admin role restoration on tab refresh:** FEATURES.md identifies this as high-complexity. Current implementation stores admin role in WS server memory. If admin refreshes mid-game, role reassignment depends on reconnect flow. Needs explicit testing in Phase 3.

---

## Sources

### Primary (HIGH confidence — official documentation)
- [Railway Networking Specs & Limits](https://docs.railway.com/networking/public-networking/specs-and-limits) — 60s proxy idle timeout, 15-min connection cutoff, TLS termination, connection limits
- [Railway SSE vs WebSocket Guide](https://docs.railway.com/guides/sse-vs-websockets) — 15-minute hard cutoff, reconnect requirement
- [Railway Config as Code Reference](https://docs.railway.com/config-as-code/reference) — railway.toml all options including drainingSeconds
- [Railway CLI Guide](https://docs.railway.com/guides/cli) — login, link, up, logs commands
- [Railway Variables Reference](https://docs.railway.com/reference/variables) — auto-injected vars, Seal feature
- [Railway Bun Deployment Guide](https://docs.railway.com/guides/bun) — Dockerfile requirement, Railpack limitation
- [Bun HTTP Server Docs](https://bun.com/docs/runtime/http/server) — Bun.serve defaults to 0.0.0.0
- [Bun WebSocket Docs](https://bun.com/docs/runtime/http/websockets) — idleTimeout behaviour, pub/sub

### Secondary (MEDIUM-HIGH confidence — community reports, filed bugs)
- [Railway Help Station — WebSocket connection issues](https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69)
- [Railway Help Station — Socket disconnects](https://station.railway.com/questions/socket-disconnects-after-10-minutes-bbceef40)
- [WebKit bug #247943](https://bugs.webkit.org/show_bug.cgi?id=247943) — onclose not fired on iOS screen lock
- [DeviceMotionEvent.requestPermission iOS 13+](https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2)
- [iOS touch-action 300ms delay](https://developer.chrome.com/blog/300ms-tap-delay-gone-away)
- [Safari iOS 26 WebSocket upgrade bug](https://www.jackpearce.co.uk/posts/debugging-websocket-upgrade-failures-safari-ios26)

### Verified by Code Inspection (overrides researcher speculation)
- `src/lib/socket.ts` line 183 — `wss://` protocol already derived from `window.location.protocol`; no code change needed
- `server/index.ts` — `Bun.serve()` has no `hostname` field; Bun defaults to `0.0.0.0`; no hostname fix needed
- `server/index.ts` lines 71-73 — 30s heartbeat already implemented; sufficient for 60s proxy idle timeout
- `railway.toml` + `server/index.ts` — `restartPolicyType = "on-failure"` and `process.env.PORT ?? 3000` both correct as-is

---

*Research completed: 2026-04-10*
*Ready for roadmap: yes*
