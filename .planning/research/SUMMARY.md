# Research Summary

**Project:** Bachelor Party Web Game (working title: octapp)
**Synthesized:** 2026-04-07
**Source files:** realtime-multiplayer.md, frontend-stack.md, backend-deployment.md, ux-game-design.md

---

## Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend framework** | Svelte 5 + SvelteKit | 47KB bundle vs React's 156KB — load time matters on bar/venue WiFi. Runes make reactive WebSocket state trivial. File-based routing handles the three distinct views (admin, groom, group) naturally. |
| **Styling / animations** | CSS + Web Animations API | Card flips, timers, and sensor games are UI interactions, not sprites. Phaser/PixiJS would add 400KB–1MB+ for zero benefit. |
| **Real-time transport** | WebSocket (bidirectional) | Players push power-ups and sabotages server-side. SSE is server-to-client only; polling is unacceptably laggy. No alternative. |
| **WebSocket server** | Bun + native Bun.serve WebSockets | Built on uWebSockets, native pub/sub maps directly to game rooms, no extra deps. Node.js + Socket.IO is a valid fallback if you want Socket.IO's auto-reconnect and rooms abstraction out of the box. |
| **State** | In-memory JS object (plain singleton) | One-time event, zero persistence required. SQLite or Redis adds deployment complexity with no user-facing benefit. |
| **Deployment** | Railway Hobby ($5/mo) | Persistent process (required for WebSocket), automatic HTTPS, git-push deploy, no Docker. Render free tier sleeps after 15 min — a live-event killer. Vercel is architecturally incompatible. |
| **Device/sensor APIs** | Native browser: DeviceMotion, DeviceOrientation, Wake Lock, Pointer Events | No library needed. Hammer.js is unmaintained (last commit 2016). Use Pointer Events + CSS `touch-action` for gestures. |

**Rejected paths (with reasons):**
- **Vercel:** Serverless cannot hold a WebSocket game server. Functions time out; no shared memory between invocations.
- **PartyKit / Cloudflare Durable Objects:** Architecturally ideal but steeper mental model. Overkill for 5-10 connections at a one-time event — unless the team is already comfortable with Cloudflare's model (see Open Questions).
- **Phaser / PixiJS:** 400KB–1MB+ overhead for minigames that are fundamentally HTML UI, not sprite/physics-based.
- **Firebase / Supabase Realtime:** DB-oriented primitives bent into an event bus shape. Supabase also pauses inactive free projects after 1 week.

---

## Key Architectural Decisions

### 1. Three Completely Separate Views, One Shared Game State

Admin, groom, and group participants have entirely different information privileges and interaction models. These map to separate SvelteKit routes (`/admin`, `/groom`, `/party`). All three subscribe to the same Svelte store populated by server-pushed WebSocket events. The **hidden information contract** must be enforced at the server layer — the server sends each client only its role-appropriate state slice. Never rely on client-side filtering to protect hidden information.

### 2. Broadcast Full State Snapshots, Not Deltas

On every game event (phase unlock, power-up deployed, sabotage activated), broadcast the complete canonical game state to all connected clients. At 5-10 players with infrequent events, payloads are tiny. The critical benefit: reconnecting clients instantly get the current state by receiving the next broadcast — no reconciliation logic required.

### 3. Session Join by Short Code, No Accounts

No authentication, no persistent user profiles. Admin creates a session; the server generates a short alphanumeric room code (6 chars, excluding visually ambiguous characters 0/O/1/I/l). Players join at a shared URL and enter the code. Admin auth is a single hardcoded `ADMIN_TOKEN` env var — no JWT, no OAuth.

### 4. Persistent Process, In-Memory State

The game server must be a persistent process, not a serverless function. State lives in a module-level JavaScript object on the server. If the server restarts mid-game (rare on Railway), the admin re-unlocks the current phase. No database needed.

### 5. Server-Side Pings, Client-Side Reconnect

Railway drops WebSocket connections idle for over 60 seconds. Server sends heartbeat pings every 30 seconds. Clients implement exponential backoff reconnect (1s → 2s → 4s). On reconnect, server re-sends full current state.

### 6. Phase-Driven Game Loop, Admin-Controlled Pacing

The admin is the sole pacing controller. Game phases (lobby → venue 1 → venue 2 → venue 3 → finale) are unlocked manually from the admin dashboard. Each phase is a self-contained chapter. Phase transitions are explicit "new chapter" moments with a recap card.

### 7. iOS Sensor Permission Gates Are Mandatory

`DeviceMotionEvent.requestPermission()` must be called inside a user gesture handler on iOS — not on page load. Before every sensor-based minigame, show a tap-to-enable prompt. Both `DeviceMotionEvent` and `DeviceOrientationEvent` need separate permission calls. All sensor APIs require HTTPS.

---

## Critical Gotchas

**iOS WebSocket kills on background (CRITICAL)**
When an iPhone user locks the screen or switches apps, iOS may terminate the WebSocket connection within seconds — with no `onclose` event fired. Use a library with built-in auto-reconnect (Socket.IO v4+, PartySocket) rather than the raw browser WebSocket API. Implement a "Reconnecting..." overlay rather than requiring a hard reload.

