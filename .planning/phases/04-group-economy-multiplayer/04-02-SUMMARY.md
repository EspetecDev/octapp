---
phase: 04-group-economy-multiplayer
plan: "02"
subsystem: server-handlers
tags: [server, websocket, token-economy, spend-token, admin-setup]
dependency_graph:
  requires: [04-01]
  provides: [SPEND_TOKEN-handler, UNLOCK_CHAPTER-token-init, SAVE_SETUP-startingTokens, admin-startingTokens-field]
  affects: [server/handlers.ts, src/routes/admin/setup/+page.svelte]
tech_stack:
  added: []
  patterns: [Bun server.publish separate EFFECT_ACTIVATED broadcast, silently-drop invalid SPEND_TOKEN, scramble_options trivia-only guard]
key_files:
  created: []
  modified:
    - server/handlers.ts
    - src/routes/admin/setup/+page.svelte
decisions:
  - "EFFECT_ACTIVATED broadcast is a separate server.publish call after STATE_SYNC — never stored in GameState (Pitfall 1 guard)"
  - "delta hardcoded to ±5 seconds per activation; clients apply Math.max(0, remaining + delta) to clamp (Pitfall 2)"
  - "SPEND_TOKEN silently drops on: invalid powerUpIndex, insufficient balance, scramble_options outside trivia chapter — no error message sent"
  - "tokenBalances re-initialized on every UNLOCK_CHAPTER to startingTokens for all current group players; late joiners handled in future plans"
  - "recentActions sliced to 20 items max to bound memory growth"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 4 Plan 02: Server Token Economy Handlers — Summary

**One-liner:** Implemented SPEND_TOKEN handler with full validation (balance check, index check, scramble_options trivia guard), extended UNLOCK_CHAPTER to initialize tokenBalances and clear recentActions per chapter, extended SAVE_SETUP to persist startingTokens, and added startingTokens input field in admin setup form.

## What Was Built

### Task 1: server/handlers.ts

- **IncomingMessage union extended:** `SAVE_SETUP` now carries `startingTokens: number`; new `SPEND_TOKEN` variant with `powerUpIndex: number` added
- **SAVE_SETUP handler:** stores `msg.startingTokens ?? 0` into GameState via `setState`
- **UNLOCK_CHAPTER handler:** after score initialization, now also initializes `tokenBalances` for all group players to `s.startingTokens`, and sets `recentActions: []` to clear the feed on each new chapter
- **SPEND_TOKEN handler (new):** validates active chapter, valid powerUpIndex, sufficient balance, trivia-only guard for scramble_options; deducts balance via `setState`; calls `broadcastState` for STATE_SYNC; then separately publishes `EFFECT_ACTIVATED` with effectType, powerUpName, activatedBy, and optional `delta` (±5s for timer effects)

### Task 2: src/routes/admin/setup/+page.svelte

- Added `let startingTokens = $state<number>(0)` alongside other form state variables
- Extended restore `$effect` to set `startingTokens = gs.startingTokens ?? 0` on first sync
- Updated `saveSetup()` to include `startingTokens` in the `sendMessage({ type: "SAVE_SETUP", ... })` call
- Added "Starting tokens per chapter" number input above the power-up list in the Power-ups & Sabotages section; `min-h-[44px]` compliant (MOBX-02); `|| 0` fallback handles NaN from empty input

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | c5bf70a | feat(04-02): add SPEND_TOKEN handler, extend UNLOCK_CHAPTER and SAVE_SETUP in server/handlers.ts |
| Task 2 | 9541f75 | feat(04-02): add startingTokens field to admin setup form |

## Verification Results

- `grep "SPEND_TOKEN|EFFECT_ACTIVATED|tokenBalances|recentActions" server/handlers.ts` — all four appear
- `grep "startingTokens" server/handlers.ts src/routes/admin/setup/+page.svelte` — appears in both files
- `bun build server/index.ts --outfile /tmp/server-build-check.js && echo OK` — exits 0

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data is wired: token balances deducted in server state, broadcasts real, admin field saves real value.

## Self-Check: PASSED

- server/handlers.ts: FOUND and contains SPEND_TOKEN, tokenBalances, recentActions, startingTokens, EFFECT_ACTIVATED, scramble_options trivia guard
- src/routes/admin/setup/+page.svelte: FOUND and contains startingTokens state, restore from gs, sendMessage inclusion, Starting tokens per chapter label, min-h-[44px] input
- Commit c5bf70a: FOUND
- Commit 9541f75: FOUND
- bun build: OK (exits 0)
