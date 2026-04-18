# Phase 11: i18n Infrastructure - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Install `@inlang/paraglide-js` v2, wire a reactive locale state module, configure localStorage persistence and browser auto-detection, and prevent flash of wrong locale — all proven working with a temporary verification stub on the join page. No string extraction happens here (Phase 12). No production picker UI (Phase 13). Only the infrastructure must be proven correct before any other localization work begins.

</domain>

<decisions>
## Implementation Decisions

### Setup Approach
- **D-01:** Use `npx sv add paraglide` scaffold to install — it generates `project.inlang/settings.json`, patches `vite.config.ts`, adds message stubs, and updates `app.html`. Override any scaffold choices that conflict with the SSR-disabled config (URL strategy must NOT be selected during scaffold prompts).
- **D-02:** Locale module lives at `src/lib/i18n/locale.svelte.ts` — own subdirectory under `src/lib/i18n/` for the full i18n module family.
- **D-03:** `localStorage` key for locale is `octapp:locale` — consistent with existing `octapp:playerId` and `octapp:sessionCode` pattern.

### FOUC Prevention
- **D-04:** Inline `<script>` in `app.html` sets **both** `html[lang]` and `window.__initialLocale` synchronously before the SPA boots. The locale module reads `window.__initialLocale` in `initLocale()` so it doesn't need a second `localStorage` read.
- **D-05:** No CSS class or `data-locale-ready` attribute — Paraglide renders catalog strings synchronously once locale is set; no layout shift expected and no content hiding needed.

### Locale Module
- **D-06:** `locale.svelte.ts` exposes a `$state` rune as the reactive locale signal. Components import `locale` from `src/lib/i18n/locale.svelte.ts` (never from Paraglide runtime directly). `initLocale()` called inside `onMount` in `+layout.svelte` alongside `createSocket()`.
- **D-07:** On first visit (no stored `octapp:locale`), auto-detect from `navigator.language` and match to nearest supported locale (ca → ca, es → es, everything else → en).

### Verification Stub
- **D-08:** A temporary 3-button locale toggle strip is added to the **bottom** of `+page.svelte` (join page), outside the form, clearly marked with a comment for removal in Phase 13. It proves locale reactivity works visually with real strings before the real picker is built.

### Claude's Discretion
- Exact Paraglide `onSetLocale` / `onSetLanguageTag` API name — confirm against generated `runtime.js` at install time; either is fine, use whichever the installed version exposes.
- Whether `setLocale()` call alone triggers Svelte 5 reactivity or whether an explicit `$state` assignment is needed in `locale.svelte.ts` — planner should implement the `$state` bridge pattern from ARCHITECTURE.md as the safe default.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §i18n Infrastructure — INFRA-01 through INFRA-05 define the acceptance criteria for this phase

### Research Outputs
- `.planning/research/STACK.md` — Paraglide v2 version, Vite plugin config, strategy options, deprecated packages to avoid
- `.planning/research/ARCHITECTURE.md` — locale.svelte.ts module shape, Svelte 5 $state reactivity pattern, app.html integration, integration points with existing code
- `.planning/research/PITFALLS.md` — Critical pitfalls: $state reactivity trap, initLocale() in onMount guard, URL strategy 404s, FOUC
- `.planning/research/SUMMARY.md` §Phase 1 — i18n Infrastructure section

### Existing Code Integration Points
- `src/routes/+layout.svelte` — `onMount` is where `initLocale()` goes (alongside `createSocket()`)
- `src/app.html` — receives the FOUC inline script and `html[lang]` dynamic attribute
- `src/routes/+layout.ts` — confirms `ssr = false; prerender = false` globally (localStorage is safe everywhere)
- `src/lib/socket.ts` — localStorage key pattern (`octapp:*`) for reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/socket.ts` `getStoredPlayerId()` / `getStoredSessionCode()` — exact pattern to follow for `getStoredLocale()` in the locale module (direct `localStorage.getItem` wrapped in a getter function)
- `src/routes/+layout.svelte` `onMount` block — existing hook where `createSocket()` is called; `initLocale()` goes here too

### Established Patterns
- **localStorage key convention**: `octapp:${key}` — use `octapp:locale`
- **Svelte 5 runes**: `+page.svelte` uses `$state`, `$derived` — locale module should follow same rune style
- **Mixed store/rune codebase**: `socket.ts` uses writable stores; `+page.svelte` uses runes — `locale.svelte.ts` should use runes since it's new code
- **SSR globally disabled**: `export const ssr = false` in `+layout.ts` — no hydration concerns; localStorage calls in `onMount` are safe unconditionally

### Integration Points
- `+layout.svelte` `onMount` → add `initLocale()` call
- `app.html` `<html lang="en">` → make dynamic: set by FOUC inline script + updated by locale module
- `+page.svelte` → temporary verification stub (bottom, outside form, marked for Phase 13 removal)

</code_context>

<specifics>
## Specific Ideas

- Temporary stub: 3 text buttons at the bottom of the join page — `[en] [ca] [es]` — small, unstyled, outside the main form. Comment: `<!-- TODO(Phase 13): replace with real language picker UI -->`
- FOUC inline script reads `localStorage.getItem("octapp:locale")`, validates against supported list `["en","ca","es"]`, falls back to `navigator.language` matching if null, then sets `document.documentElement.lang` and `window.__initialLocale`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-i18n-infrastructure*
*Context gathered: 2026-04-18*
