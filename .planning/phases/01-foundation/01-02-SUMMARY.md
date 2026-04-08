---
phase: 01-foundation
plan: "02"
subsystem: websocket-server
tags: [bun, websocket, game-state, session, join-code, heartbeat, admin-token, spa-fallback]

# Dependency graph
dependency_graph:
  requires:
    - phase: 01-01
      provides: SvelteKit 5 monorepo scaffold, Dockerfile, railway.toml
  provides:
    - In-memory GameState singleton with initState/getState/setState/broadcastState
    - Session management with 6-char visually unambiguous join codes
    - WebSocket handlers: JOIN (groom uniqueness), REJOIN (identity restore), close (disconnect marking)
    - Bun.serve() HTTP + WebSocket on single port with admin token gate, health check, heartbeat, SPA fallback
  affects:
    - 01-03 (WebSocket reconnect client — consumes message protocol defined here)
    - 01-04 (Player Join Flow — depends on JOIN/REJOIN/STATE_SYNC/PLAYER_JOINED/ERROR messages)
    - All future phases extending server-side game state

# Tech tracking
tech_stack:
  added: []
  patterns:
    - Bun.serve<WSData>() for typed WebSocket context (ws.data per connection)
    - server.publish("game", ...) for in-process fan-out to all subscribers
    - Full state snapshot on every mutation (no delta messages, D-04)
    - 30s setInterval heartbeat to prevent Railway 60s idle timeout (SYNC-03)
    - SPA fallback: serve build/index.html for all unmatched routes (Pitfall 5)

# Key files
key_files:
  created:
    - path: server/state.ts
      role: In-memory GameState singleton; exports GameState, Player types + initState, getState, setState, broadcastState
    - path: server/session.ts
      role: 6-char join code generator (unambiguous charset) + createSession/getSession
    - path: server/handlers.ts
      role: WebSocket message handlers — handleOpen (subscribe+snapshot), handleMessage (JOIN/REJOIN/PONG), handleClose (disconnect)
    - path: server/index.ts
      role: Bun.serve() entry point — HTTP+WS on one port, /health, /api/admin/session, SPA fallback, 30s heartbeat
    - path: server/state.test.ts
      role: TDD tests for state module (12 tests across state + session)
    - path: server/session.test.ts
      role: TDD tests for session module
  modified: []

# Key decisions
decisions:
  - "Single in-memory active session (one game at a time) — Phase 1 scope; no multi-session complexity"
  - "crypto.randomUUID() for player IDs — Bun native, no dependency needed"
  - "CHARS = ABCDEFGHJKLMNPQRSTUVWXYZ23456789 — excludes 0/O/1/I/l for readability at noisy venue"
  - "Admin token accepted via both ?token= query param and x-admin-token header for flexibility"

# Metrics
metrics:
  duration_minutes: 20
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 01 Plan 02: Bun WebSocket Server Summary

**One-liner:** Bun WebSocket server with in-memory game state, 6-char join codes, groom-uniqueness enforcement, full-state broadcast on every mutation, 30s heartbeat, and admin token gate on a single HTTP+WS port.

## What Was Built

The complete Bun server layer for Phase 1. `server/state.ts` holds a single in-memory `GameState` (one active session at a time) and exposes `broadcastState(server)` which fans out a full `STATE_SYNC` snapshot to all subscribers via Bun's native pub/sub. `server/session.ts` generates 6-character join codes from a charset that excludes visually ambiguous characters (0/O/1/I/l) and ties them to the in-memory state. `server/handlers.ts` handles the full WebSocket lifecycle: on `open` it subscribes the connection and sends an immediate snapshot; on `JOIN` it validates session code, name, and groom uniqueness before creating a player with `crypto.randomUUID()` and returning `PLAYER_JOINED`; on `REJOIN` it restores identity from the stored playerId; on `close` it marks the player disconnected and broadcasts. `server/index.ts` uses `Bun.serve<WSData>()` to handle HTTP and WebSocket upgrades on the same port with an admin token gate (`/api/admin/session`), a health check (`/health`), a SPA fallback for client-side routing, and a 30-second heartbeat to prevent Railway's 60-second idle timeout.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for state and session | b20f4b7 | server/state.test.ts, server/session.test.ts |
| 1 (GREEN) | In-memory state + session management | d3350f8 | server/state.ts, server/session.ts |
| 2 | WebSocket handlers + Bun.serve() entry point | b32f02a | server/handlers.ts, server/index.ts |

## Verification Results

- `bun test server/state.test.ts server/session.test.ts` → 12 pass, 0 fail
- `generateJoinCode()` returns 6-char string with no ambiguous chars (100-iteration check)
- `curl http://localhost:3000/health` → 200 OK
- `curl http://localhost:3000/api/admin/session` → 401 Unauthorized
- `curl "http://localhost:3000/api/admin/session?token=testtoken"` → 200 `{"sessionCode":"..."}`
- Server starts cleanly with `ADMIN_TOKEN=x bun run server/index.ts`
- `setInterval` with `30_000` confirmed in server/index.ts
- `server.publish("game", ...)` confirmed in broadcastState

## Deviations from Plan

None — plan executed exactly as written. All four files matched the plan's provided code exactly. The TDD cycle (RED → GREEN) was followed correctly: tests were written and confirmed failing before the implementation files were created.

## Known Stubs

None — all server-side functionality for Phase 1 is fully implemented.

## Self-Check: PASSED

Verified:
- `server/state.ts` EXISTS
- `server/session.ts` EXISTS
- `server/handlers.ts` EXISTS
- `server/index.ts` EXISTS
- `server/state.test.ts` EXISTS
- `server/session.test.ts` EXISTS
- Commits b20f4b7, d3350f8, b32f02a all present in git log
- All 12 tests pass
- Server HTTP endpoints return expected status codes
