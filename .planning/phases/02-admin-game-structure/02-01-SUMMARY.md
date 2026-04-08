---
phase: 02-admin-game-structure
plan: "01"
subsystem: types
tags: [types, game-structure, phase2-foundation]
dependency_graph:
  requires: []
  provides: [GameState-v2, Chapter-type, TriviaQuestion-type, PowerUp-type, SAVE_SETUP-message, UNLOCK_CHAPTER-message]
  affects: [server/handlers.ts, src/lib/stores, all Phase 2 plans]
tech_stack:
  added: []
  patterns: [dual-definition type sync, per-chapter state isolation]
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - server/state.ts
decisions:
  - servedQuestionIndex stored per-Chapter (not global on GameState) to prevent question bleed across chapters
  - scores initialized to empty object {}; first UNLOCK_CHAPTER populates all current players to 0
  - activeChapterIndex: null means lobby; 0 means first chapter active
  - effectType on PowerUp uses union with string fallback for extensibility
metrics:
  duration_minutes: 8
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 02 Plan 01: Type Contracts Summary

**One-liner:** Extended GameState and message unions with Chapter, TriviaQuestion, PowerUp types and SAVE_SETUP/UNLOCK_CHAPTER ClientMessage variants — dual-defined in sync across client and server boundaries.

## What Was Built

Both `src/lib/types.ts` (client) and `server/state.ts` (server) were extended with Phase 2 type contracts. The two files define identical GameState shapes independently (different build boundaries — server cannot import from src/).

### New Types Added

- `TriviaQuestion` — question + correctAnswer + wrongOptions tuple of exactly 3 strings
- `Chapter` — minigame config with trivia pool, scavenger clue, reward, and per-chapter `servedQuestionIndex`
- `PowerUp` — name, description, tokenCost, effectType (extensible union)

### GameState Extensions

- `chapters: Chapter[]` — configured before game start via SAVE_SETUP
- `activeChapterIndex: number | null` — null in lobby, 0-indexed when a chapter is active
- `scores: Record<string, number>` — playerId to score map, initialized empty
- `powerUpCatalog: PowerUp[]` — available power-ups, configured via SAVE_SETUP

### New ClientMessage Variants

- `SAVE_SETUP` — admin sends chapters and powerUpCatalog before game starts
- `UNLOCK_CHAPTER` — admin advances to the next chapter during the game

### initState Defaults

All Phase 2 fields initialize safely: `chapters: []`, `activeChapterIndex: null`, `scores: {}`, `powerUpCatalog: []`.

## Verification

- TypeScript compiles with no new errors (pre-existing `@types/node` issue is unrelated)
- 6 existing server/state.test.ts tests pass unchanged
- Both files export identical GameState shape

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is pure type definitions with no UI rendering or data wiring.

## Self-Check: PASSED

- src/lib/types.ts: exists and exports all required types
- server/state.ts: exists and exports all required types + 4 functions
- Task 1 commit: 860cc9f
- Task 2 commit: a64a6fd
