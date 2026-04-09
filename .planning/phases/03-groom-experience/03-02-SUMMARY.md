---
phase: 03-groom-experience
plan: 02
subsystem: ui
tags: [svelte, components, screen-router, timer, wake-lock]

# Dependency graph
requires:
  - phase: 03-groom-experience
    plan: 01
    provides: Extended Chapter type with minigameDone/scavengerDone, message handlers
provides:
  - RadialCountdown.svelte shared SVG timer component with color thresholds and cleanup
  - Groom page screen router deriving waiting/minigame/scavenger/reward from gameState
  - Stub components for all five screens (TriviaMinigame, SensorMinigame, MemoryMinigame, ScavengerScreen, RewardScreen)
  - Wake lock acquisition/release tied to screen state
  - Recap overlay preserved and rendered outside screen blocks (overlays all screens)
affects: [03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG radial timer: stroke-dashoffset driven by (1 - remaining/duration), rotated -90deg at transform-origin 50% 50%"
    - "Screen router: $derived IIFE returning literal union string; maps Chapter boolean flags to screen names"
    - "Wake lock lifecycle tied to screen $derived value via $effect"
    - "Recap overlay sibling pattern: position:fixed element rendered after {#if screen} blocks, not inside waiting block"

key-files:
  created:
    - src/lib/components/RadialCountdown.svelte
    - src/lib/components/TriviaMinigame.svelte
    - src/lib/components/SensorMinigame.svelte
    - src/lib/components/MemoryMinigame.svelte
    - src/lib/components/ScavengerScreen.svelte
    - src/lib/components/RewardScreen.svelte
  modified:
    - src/routes/groom/+page.svelte

key-decisions:
  - "RadialCountdown $effect returns clearInterval cleanup — prevents Pitfall 6 (timer running after win/expire)"
  - "screen derived as IIFE returning string literal — matches Svelte 5 $derived() signature for complex logic"
  - "Recap overlay placed as sibling after all {#if screen} blocks — ensures visibility from all screens, not just waiting"
  - "Stub components created as minimal $props receivers — allow groom page to compile and downstream plans to replace in parallel"

patterns-established:
  - "Component slot pattern: import + stub creation in one plan, implementation delegated to downstream plans"

requirements-completed: [MINI-04]

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 3 Plan 02: RadialCountdown Component + Groom Screen Router Summary

**SVG countdown timer component with color thresholds and groom page screen router deriving waiting/minigame/scavenger/reward from chapter completion flags**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-09T06:42:04Z
- **Completed:** 2026-04-09T06:48:00Z
- **Tasks:** 2/2
- **Files created:** 6, **Files modified:** 1

## Accomplishments

- Created `RadialCountdown.svelte` with SVG radial timer, RADIUS=45, CIRCUMFERENCE=2πr, color thresholds (>50% green, 25-50% amber, <25% red), 1s linear dashoffset transition, `role="timer"` accessibility, and `$effect` cleanup returning `clearInterval`
- Expanded `src/routes/groom/+page.svelte` with screen router: `activeChapter` derived from `chapters[activeChapterIndex]`, `screen` derived from game state phase and chapter completion flags
- Added wake lock `$effect`: `acquireWakeLock()` when screen=minigame, `releaseWakeLock()` otherwise
- Preserved all existing code (recap card, role badge, waiting screen, styles)
- Moved recap overlay outside `{#if screen}` blocks so it renders via `position:fixed` on all screens
- Created five stub component files allowing the groom page to compile and enabling Plans 03-06 to implement in parallel

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RadialCountdown.svelte shared component** — `03f75a2` (feat)
2. **Task 2: Expand groom page with screen router + import slots** — `57f5aad` (feat)

## Files Created/Modified

- `src/lib/components/RadialCountdown.svelte` — SVG radial countdown timer, 39 lines
- `src/lib/components/TriviaMinigame.svelte` — stub, accepts `chapter` prop
- `src/lib/components/SensorMinigame.svelte` — stub, accepts `chapter` prop
- `src/lib/components/MemoryMinigame.svelte` — stub, no props
- `src/lib/components/ScavengerScreen.svelte` — stub, accepts `chapter` prop
- `src/lib/components/RewardScreen.svelte` — stub, accepts `chapter`, `activeChapterIndex`, `chapters` props
- `src/routes/groom/+page.svelte` — extended with screen router, wake lock, imports; recap overlay relocated

## Decisions Made

- `$effect` in RadialCountdown returns `clearInterval` cleanup — prevents timer running after the `onExpire` callback fires (Pitfall 6)
- `screen` derived as IIFE (`$derived(() => { ... })`) to enable multi-line logic returning a string literal union
- Recap overlay moved outside `{#if screen}` blocks — it uses `position:fixed` and must be accessible when any screen is active
- Five stub components created now so parallel plans (03-03 through 03-06) can implement without waiting on groom page changes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following stub components are intentionally empty and tracked for downstream plans:

| File | Reason | Resolved by |
|------|--------|-------------|
| `src/lib/components/TriviaMinigame.svelte` | Planned for Plan 03-03 | Plan 03-03 |
| `src/lib/components/SensorMinigame.svelte` | Planned for Plan 03-04 | Plan 03-04 |
| `src/lib/components/MemoryMinigame.svelte` | Planned for Plan 03-05 | Plan 03-05 |
| `src/lib/components/ScavengerScreen.svelte` | Planned for Plan 03-06 | Plan 03-06 |
| `src/lib/components/RewardScreen.svelte` | Planned for Plan 03-06 | Plan 03-06 |

These stubs are intentional — the plan's goal (screen router + timer component) is fully achieved. Stubs enable parallel plan execution.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `RadialCountdown.svelte` is ready to import in TriviaMinigame, SensorMinigame, MemoryMinigame (Plans 03-06)
- Screen router correctly derives all four screens from `gameState` — downstream components just need to implement content
- Wake lock wired to minigame screen — no further changes needed in groom page for this feature
- No blockers for Plans 03-03 through 03-06

---
*Phase: 03-groom-experience*
*Completed: 2026-04-09*
