---
phase: 12-string-catalog
plan: 05
subsystem: i18n
tags: [i18n, string-catalog, translations, paraglide]
dependency_graph:
  requires: [Phase 12 plans 01-04 (en.json complete + user translations provided)]
  provides: [messages/ca.json complete, messages/es.json complete, test stub removed, Phase 12 complete]
  affects: [messages/ca.json, messages/es.json, messages/en.json, src/routes/+page.svelte]
tech_stack:
  added: []
  patterns: [Paraglide v2 message catalog, key parity verification]
key_files:
  created: []
  modified:
    - messages/ca.json
    - messages/es.json
    - messages/en.json
    - src/routes/+page.svelte
decisions:
  - "test_locale_active stub key removed from all three catalogs (Phase 11 verification purpose satisfied)"
  - "Phase 11 locale picker stub block removed from +page.svelte (locale/setLocale import also removed — only used by stub)"
  - "146 keys in all three catalogs — perfect parity, zero missing translations"
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_modified: 4
  completed_date: "2026-04-28"
---

# Phase 12 Plan 05: Translation Catalogs Summary

Catalan and Spanish translation catalogs wired into messages/ca.json and messages/es.json. Phase 11 test stub removed. Phase 12 complete.

## Objective

Wire user-provided translations into ca.json and es.json, remove the Phase 11 test_locale_active stub from all three catalogs and from +page.svelte, and run final build + key-parity verification.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Write ca.json and es.json from approved translations | 94034e8 | messages/ca.json, messages/es.json |
| 2 | Remove test_locale_active from en.json; remove Phase 11 stub block from +page.svelte | 94034e8 | messages/en.json, src/routes/+page.svelte |
| 3 | Final build + key parity audit | — | — |

## Key Changes

### messages/ca.json
- 146 Catalan translations covering all keys from en.json
- Covers join_*, landscape_*, reconnect_*, memory_*, trivia_*, scavenger_*, radial_*, reward_*, groom_*, party_*, admin_dash_*, admin_setup_* prefixes

### messages/es.json
- 146 Spanish translations covering all keys from en.json
- Same key set as ca.json

### messages/en.json
- Removed `test_locale_active` key (Phase 11 verification stub — purpose satisfied)
- Final key count: 146

### src/routes/+page.svelte
- Removed Phase 11 locale picker stub block (fixed-position div with 3 locale buttons)
- Removed unused `import { locale, setLocale }` — only referenced in the stub block

## Verification

### Build Check
`npm run build` exits 0. Paraglide compiles all 146 keys across three catalogs without errors.

### Key Parity
```
en.json keys: 146
ca.json keys: 146 | missing: 0
es.json keys: 146 | missing: 0
Extra in ca (not in en): []
Extra in es (not in en): []
```

### Hardcoded String Audit
Full scan of src/routes/ and src/lib/ — no unextracted UI strings. Remaining grep matches are error-code comparisons in JS logic and HTML/CSS comments.

## Self-Check: PASSED
