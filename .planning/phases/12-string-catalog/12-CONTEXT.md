# Phase 12: String Catalog - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract every static UI string across all 5 routes (join, party, groom, admin dashboard, admin setup) and 7 shared components (LandscapeOverlay, ReconnectingOverlay, MemoryMinigame, TriviaMinigame, ScavengerScreen, RadialCountdown, RewardScreen) into `messages/en.json`, then wire Catalan and Spanish translations in `messages/ca.json` and `messages/es.json`. No hardcoded UI strings remain in any `.svelte` file after this phase. Language picker UI is Phase 13; multi-device verification is Phase 14.

</domain>

<decisions>
## Implementation Decisions

### Translation Ownership
- **D-01:** User (Manel) writes the ca/es translations. Executor extracts all English strings first, commits `messages/en.json`, then pauses at a **human checkpoint** for the user to provide native Catalan and Spanish translations before wiring them into `messages/ca.json` and `messages/es.json`. Do not auto-generate or draft ca/es strings — wait for user input at the checkpoint.

### Extraction Scope
- **D-02:** All three layers must be extracted — no exceptions:
  1. **Template HTML text** — visible body text in markup (e.g., `>Join the game<`)
  2. **`placeholder` and `aria-label` attributes** — e.g., `placeholder="Your name"`, `aria-label="Submit"`
  3. **Programmatic strings in script blocks** — error messages, toast text, and WebSocket handler strings assigned in JavaScript (e.g., `submitError = "Connection timed out. Try again."`)
- **D-03:** User-authored content (chapter names, trivia questions, scavenger clues, reward text, player names) is excluded from the catalog and renders directly from game state as-is. This was decided in REQUIREMENTS.md I18N-04 and does not change.

### Plan Chunking
- **D-04:** Extraction is split into **3-4 plans batched by theme** — not view-by-view and not a single big pass. Suggested grouping:
  - **Batch 1** — Join page + all shared components (LandscapeOverlay, ReconnectingOverlay, MemoryMinigame, TriviaMinigame, ScavengerScreen, RadialCountdown, RewardScreen)
  - **Batch 2** — Groom view + Party/group view
  - **Batch 3** — Admin dashboard + Admin setup
  - **Human checkpoint** — after all batches: user provides ca/es translations for the complete `en.json`
  - **Batch 4** — Wire ca/es translations into `ca.json` and `es.json`, remove Phase 11 stub key, verify no missing keys
- The planner may adjust batch boundaries if file sizes make a different split more natural, but the 3-batch extraction + 1 translation wiring structure is the target.

### Claude's Discretion
- Message key naming convention (flat with view-prefix snake_case, e.g., `join_name_placeholder`, vs nested JSON by view) — choose the convention that Paraglide v2 generates/expects by default and is most readable in the JSON files
- Where components import message functions from (direct `$lib/paraglide/messages.js` vs a re-export wrapper) — use whatever is most consistent with how Paraglide v2 scaffolds usage in the project

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §String Catalog — I18N-01 through I18N-04 define acceptance criteria for this phase

### Phase 11 Decisions (carry forward)
- `.planning/phases/11-i18n-infrastructure/11-CONTEXT.md` — locale module shape, localStorage key pattern, Paraglide v2 decisions (D-01 through D-08)

### Existing Code Integration Points
- `messages/en.json` — currently contains only Phase 11 stub (`test_locale_active`); this phase replaces it with the full catalog
- `messages/ca.json`, `messages/es.json` — currently stubs; this phase fills them with full translations
- `src/lib/i18n/locale.svelte.ts` — locale state module; message functions are separate from locale state
- `src/routes/+page.svelte` (349 lines) — join wizard, highest-priority extraction target
- `src/routes/party/+page.svelte` (743 lines) — largest file; includes token economy UI and power-up shop
- `src/routes/groom/+page.svelte` (305 lines)
- `src/routes/admin/+page.svelte` (258 lines) — admin dashboard
- `src/routes/admin/setup/+page.svelte` (627 lines) — admin setup
- `src/lib/LandscapeOverlay.svelte`, `src/lib/ReconnectingOverlay.svelte` — shared overlays
- `src/lib/components/MemoryMinigame.svelte`, `TriviaMinigame.svelte`, `ScavengerScreen.svelte`, `RadialCountdown.svelte`, `RewardScreen.svelte` — game components

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/i18n/locale.svelte.ts` `setLocale()` — already handles Paraglide locale switching; message functions are independent of this module
- Phase 11 stub keys in `messages/en.json` — remove `test_locale_active` when replacing with real catalog

### Established Patterns
- **localStorage key convention**: `octapp:${key}` — not directly relevant to string extraction but confirms established naming discipline
- **Svelte 5 runes**: codebase uses `$state`, `$derived` — message function calls fit naturally in reactive expressions
- **SSR globally disabled**: `export const ssr = false` in `+layout.ts` — no hydration concerns for message function calls

### Integration Points
- Every `.svelte` file in `src/routes/` and `src/lib/` that contains visible UI text, placeholder, aria-label, or programmatic string assignment is an extraction target
- `messages/` directory already scaffolded by Paraglide v2 with en/ca/es stubs

</code_context>

<specifics>
## Specific Ideas

- Human checkpoint after English extraction: executor commits `messages/en.json` (complete), then explicitly asks user to provide ca/es translations before continuing
- Suggested audit step during extraction: `grep -r '"[A-Z]' src/ --include="*.svelte"` to find remaining hardcoded strings after each batch
- Phase 11 stub key `test_locale_active` must be removed from all three catalogs when real strings are added

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-string-catalog*
*Context gathered: 2026-04-27*
