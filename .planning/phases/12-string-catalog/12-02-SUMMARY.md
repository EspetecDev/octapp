---
phase: 12-string-catalog
plan: "02"
subsystem: i18n
tags: [i18n, paraglide, string-extraction, groom-view, party-view]
dependency_graph:
  requires: [11-i18n-infrastructure, 12-01]
  provides: [groom-view-i18n, party-view-i18n]
  affects: [messages/en.json, src/routes/groom/+page.svelte, src/routes/party/+page.svelte]
tech_stack:
  added: []
  patterns: [paraglide-message-functions, flat-snake-case-keys, user-content-passthrough]
key_files:
  created: []
  modified:
    - messages/en.json
    - src/routes/groom/+page.svelte
    - src/routes/party/+page.svelte
decisions:
  - "Separate party_recap_label and groom_recap_label keys (both 'CHAPTER') to allow independent translation"
  - "Token balance singular/plural uses two separate message keys (party_token_balance_single/plural) instead of ICU plural syntax — deferred to I18N-05 v2"
  - "User-authored content (player names, chapter names, power-up names, reward text) passes through directly from game state — not catalogued"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 12 Plan 02: Groom + Party View String Extraction Summary

Extracted all hardcoded UI strings from groom and party views into messages/en.json, replacing each with typed Paraglide m.*() calls. 32 new keys added (6 groom_*, 26 party_*) bringing the total catalog from 1 key (Phase 11 stub) to 147 keys merged with Plan 01 output.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add groom + party strings to messages/en.json | 8394d88 | messages/en.json |
| 2 | Replace hardcoded strings in groom view | bbfc27d | src/routes/groom/+page.svelte |
| 3 | Replace hardcoded strings in party view | d0394d0 | src/routes/party/+page.svelte |

## What Was Built

**Task 1 — messages/en.json:** Added 6 `groom_*` keys and 26 `party_*` keys to the English catalog. Keys cover: role badge, loading/waiting states, recap overlay label and progress, earn area (balance, counter, button), shop (header, empty, aria labels, cost badge, spend button), social waiting screen (balances, actions, lobby waiting), overlays (recap, reward), and spend reject toast.

**Task 2 — groom/+page.svelte:** Added `import * as m from '$lib/paraglide/messages.js'` and replaced 6 hardcoded strings: role badge aria-label, role badge text, loading placeholder, waiting status text, recap label, and recap progress. User-authored content (player name, chapter name, power-up name) left as game state expressions.

**Task 3 — party/+page.svelte:** Added `import * as m from '$lib/paraglide/messages.js'` and replaced 23 hardcoded strings across all zones: groom progress bar waiting text, token balance (two-key singular/plural pattern), earned counter, earn button aria-label and text, shop header/empty/aria-label/cost-badge/spend-aria-label/spend-btn, balances header/aria-label/empty, actions header/aria-label/empty heading/body, lobby waiting message, recap label/progress, reward overlay label, and spend reject toast.

## Verification

- **Task 1:** `node` validation exits 0 — all required keys present, total 147 keys.
- **Task 2:** `grep` returns zero matches for hardcoded strings in groom/+page.svelte.
- **Task 3:** `grep` returns zero matches for hardcoded strings in party/+page.svelte.
- **Build:** `npm run build` exits 0. Paraglide generated typed message functions for all new keys; both route files compile without TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All extracted strings are wired to Paraglide message functions in en.json. User-authored content (player names, chapter names, power-up names, rewards) renders directly from game state as intended (I18N-04 compliant).

## Self-Check: PASSED

Files verified:
- FOUND: messages/en.json
- FOUND: src/routes/groom/+page.svelte
- FOUND: src/routes/party/+page.svelte

Commits verified:
- FOUND: 8394d88 (feat(12-02): add groom + party strings to messages/en.json)
- FOUND: bbfc27d (feat(12-02): replace hardcoded strings in groom view with m.*() calls)
- FOUND: d0394d0 (feat(12-02): replace hardcoded strings in party view with m.*() calls)
