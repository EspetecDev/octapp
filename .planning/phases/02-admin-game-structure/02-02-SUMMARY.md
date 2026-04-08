---
phase: 02-admin-game-structure
plan: "02"
subsystem: server-handlers
tags: [websocket, handlers, game-structure, phase2]
dependency_graph:
  requires: [02-01]
  provides: [SAVE_SETUP-handler, UNLOCK_CHAPTER-handler]
  affects: [server/handlers.ts]
tech_stack:
  added: []
  patterns: [setState-broadcastState pattern, per-chapter servedQuestionIndex, scores-on-first-unlock]
key_files:
  created: []
  modified:
    - server/handlers.ts
decisions:
  - SAVE_SETUP rejected with error when phase is not lobby (server enforces setup lock)
  - UNLOCK_CHAPTER initializes scores to 0 for all current players only on first unlock (activeChapterIndex === null)
  - servedQuestionIndex set per-chapter on activation; random index from triviaPool; null for non-trivia or empty pool
  - No admin identity check on UNLOCK_CHAPTER/SAVE_SETUP; server validates preconditions only (consistent with Phase 1 pattern)
metrics:
  duration_minutes: 10
  completed_date: "2026-04-08"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 02 Plan 02: Server Handlers Summary

**One-liner:** Extended server/handlers.ts with SAVE_SETUP and UNLOCK_CHAPTER WebSocket message handlers using the same setState + broadcastState pattern established in Phase 1.

## What Was Built

`server/handlers.ts` was extended with two new message handlers. All existing handlers (JOIN, REJOIN, PONG, handleOpen, handleClose) remain byte-for-byte identical.

### Type Import Extension

`Chapter` and `PowerUp` added to the import from `./state.ts`. `IncomingMessage` union extended with two new variants.

### SAVE_SETUP Handler

- Validates `state.phase === "lobby"` — rejects with error "Setup is locked after the game starts." if not in lobby
- Applies `setState` to update `chapters` and `powerUpCatalog` from the message payload
- Calls `broadcastState(server)` to push STATE_SYNC to all connected clients

### UNLOCK_CHAPTER Handler

- Computes `nextIndex`: `activeChapterIndex === null ? 0 : activeChapterIndex + 1`
- Validates: rejects if `chapters.length === 0` or `nextIndex >= chapters.length` with appropriate error message
- On first unlock (`activeChapterIndex === null`): initializes `scores` to 0 for all current players
- Sets `servedQuestionIndex` on the newly active chapter: random index from triviaPool (trivia minigames), null for non-trivia or empty pool
- Sets `phase` to `"active"` and `activeChapterIndex` to `nextIndex`
- Calls `broadcastState(server)` — all clients receive STATE_SYNC; recap card on client driven by activeChapterIndex change (D-11)

## Verification

- 12 server tests pass (6 from state.test.ts + 6 from handlers or other server tests)
- TypeScript compiles with no new errors (pre-existing `@types/node` issue is unrelated)
- All acceptance criteria confirmed via grep checks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is pure server-side logic with no UI rendering.

## Self-Check: PASSED

- server/handlers.ts: modified and committed (9dbcaff)
- SAVE_SETUP handler: imports Chapter/PowerUp, guards on phase === "lobby", calls setState + broadcastState
- UNLOCK_CHAPTER handler: initializes scores on first unlock, sets servedQuestionIndex per chapter, calls broadcastState
- All 12 server tests pass
