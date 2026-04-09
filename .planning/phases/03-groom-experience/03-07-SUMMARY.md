---
phase: 03-groom-experience
plan: "07"
subsystem: party-page
tags: [reward-reveal, overlay, svelte5, rwrd-01]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [party-reward-reveal-overlay]
  affects: [src/routes/party/+page.svelte]
tech_stack:
  added: []
  patterns: [pitfall-4-guard, separate-effect-per-concern, css-class-toggle-visibility]
key_files:
  created: []
  modified:
    - src/routes/party/+page.svelte
decisions:
  - "Reward reveal $effect is separate from recap card $effect — avoids interference with existing initialSyncDone guard"
  - "initialSyncDone checked in reward effect too: player joining mid-reward sets revealedChapterIndex and showRewardReveal=true immediately"
  - "Overlay does NOT auto-dismiss — no setTimeout; waits for activeChapterIndex to advance past revealedChapterIndex"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-09"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 03 Plan 07: Reward Reveal Overlay (Party Page) Summary

Reward reveal full-screen overlay on party page: triggers on scavengerDone flip, persists until next UNLOCK_CHAPTER, handles reconnect via Pitfall 4 guard.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add reward reveal overlay to party/+page.svelte | a384df2 | src/routes/party/+page.svelte |

## What Was Built

Added the RWRD-01 reward reveal overlay to `src/routes/party/+page.svelte`:

- **State**: `showRewardReveal` ($state boolean) and `revealedChapterIndex` ($state number|null)
- **Logic**: A dedicated `$effect` separate from the recap card effect, using the Pitfall 4 guard pattern (`!initialSyncDone` baseline) to prevent false-positive overlays on reconnect
- **Markup**: Fixed-position overlay with REWARD UNLOCKED label, chapter name, and reward text in amber (#f59e0b) with amber glow box-shadow
- **CSS**: `.reward-overlay` / `.reward-overlay.visible` pattern matching existing recap overlay; opacity toggle via CSS class (not `{#if}`) for smooth fade

## Behavioral Guarantees

- Overlay triggers when `chapter.scavengerDone` flips true (normal flow)
- Overlay persists until `activeChapterIndex` advances (no auto-dismiss setTimeout)
- Player reconnecting mid-reward: baseline sets `revealedChapterIndex` and `showRewardReveal = true` immediately
- Player reconnecting after reward (chapter already advanced): `revealedChapterIndex` matches new `idx`, overlay not shown

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Separate $effect for reward reveal | Avoids mutating `initialSyncDone` or `recapChapterIndex` shared by recap card effect |
| No auto-dismiss timer | UI-SPEC and RWRD-01 both require overlay to persist — dismissed only by next UNLOCK_CHAPTER |
| CSS class toggle for visibility | Existing project pattern — allows opacity fade-out animation to complete before rendering change |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - overlay reads live `$gameState.chapters[revealedChapterIndex].reward` data from server.

## Self-Check: PASSED

- FOUND: src/routes/party/+page.svelte
- FOUND: commit a384df2
