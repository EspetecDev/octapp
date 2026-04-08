---
phase: 02-admin-game-structure
plan: "04"
subsystem: frontend-ui
tags: [admin, chapter-control, recap-card, game-flow, svelte]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [GAME-02, GAME-03, GAME-05, GAME-06]
  affects: [admin-dashboard, groom-page, party-page]
tech_stack:
  added: []
  patterns:
    - CSS class toggle (.visible) for fade-in/out overlays — same as Phase 1 ReconnectingOverlay
    - initialSyncDone guard in $effect to prevent false-positive recap on join
    - sendMessage() from socket.ts for UNLOCK_CHAPTER dispatch
key_files:
  created: []
  modified:
    - src/routes/admin/+page.svelte
    - src/routes/groom/+page.svelte
    - src/routes/party/+page.svelte
decisions:
  - token stored as $state in admin dashboard to make it reactive and available in template for Configure Game link
  - isLobby derived from $gameState?.phase to conditionally show Configure Game zone (disappears after first chapter unlock)
  - initialSyncDone guard prevents recap card showing on initial STATE_SYNC when joining mid-game
  - clearTimeout before each new dismissTimer prevents stacked timers on rapid chapter unlocks
metrics:
  duration_minutes: 15
  completed_date: "2026-04-08T18:23:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 02 Plan 04: Admin Dashboard Expansion + Recap Card Overlay Summary

Admin dashboard expanded with D-08 zone order (session code → Configure Game → chapter control → player list → scores), UNLOCK_CHAPTER dispatch wired, and theatrical recap card overlay added to groom and party pages with 3s auto-dismiss and initialSyncDone late-joiner guard.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Expand admin dashboard with chapter control (Zone 3) and scores (Zone 5) | a2c153d | src/routes/admin/+page.svelte |
| 2 | Add recap card overlay to groom and party pages | 30fa3a2 | src/routes/groom/+page.svelte, src/routes/party/+page.svelte |

## What Was Built

**Task 1 — Admin Dashboard (src/routes/admin/+page.svelte)**

Expanded from 2 zones to 5 zones following D-08 order:
- **Zone 1:** Session code card — byte-for-byte preserved
- **Zone 2:** "Configure Game" link to `/admin/setup?token=...` — only shown when `isLobby === true`; disappears after first chapter unlock (D-03)
- **Zone 3:** "Game Progress" chapter control — shows "No chapters configured" in empty lobby, "Chapters ready: N" with chapters loaded, "Chapter N of M — active" during game; Unlock Chapter button fires `UNLOCK_CHAPTER` via `sendMessage()`; hidden (not disabled) when all chapters complete (D-09)
- **Zone 4:** Existing player list — unchanged
- **Zone 5:** Scores display — lists all players with their score (`scores[player.id] ?? 0`); groom row has amber left border accent

Token captured as `$state<string>("")` in `onMount` so it's reactive and available in the template for the Configure Game href.

**Task 2 — Recap Card Overlay (groom + party pages)**

Identical implementation on both pages:
- `showRecap`, `recapChapterIndex`, `initialSyncDone` `$state` declarations
- `$effect` watches `$gameState?.activeChapterIndex` — triggers recap when index changes (not on initial sync)
- `initialSyncDone` guard: first STATE_SYNC sets baseline without showing recap — prevents late-joiner false positives (Pitfall 4)
- `dismissTimer` with clearTimeout guard prevents stacked timers on rapid chapter unlocks
- Recap card: "CHAPTER" label (14px, letter-spaced), chapter number (40px display, bold), chapter name (24px heading, #f59e0b accent-groom), "N of M" progress
- CSS `.visible` class toggle pattern (same as ReconnectingOverlay) — fade-out animation completes before DOM state changes

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `token` stored as `$state` | Makes token reactive and available in Svelte template for the Configure Game link href |
| `isLobby` drives Configure Game visibility | Plan D-03: link disappears after first chapter unlock; `phase === "lobby"` is the authoritative signal |
| `initialSyncDone` guard in $effect | Pitfall 4 from RESEARCH.md: without guard, late-joining players would see recap card immediately |
| `clearTimeout` before new dismissTimer | Prevents stacked 3s timers if admin unlocks multiple chapters in quick succession |

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiles with zero new errors (one pre-existing `@types/node` configuration error exists in project, unrelated to this plan's changes).

## Known Stubs

None — all data flows from live `$gameState`. Scores display `scores[player.id] ?? 0` which correctly shows 0 before any scoring occurs (by design — scores initialize to 0 on first UNLOCK_CHAPTER per 02-01 decision).
