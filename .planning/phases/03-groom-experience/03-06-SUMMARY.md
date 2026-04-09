---
phase: 03-groom-experience
plan: "06"
subsystem: groom-screens
tags: [scavenger, reward, admin, svelte5]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04, 03-05]
  provides: [ScavengerScreen, RewardScreen, admin-confirm-found]
  affects: [src/routes/groom/+page.svelte, src/routes/admin/+page.svelte]
tech_stack:
  added: []
  patterns: [svelte5-runes, derived-state, accordion-css-max-height]
key_files:
  created: []
  modified:
    - src/lib/components/ScavengerScreen.svelte
    - src/lib/components/RewardScreen.svelte
    - src/routes/admin/+page.svelte
decisions:
  - "Hint button hidden via hasHint $derived guard — no hint configured means button never renders (D-23)"
  - "Past rewards accordion uses CSS max-height transition (0 → 200px) per UI-SPEC 200ms ease"
  - "Admin Confirm Found placed after unlock button block in Zone 3 — conditional on minigameDone && !scavengerDone"
metrics:
  duration_min: 8
  completed_date: "2026-04-09"
  tasks: 2
  files: 3
---

# Phase 03 Plan 06: Scavenger & Reward Screens Summary

**One-liner:** Scavenger hunt screen with conditional hint, I Found It! CTA, glowing reward reveal card with past rewards accordion, and admin Confirm Found override button.

## What Was Built

### Task 1: ScavengerScreen.svelte and RewardScreen.svelte

Replaced both stubs with full implementations:

**ScavengerScreen.svelte** (`src/lib/components/ScavengerScreen.svelte`):
- Displays `chapter.scavengerClue` in a dark card with 24px/700 text
- `hasHint = $derived(!!chapter.scavengerHint && chapter.scavengerHint.trim().length > 0)` gates the hint section — button invisible when no hint configured (D-23)
- "Request Hint (−10 pts)" button sends `HINT_REQUEST` and flips `hintRequested = true` to reveal hint text
- "I Found It!" button sends `SCAVENGER_DONE`
- Exact copywriting per UI-SPEC

**RewardScreen.svelte** (`src/lib/components/RewardScreen.svelte`):
- "REWARD UNLOCKED" label + chapter name header
- Reward card with amber accent border (`#f59e0b`), glow (`box-shadow: 0 0 24px rgba(245, 158, 11, 0.3)`), reward text in accent color
- Past rewards accordion rendered only when `activeChapterIndex > 0 && pastRewards.length > 0`
- `pastRewards = $derived(chapters.slice(0, activeChapterIndex).filter(ch => ch.scavengerDone))`
- CSS max-height accordion (0 → 200px, 200ms ease) per UI-SPEC

### Task 2: Admin Confirm Found button (Zone 3)

Updated `src/routes/admin/+page.svelte`:
- Added `activeChapter = $derived(activeChapterIndex !== null ? ($gameState?.chapters[activeChapterIndex] ?? null) : null)`
- "Confirm Found (admin override)" button in Zone 3, visible only when `activeChapter?.minigameDone && !activeChapter?.scavengerDone`
- Sends `SCAVENGER_DONE` as admin fallback path (HUNT-03)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9a51280 | feat(03-06): implement ScavengerScreen and RewardScreen components |
| 2 | a56b035 | feat(03-06): add Confirm Found admin override button to Zone 3 |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all three components are fully implemented with live data from props/gameState.

## Self-Check: PASSED

- [x] `src/lib/components/ScavengerScreen.svelte` exists with SCAVENGER_DONE, HINT_REQUEST, hasHint, I Found It!, SCAVENGER CLUE
- [x] `src/lib/components/RewardScreen.svelte` exists with reward-card glow, #f59e0b accent, accordion, pastRewards, REWARD UNLOCKED, Past Rewards
- [x] `src/routes/admin/+page.svelte` contains activeChapter derived, Confirm Found (admin override), minigameDone && !scavengerDone condition
- [x] Commits 9a51280 and a56b035 exist in git log
