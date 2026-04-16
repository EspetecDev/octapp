---
phase: 09-export
plan: 01
subsystem: ui
tags: [svelte5, blob-download, ios-safari, export, admin-setup]

# Dependency graph
requires:
  - phase: 08-config-serializer
    provides: serializeConfig() function and GameConfig type that strips runtime fields
provides:
  - Export Config button on /admin/setup that downloads octapp-setup.json
  - iOS Safari fallback via window.open() for blob URL downloads
  - exportSetup() function with flash feedback and memory leak prevention
affects: [09-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - iOS userAgent detection for blob download divergence (/iP(hone|ad|od)/i)
    - URL.createObjectURL + programmatic <a> click pattern for desktop file download
    - URL.revokeObjectURL called immediately after click to prevent memory leak
    - Flash state boolean + clearTimeout-guarded timer (mirrors saveFlash pattern)

key-files:
  created: []
  modified:
    - src/routes/admin/setup/+page.svelte

key-decisions:
  - "exportSetup uses serializeConfig() — no inline field stripping; single source of truth per EXP-02"
  - "iOS Safari detection via /iP(hone|ad|od)/i.test(navigator.userAgent) — matches WebKit bug #216918 devices"
  - "URL.revokeObjectURL called on desktop path only — iOS window.open tab holds the reference (D-06)"
  - "Export button is outline/secondary style (border border-accent-admin), Save is filled primary — relative visual weight"

patterns-established:
  - "iOS blob download divergence: userAgent regex gates window.open vs <a download> paths"
  - "Flash feedback: exportFlash/$state + clearTimeout-guarded 1500ms timer mirrors saveFlash pattern"

requirements-completed: [EXP-01, EXP-02, EXP-03]

# Metrics
duration: 2min
completed: 2026-04-16
---

# Phase 9 Plan 01: Export Config Summary

**Export Config button on /admin/setup with iOS-aware blob download, flash feedback, and runtime-field stripping via serializeConfig()**

## Performance

- **Duration:** ~2 min (code tasks; checkpoint pending human verification)
- **Started:** 2026-04-16T07:46:11Z
- **Completed:** 2026-04-16T07:47:40Z
- **Tasks:** 2/3 complete (Task 3 is checkpoint:human-verify — awaiting user)
- **Files modified:** 1

## Accomplishments

- Added `exportSetup()` function with iOS Safari detection, blob URL download, memory leak prevention via `URL.revokeObjectURL`, and 1.5s "Exported!" flash feedback
- Replaced single-button sticky bar with two-button layout: Export Config (outline/left) + Save Setup (filled/right), both gated by `!isValid`
- TypeScript and production build both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add exportSetup function and state variables** - `3773a3c` (feat)
2. **Task 2: Replace single-button sticky bar with two-button layout** - `d5a416a` (feat)
3. **Task 3: Human verification checkpoint** - pending (checkpoint:human-verify)

## Files Created/Modified

- `src/routes/admin/setup/+page.svelte` - Added serializeConfig import, exportFlash/exportFlashTimer state, exportSetup() function, and two-button sticky bar

## Decisions Made

- Used `serializeConfig()` from `$lib/configSerializer` (no inline field stripping) — per EXP-02 requirement and RESEARCH.md "Don't Hand-Roll" rule
- iOS detection via `/iP(hone|ad|od)/i` regex matching iPhone, iPad, iPod — affected by WebKit bug #216918 where `<a download>` + blob silently fails
- `URL.revokeObjectURL` only on the desktop path — the iOS `window.open` tab holds the blob reference until closed
- Export button uses `border border-accent-admin text-accent-admin` outline style vs Save's filled `bg-accent-admin` — secondary/primary visual weight distinction per D-01

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Export Config feature is code-complete and passes TypeScript + production build
- Awaiting human verification (Task 3 checkpoint) to confirm visual layout and download behavior on device
- Once checkpoint approved, phase 09 is complete

---
*Phase: 09-export*
*Completed: 2026-04-16*