**Render free tier sleeps (will ruin the event)**
Render's free tier spins down after 15 minutes of no traffic. Guests arriving to a cold server get ~60 seconds of nothing. Use Railway or Render always-on. Non-negotiable for a live event.

**Railway 60-second idle WebSocket timeout**
Railway's load balancer drops connections idle over 60 seconds. Implement server-side heartbeat pings every 30 seconds.

**iOS has no fullscreen**
`requestFullscreen()` is not implemented in iOS Safari. Design all layouts with `height: 100dvh` (not `100vh`) to account for browser chrome.

**iOS sensor permission must be gated behind a user tap**
Calling `DeviceMotionEvent.requestPermission()` outside a user gesture handler on iOS silently fails — no error, no prompt, no motion data.

**DeviceMotion axis polarity differs between iOS and Android**
`DeviceMotionEvent.acceleration` reports opposite signs on some axes between platforms. Build a sensor normalization layer early.

**SvelteKit SSR crashes on browser APIs**
Any code touching `window`, `navigator`, `DeviceMotionEvent`, or WebSocket must be inside `onMount()` or guarded with `if (browser)`. Set `export const ssr = false` in each route's `+page.ts` to opt out entirely.

**Wake Lock releases on tab switch**
Re-acquire the Wake Lock in the `visibilitychange` event handler to prevent the screen sleeping mid-challenge.

**Screen orientation lock does not work on iOS**
`screen.orientation.lock()` always rejects on iOS Safari. Fall back to a CSS `@media (orientation: landscape)` overlay.

---

## UX Principles

1. **One action at a time, always.** Each screen communicates one thing and requests one action. A player distracted for 30 seconds should orient within 3 seconds of picking up their phone.

2. **Design for a slightly drunk person holding a drink.** Large high-contrast text, color-coded role identity (groom = gold, group = red/orange, admin = neutral), haptic feedback for every meaningful action.

3. **Simultaneous play — no dead air.** When the groom is in a challenge, the group must have something to do simultaneously. No player's phone should show a static state for more than 30 seconds during an active phase.

4. **One currency, context-filtered shop.** Show only the power-ups applicable to the current minigame context. Calibrate so the group can afford ~one sabotage per two minigames.

5. **Announce sabotages; do not surprise.** Sabotages are social events and story beats, not silent mechanical penalties. Never completely lock the groom out of playing.

6. **Score delta, not total.** Show "+150 pts" in large type, not cumulative totals. Narrative framing keeps stakes legible.

7. **Drop-in/drop-out at the phase level.** Each phase is a complete chapter. Phase transitions are designed re-entry points.

8. **Three-act pacing.** Act 1 (first venue): simple mechanics. Act 2 (second venue): full sabotage catalog, peak tension. Act 3 (final venue): shorter high-stakes challenges, token dump into finale.

9. **Minigame variety — never same type back-to-back.** Target sequence: physical → cognitive → social → physical.

10. **Tap response → haptic → full-screen celebration.** Buttons animate on touch before result is known. Three haptic patterns: correct, wrong, time-expired. Correct answers get 1.5–2 second full-screen celebration.

11. **Timer design: radial drain, always visible.** Circular/radial progress indicator. Recommended durations: trivia 15–20s, sensor games 10–15s, memory/matching 30–45s.

---

## Open Questions

1. **Single shared URL or role-specific join links?** Role-specific links are safer (no one can claim the groom role) but add coordination friction. Decision required before designing the join flow.

2. **How does the groom's identity persist across reconnects?** Options: session token in localStorage, display name re-entry, or unique join link encoding player ID.

3. **Push notifications between venues: build a PWA or skip?** PWA push requires service workers and user opt-in — significant added scope. Alternative: loud in-app alert when player opens their phone.

4. **Is there a shared physical screen at any venue?** Jackbox-model (one TV + phone controllers) changes the group view design significantly.

5. **Are minigames and trivia pre-authored or configurable?** Hardcoded at build time vs. admin-configurable setup flow vs. JSON config file. Gates the entire admin dashboard scope.

6. **What is the complete sabotage/power-up catalog?** Needs to be defined before building the economy system.

7. **Railway vs. PartyKit — final infrastructure call?** Two research streams diverged. Deciding factor: team comfort with Cloudflare Durable Objects.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| WebSocket as transport | HIGH | Bidirectional requirement eliminates all alternatives |
| Svelte 5 + SvelteKit | HIGH | Bundle size and reactivity advantages well-documented |
| Railway for deployment | HIGH | Persistent process requirement eliminates serverless |
| In-memory state | HIGH | One-time event; tradeoffs clearly favor simplicity |
| Bun vs. Socket.IO for WS | MEDIUM | Socket.IO's built-in reconnect may save iOS debugging time |
| Sensor API behavior | MEDIUM | Axis polarity differences need hands-on testing early |
| Railway vs. PartyKit | MEDIUM | Requires team decision on Cloudflare familiarity |
| Token economy calibration | LOW | Requires playtesting with the real group |
| Minigame timing durations | LOW | Directionally correct; need playtesting to calibrate |
