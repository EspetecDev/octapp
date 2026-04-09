---
phase: 03-groom-experience
plan: 01
subsystem: api
tags: [websocket, typescript, game-state, handlers]

# Dependency graph
requires:
  - phase: 02-admin-game-structure
    provides: Chapter type, GameState, UNLOCK_CHAPTER handler, setState/broadcastState pattern
provides:
  - Extended Chapter type with minigameDone and scavengerDone boolean fields in both type files
  - ClientMessage and IncomingMessage unions with MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST variants
  - Server handlers for all three new message types with score mutation and broadcast
  - Idempotency guard on MINIGAME_COMPLETE preventing double scoring
  - UNLOCK_CHAPTER reset of minigameDone/scavengerDone on newly activated chapter
affects: [03-02, 03-03, 03-04, groom-view, group-view, minigame-ui, scavenger-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency guard: read state before setState, guard on already-done field, early return"
    - "Score mutation via groom player ID extracted pre-setState to avoid closure capture issues"
    - "Chapter field reset on UNLOCK_CHAPTER ensures clean per-chapter state regardless of prior completion"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - server/state.ts
    - server/handlers.ts

key-decisions:
  - "MINIGAME_COMPLETE is idempotent: state.chapters[activeChapterIndex]?.minigameDone guard prevents double-scoring on duplicate sends"
  - "UNLOCK_CHAPTER explicitly resets minigameDone=false and scavengerDone=false on newly activated chapter so re-used chapter objects start clean"
  - "Score delta: win=+50, loss=-20 for minigame; hint=-10; all applied to groomPlayerId only"

patterns-established:
  - "Phase 3 handler pattern: getState() snapshot → guard active chapter → setState with chapter map → broadcastState"

requirements-completed: [MINI-01, MINI-02, MINI-03, MINI-04, MINI-05, MINI-06, MINI-07, HUNT-01, HUNT-02, HUNT-03, HUNT-04, RWRD-01, RWRD-02, RWRD-03]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 3 Plan 01: Type System & Server Handler Extensions Summary

**Three new WebSocket handlers (MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST) wired to idempotent score mutation and state broadcast, with Chapter type extended in both type files**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-09T06:39:05Z
- **Completed:** 2026-04-09T06:44:10Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- Extended Chapter type with `minigameDone: boolean` and `scavengerDone: boolean` in both `src/lib/types.ts` and `server/state.ts` (kept in sync as required)
- Extended ClientMessage and IncomingMessage unions with MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST variants
- Implemented three server handlers following the established setState + broadcastState pattern
- Added idempotency guard on MINIGAME_COMPLETE to prevent double-scoring on duplicate sends
- UNLOCK_CHAPTER now resets minigameDone/scavengerDone to false on the newly activated chapter

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Chapter type and ClientMessage union** - `7ea3e9d` (feat)
2. **Task 2: Add MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST handlers** - `06c2b15` (feat)

## Files Created/Modified
- `src/lib/types.ts` - Added minigameDone/scavengerDone to Chapter; added 3 new ClientMessage variants
- `server/state.ts` - Added minigameDone/scavengerDone to Chapter (kept in sync with client type)
- `server/handlers.ts` - Extended IncomingMessage union; updated UNLOCK_CHAPTER to reset fields; added 3 new handlers

## Decisions Made
- MINIGAME_COMPLETE idempotency guard reads `state.chapters[activeChapterIndex]?.minigameDone` before calling setState — ensures duplicate WebSocket sends (e.g., mobile double-tap) cannot double-apply score
- Score delta +50 (win) / -20 (loss) for minigame; -10 for hint — all applied to groomPlayerId only
- UNLOCK_CHAPTER resets both fields on `nextIndex` branch of chapter map, covering both trivia and non-trivia paths

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type contracts are fully established: all three message types defined end-to-end
- Server handlers are ready to receive messages from UI components built in subsequent plans
- Both groom view and group view plans can reference MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST message types
- No blockers

---
*Phase: 03-groom-experience*
*Completed: 2026-04-09*
