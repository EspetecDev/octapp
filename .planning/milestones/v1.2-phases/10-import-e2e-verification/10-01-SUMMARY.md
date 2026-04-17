---
phase: 10-import-e2e-verification
plan: 01
subsystem: admin-ui
tags: [import, file-upload, form, svelte5, validation]

# Dependency graph
requires:
  - phase: 09-export
    provides: exportSetup function + two-button sticky bar in +page.svelte
  - phase: 08-config-serializer
    provides: validateConfig() and GameConfig type from $lib/configSerializer
provides:
  - importSetup function (file reading + JSON parse + validateConfig call)
  - importConfirmPending state (confirm mode toggle)
  - confirmImport / cancelImport handlers
  - Three-button sticky bar (Import | Export | Save)
  - Error strip above sticky bar for invalid files
  - Hidden file input wired to importSetup onchange
affects: [10-02-e2e-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FileReader.readAsText for client-side file reading without server round-trip
    - Hidden <input type=file> programmatically triggered via element ref (importFileInput?.click())
    - Svelte 5 $state for importConfirmPending — null means normal mode, non-null means confirm mode
    - structuredClone for ConfigChapter[] and PowerUp[] arrays (same pattern as existing restore guard)

key-files:
  created: []
  modified:
    - src/routes/admin/setup/+page.svelte

key-decisions:
  - "Import button always enabled regardless of isValid — import is how you fix a broken setup (D-02)"
  - "Confirm mode is inline sticky bar swap — no modal or overlay component needed (D-03)"
  - "importFlash added analogous to saveFlash/exportFlash for brief Imported! feedback after confirmation"
  - "restoredFromState set true in confirmImport to prevent next STATE_SYNC from overwriting imported data (D-07)"

# Metrics
duration: 2
completed: 2026-04-17
---

# Phase 10 Plan 01: Import Setup — importSetup logic + three-button sticky bar + confirm mode + error strip Summary

**Full import flow wired on /admin/setup: hidden file input, FileReader validation, confirm-mode sticky bar swap, structuredClone form population with restoredFromState guard**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T07:58:07Z
- **Completed:** 2026-04-17T08:00:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 1

## Accomplishments

- Added `importFlash`, `importConfirmPending`, `importError`, `importFileInput` state variables to setup page
- Added `triggerImport()` — clears error and programmatically clicks the hidden file input
- Added `importSetup(event)` — reads file via FileReader, parses JSON, calls `validateConfig`, sets `importConfirmPending` on success or `importError` on failure
- Added `confirmImport()` — populates `chapters`, `powerUpCatalog`, `startingTokens` via `structuredClone`, sets `restoredFromState = true`, shows brief "Imported!" flash
- Added `cancelImport()` — clears pending state and error
- Replaced two-button sticky bar (Export + Save) with three-button layout: Import | Export | Save
- Import button has no `disabled` binding (always enabled per D-02)
- Added confirm mode: when `importConfirmPending` is non-null, bar swaps to "Replace setup?" + [Cancel] [Yes, Replace]
- Added error strip: fixed `bottom-[88px]`, visible only when `importError` is non-empty, persists until next import attempt
- Added hidden `<input type="file" accept=".json">` bound to `importFileInput` ref

## Task Commits

1. **Task 1: Add import state variables and importSetup() function** — `f180a4b`
2. **Task 2: Update sticky bar markup** — `7020b7c`

## Files Created/Modified

- `src/routes/admin/setup/+page.svelte` — importSetup logic in script block + three-button sticky bar + confirm mode + error strip + hidden file input

## Decisions Made

- Import button always enabled — import is how you recover from an invalid form state; blocking it via `isValid` would defeat the purpose (D-02)
- Confirm mode is an inline sticky bar swap — no new overlay component needed; "Replace setup?" label + Cancel + Yes, Replace is clear and concise (D-03, D-04)
- `importFlash` feedback added (analogous to `saveFlash`/`exportFlash`) — brief "Imported!" label on the Import button after confirmation
- `restoredFromState = true` set inside `confirmImport()` — prevents the next WebSocket `STATE_SYNC` from silently overwriting imported form data (D-07)
- Pre-existing svelte-check errors (`.ts` import extension, `addChapter` type shape) are out of scope — build compiles cleanly

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified.

## Known Stubs

None — form population is fully wired to the validated config data from `validateConfig`.

## Self-Check: PASSED

- `src/routes/admin/setup/+page.svelte` — exists and contains all required patterns
- Commit `f180a4b` — import state variables and importSetup logic
- Commit `7020b7c` — sticky bar markup update
- `importConfirmPending` appears 9 times (declaration, {#if}, two setters, clear in confirmImport, clear in cancelImport, {config:} access)
- `restoredFromState = true` appears twice: once in $effect (existing), once in confirmImport (new)
- `type="file"` appears once (hidden file input)
- `npm run build` exits 0 — no compilation errors
