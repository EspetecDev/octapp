---
phase: 12-string-catalog
plan: "01"
subsystem: frontend/i18n
tags: [i18n, string-extraction, paraglide, svelte]
dependency_graph:
  requires: [11-i18n-infrastructure]
  provides: [en-json-join-shared-strings]
  affects: [src/routes/+page.svelte, src/lib/LandscapeOverlay.svelte, src/lib/ReconnectingOverlay.svelte, src/lib/components/MemoryMinigame.svelte, src/lib/components/TriviaMinigame.svelte, src/lib/components/ScavengerScreen.svelte, src/lib/components/RadialCountdown.svelte, src/lib/components/RewardScreen.svelte]
tech_stack:
  added: []
  patterns: [paraglide-v2-m-function-calls, flat-snake_case-keys-with-view-prefix]
key_files:
  created: []
  modified:
    - messages/en.json
    - src/routes/+page.svelte
    - src/lib/LandscapeOverlay.svelte
    - src/lib/ReconnectingOverlay.svelte
    - src/lib/components/MemoryMinigame.svelte
    - src/lib/components/TriviaMinigame.svelte
    - src/lib/components/ScavengerScreen.svelte
    - src/lib/components/RadialCountdown.svelte
    - src/lib/components/RewardScreen.svelte
decisions:
  - "flat snake_case key naming with view/component prefix — join_*, landscape_*, reconnect_*, memory_*, trivia_*, scavenger_*, radial_*, reward_*"
  - "Paraglide parameter syntax {paramName} used for dynamic strings — memory_card_aria_label, radial_aria_label, reward_chapter_label, reward_past_chapter_btn"
  - "test_locale_active key preserved in messages/en.json — removed in Plan 05 as documented"
  - "User-authored content (chapter.reward, scavengerClue, scavengerHint, chapter.name) excluded from catalog per I18N-04"
metrics:
  duration_min: 15
  completed: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 9
requirements: [I18N-01]
---

# Phase 12 Plan 01: String Catalog — Join Page + Shared Components Summary

English string catalog seeded with all join page and shared component keys; every hardcoded UI string in 8 source files replaced by typed Paraglide `m.*()` function calls.

## What Was Built

**Task 1 — messages/en.json updated**
Added 33 new keys alongside the preserved `test_locale_active` stub (total: 34+ keys for join/shared, 147 total when combined with other batches committed concurrently). Keys follow flat snake_case with view/component prefix: `join_*`, `landscape_*`, `reconnect_*`, `memory_*`, `trivia_*`, `scavenger_*`, `radial_*`, `reward_*`.

Dynamic keys with Paraglide parameters:
- `memory_card_aria_label`: `{ index }` — "Card {index}"
- `memory_card_matched_suffix`: `", matched"` — concatenated in aria-label
- `radial_aria_label`: `{ remaining }` — "{remaining} seconds remaining"
- `reward_chapter_label`: `{ number }` — "Chapter {number}"
- `reward_past_chapter_btn`: `{ number, name }` — "Chapter {number}: {name}"

**Task 2 — +page.svelte join page**
13 replacements: page title, subtitle, all labels, placeholders, role selector buttons, submit button, and programmatic error strings in `lastError.subscribe` callback and `handleSubmit` timeout. `placeholder="XXXXXX"` (format mask) intentionally left as-is.

**Task 3 — 7 shared components**
22 replacements across LandscapeOverlay, ReconnectingOverlay, MemoryMinigame, TriviaMinigame, ScavengerScreen, RadialCountdown, RewardScreen. LandscapeOverlay received a new `<script lang="ts">` block to host the import. All components use direct `import * as m from '$lib/paraglide/messages.js'`.

## Verification Results

- Node key-validation script: PASS (all required keys present, 147 total keys)
- grep for hardcoded UI strings in +page.svelte: 0 matches
- grep for hardcoded UI strings in 7 shared components: 0 matches
- `npm run build`: PASS — exit 0, `✓ built in 1.59s`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @inlang/paraglide-js package prevented build**
- **Found during:** Post-task build verification
- **Issue:** `@inlang/paraglide-js` was listed in `package.json` dependencies but not installed in `node_modules` — build failed with `ERR_MODULE_NOT_FOUND`. `@sveltejs/vite-plugin-svelte` was also absent.
- **Fix:** Ran `npm install --legacy-peer-deps` to install missing dependencies. Required `--legacy-peer-deps` due to vite peer version conflict with `@sveltejs/kit`.
- **Files modified:** `package-lock.json`, `node_modules/` (not committed — runtime dependency)
- **Commit:** N/A (dependency install, not a code change)

## Known Stubs

None — all keys in this batch are fully populated English strings. The `test_locale_active` key is an intentional Phase 11 stub preserved per plan instructions (removed in Plan 05).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `b198de9` | feat(12-01): add join page and shared component strings to messages/en.json |
| Task 2 | `8f73d13` | feat(12-01): replace hardcoded strings in join page with m.*() calls |
| Task 3 | `44b3b35` | feat(12-01): replace hardcoded strings in shared components with m.*() calls |

## Self-Check: PASSED

- messages/en.json: FOUND (147 keys)
- src/routes/+page.svelte: FOUND, all m.*() calls verified
- src/lib/LandscapeOverlay.svelte: FOUND, m.landscape_heading(), m.landscape_body()
- src/lib/ReconnectingOverlay.svelte: FOUND, m.reconnect_* calls
- src/lib/components/MemoryMinigame.svelte: FOUND, m.memory_* calls
- src/lib/components/TriviaMinigame.svelte: FOUND, m.trivia_* calls
- src/lib/components/ScavengerScreen.svelte: FOUND, m.scavenger_* calls
- src/lib/components/RadialCountdown.svelte: FOUND, m.radial_aria_label()
- src/lib/components/RewardScreen.svelte: FOUND, m.reward_* calls
- Commits b198de9, 8f73d13, 44b3b35: FOUND in git log
