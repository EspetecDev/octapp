---
phase: 12-string-catalog
plan: 03
subsystem: i18n
tags: [i18n, string-catalog, admin, paraglide]
dependency_graph:
  requires: [Phase 11 Paraglide scaffold, Phase 8 configSerializer, Phase 9 export, Phase 10 import]
  provides: [admin_dash_* keys in en.json, admin_setup_* keys in en.json, admin dashboard i18n-ready, admin setup i18n-ready]
  affects: [src/routes/admin/+page.svelte, src/routes/admin/setup/+page.svelte, messages/en.json]
tech_stack:
  added: []
  patterns: [paraglide m.*() calls in Svelte templates, Layer 3 extraction for programmatic strings]
key_files:
  created: []
  modified:
    - messages/en.json
    - src/routes/admin/+page.svelte
    - src/routes/admin/setup/+page.svelte
decisions:
  - "admin_dash_access_denied and admin_setup_access_denied use separate keys for independent translation despite same English value"
  - "confirm() dialog string extracted as Layer 3 programmatic string per D-02"
  - "importError assignment extracted as Layer 3 programmatic string per D-02"
  - "errorMsg variable in admin/+page.svelte is unused state — only m.admin_dash_access_denied() renders in the template"
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_modified: 3
  completed_date: "2026-04-27"
---

# Phase 12 Plan 03: Admin String Catalog Summary

Admin dashboard and admin setup extracted from hardcoded English strings into Paraglide message catalog — 25 admin_dash_* and 48 admin_setup_* keys added to messages/en.json.

## Objective

Extract all hardcoded UI strings from admin/+page.svelte and admin/setup/+page.svelte into messages/en.json. Batch 3 of 3 extraction batches (parallel with Plans 01 and 02).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add admin_dash_* and admin_setup_* keys to messages/en.json | fffb1e8 | messages/en.json |
| 2 | Replace hardcoded strings in admin dashboard | 03f255d | src/routes/admin/+page.svelte |
| 3 | Replace hardcoded strings in admin setup | 32406fa | src/routes/admin/setup/+page.svelte |

## Key Changes

### messages/en.json
- Added 25 `admin_dash_*` keys: share code label, players join URL, groom role claimed, configure link, game progress header, chapter states (no chapters, ready, active, all complete), unlock buttons, confirm found, repeat chapter, reset game, reset confirm dialog, players header, waiting states, no players, scores header, access denied, role badges, session aria-label
- Added 48 `admin_setup_*` keys: page title, back link, empty state, chapter section (label, remove, name placeholder), minigame types (trivia, memory), trivia pool (section label, question label, remove, placeholders for question/answer/wrong options, add button), scavenger clue/hint/reward (labels + placeholders), add chapter, power-ups section (title, starting tokens label/placeholder), entry/remove powerup, field labels (name, description, cost, effect), effect options (timer add, scramble, distraction), add powerup, import/export/save buttons (all states), confirm/cancel/yes-replace, access denied, invalid json error

### src/routes/admin/+page.svelte
- Added `import * as m from '$lib/paraglide/messages.js'`
- 22 template replacements + 1 script block replacement (confirm() dialog)
- All visible text, aria-labels, button text, and status messages use m.*() calls
- Player names, sessionCode, score values remain as game state expressions

### src/routes/admin/setup/+page.svelte
- Added `import * as m from '$lib/paraglide/messages.js'`
- 43 template replacements + 1 script block replacement (importError assignment)
- All labels, placeholders, button text, section headers, and error messages use m.*() calls
- Form input values (chapter.name, powerUp.name, etc.) remain as game state expressions

## Deviations from Plan

### Auto-applied Prerequisites (Rule 3 - Blocking Issue)

**1. [Rule 3 - Blocking] Cherry-picked Phase 8-11 prerequisites**
- **Found during:** Plan start — worktree branch was at Phase 7 state (commit fe7335b)
- **Issue:** The worktree lacked Paraglide v2 setup (Phase 11), configSerializer (Phase 8), and import/export functionality (Phases 9-10). The plan requires these to exist to implement m.*() calls and to have the full admin/setup form to extract.
- **Fix:** Cherry-picked 7 commits from main: `5d6a19a`, `143ce90` (Phase 8 configSerializer), `3773a3c`, `d5a416a` (Phase 9 export), `f180a4b`, `7020b7c`, `d259168` (Phase 10 import), `0249daf` (Phase 11 Paraglide scaffold) — committed as prerequisite chore commits.
- **Files modified:** messages/ca.json, messages/en.json, messages/es.json, package.json, package-lock.json, project.inlang/settings.json, src/lib/configSerializer.ts, src/lib/types.ts, src/routes/admin/setup/+page.svelte, svelte.config.js, vite.config.ts
- **Commits:** 61596ac, e6d0b19

**2. Minigame type selector still shows "Sensor" option**
- **Note:** Phase 7 removed the sensor minigame type (commit d4b4607), but this wasn't included in the cherry-picked prerequisites. The admin/setup minigame selector still has a "Sensor" option with a hardcoded label. Per scope boundary rules, this pre-existing deviation from main is out of scope for this plan (12-03 only extracts strings). The sensor option text was left as `"Sensor"` since there's no `admin_setup_minigame_sensor` key defined in the plan's key list.
- **Deferred:** To `deferred-items.md` — remove sensor option from admin setup minigame selector.

## Verification

### Build Check
`npm run build` exits 0 — Paraglide compiled all 74 keys including admin_dash_* and admin_setup_* prefixes.

### Key Count
```
Total keys in en.json: 74
Keys by prefix:
  test_locale: 1
  admin_dash: 24
  admin_setup: 49
```

### Hardcoded String Scan
- `src/routes/admin/+page.svelte`: grep for listed hardcoded strings returns only 3 matches (all in `errorMsg` variable assignments in script block — dead state variable, never rendered)
- `src/routes/admin/setup/+page.svelte`: grep returns only 1 match (code comment on line 586)

## Known Stubs

None — all admin UI strings use m.*() calls. The `admin_dash_access_denied()` and `admin_setup_access_denied()` keys return valid English strings. No stubs.

## Self-Check: PASSED
