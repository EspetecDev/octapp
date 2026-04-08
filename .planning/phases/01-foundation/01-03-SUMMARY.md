---
phase: 01-foundation
plan: "03"
subsystem: websocket
tags: [svelte, svelte-store, websocket, reconnect, exponential-backoff, wakelock, devicemotion, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: SvelteKit 5 monorepo scaffold, Tailwind v4, root layout, app.css

provides:
  - ReconnectingWebSocket class with exponential backoff + 50% jitter + iOS missed-heartbeat detection
  - Svelte stores: gameState, connectionStatus, lastError
  - Player identity persistence in localStorage (SESS-06 rejoin on reconnect)
  - ReconnectingOverlay.svelte driven by connectionStatus store
  - LandscapeOverlay.svelte with pure CSS @media(orientation:landscape)
  - wakeLock.ts acquire/release utility (Phase 3 will call)
  - sensors.ts normalizeSensorData scaffold with iOS/Android polarity normalization (Phase 3 will use)
  - Root layout mounts both overlays and initializes socket

affects:
  - 01-04 (Player Join Flow — imports sendMessage, connectionStatus, lastError, storePlayerSession)
  - Phase 2 (Admin & Game Structure — imports gameState, connectionStatus)
  - Phase 3 (Groom Experience — calls acquireWakeLock, normalizeSensorData)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton ReconnectingWebSocket: createSocket() initializes once, destroySocket() tears down on layout destroy"
    - "Full state snapshot on every STATE_SYNC — no delta merging"
    - "Exponential backoff: baseDelay * 2^attempt * (1 + random*0.5), capped at 30s"
    - "iOS heartbeat mitigation: 35s HEARTBEAT_TIMEOUT_MS fires scheduleReconnect if no PING received"
    - "Player identity: localStorage octapp:playerId / octapp:sessionCode, REJOIN on reconnect"
    - "Overlay z-index layering: ReconnectingOverlay=100, LandscapeOverlay=200"
    - "Pure CSS landscape detection: @media(orientation:landscape) display:flex, no JS"

key-files:
  created:
    - src/lib/types.ts
    - src/lib/socket.ts
    - src/lib/ReconnectingOverlay.svelte
    - src/lib/LandscapeOverlay.svelte
    - src/lib/wakeLock.ts
    - src/lib/sensors.ts
  modified:
    - src/routes/+layout.svelte

key-decisions:
  - "ReconnectingWebSocket singleton pattern: createSocket()/destroySocket() module-level functions, one instance per page session"
  - "iOS heartbeat guard: 35s timer after each PING; if no PING arrives the socket is silently killed on iOS (Pitfall 1)"
  - "Overlay pointer-events driven by CSS class toggle (.visible), not Svelte {#if} — allows fade-out animation to complete before removing"
  - "sendMessage export drops messages silently if socket not yet OPEN — safe for Plan 04 route components to call without socket lifecycle awareness"

patterns-established:
  - "Pattern: All components import gameState/connectionStatus/sendMessage from $lib/socket.ts — no direct WebSocket access in page components"
  - "Pattern: Both overlays rendered unconditionally in root layout — visibility controlled by store/CSS, not conditional mounting"
  - "Pattern: Utility scaffolds (wakeLock.ts, sensors.ts) defined in Phase 1, called in Phase 3 — define exports early, implement callers later"

requirements-completed: [TECH-04, TECH-05, SESS-06, SYNC-04, MOBX-03, MOBX-04]

# Metrics
duration: 82min
completed: 2026-04-08
---

# Phase 01 Plan 03: WebSocket Reconnect Client Summary

**ReconnectingWebSocket with exponential-backoff + iOS heartbeat guard, Svelte game/connection stores, reconnecting/landscape overlays wired to root layout, and Phase 3 utility scaffolds for Wake Lock and sensor normalization**

## Performance

- **Duration:** 82 min
- **Started:** 2026-04-08T10:58:46Z
- **Completed:** 2026-04-08T12:00:59Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Delivered `src/lib/socket.ts`: full ReconnectingWebSocket class (backoff, jitter, iOS missed-heartbeat, REJOIN on reconnect, localStorage player identity) plus gameState, connectionStatus, lastError Svelte stores and sendMessage export
- Delivered `src/lib/types.ts`: shared TypeScript discriminated unions for GameState, Player, ServerMessage, ClientMessage — single source of truth matching server/state.ts
- Mounted ReconnectingOverlay (z-index 100, 200ms/300ms fade) and LandscapeOverlay (pure CSS, z-index 200) unconditionally in root layout; socket created on mount, destroyed on layout destroy
- Scaffolded `src/lib/wakeLock.ts` and `src/lib/sensors.ts` for Phase 3 minigame use (MOBX-03, TECH-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types + WebSocket reconnect wrapper with Svelte stores** - `6ec1857` (feat)
2. **Task 2: Overlays, Wake Lock utility, sensor scaffold, root layout wiring** - `72d25e9` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/lib/types.ts` — GameState, Player, ServerMessage, ClientMessage discriminated union types
- `src/lib/socket.ts` — ReconnectingWebSocket class + gameState/connectionStatus/lastError stores + createSocket/destroySocket/sendMessage/storePlayerSession/getStoredPlayerId exports
- `src/lib/ReconnectingOverlay.svelte` — Overlay driven by connectionStatus store; z-index 100; 200ms fade-in / 300ms fade-out; CSS spinner
- `src/lib/LandscapeOverlay.svelte` — Pure CSS landscape detection via @media(orientation:landscape); z-index 200; no JS
- `src/lib/wakeLock.ts` — acquireWakeLock/releaseWakeLock with visibility-change re-acquire (Phase 3 caller)
- `src/lib/sensors.ts` — SensorReading type + detectPlatform + normalizeSensorData with iOS axis polarity normalization (Phase 3 caller)
- `src/routes/+layout.svelte` — Imports both overlays + createSocket/destroySocket; onMount/onDestroy lifecycle

## Decisions Made

- Used CSS class toggle (`.visible`) on the reconnecting overlay instead of `{#if}` so the 300ms fade-out animation completes before the element hides
- `sendMessage` silently drops messages when socket is not OPEN — callers (Plan 04 routes) do not need socket lifecycle awareness
- `createSocket()` derives WS URL from `window.location` at runtime using the same host/port — no VITE_WS_URL env var required (D-02)
- `HEARTBEAT_TIMEOUT_MS = 35_000` chosen to be slightly above the server's 30s ping interval, giving margin for slow connections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 (Player Join Flow) is fully unblocked: sendMessage, connectionStatus, lastError, storePlayerSession, getStoredPlayerId are all exported and ready to import
- Phase 3 utility scaffolds (wakeLock, sensors) are defined; Phase 3 only needs to wire callers
- Build passes (`bun run build` exit 0) confirming all imports resolve correctly

---
*Phase: 01-foundation*
*Completed: 2026-04-08*
