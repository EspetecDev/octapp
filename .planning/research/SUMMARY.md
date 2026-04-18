# Project Research Summary

**Project:** octapp — Bachelor Party Game
**Domain:** Retrofitting i18n / localization (Catalan / Spanish / English) into an existing SvelteKit 5 + Svelte 5 runes SPA
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

The v1.3 milestone is a localization retrofit onto a working, SSR-disabled SvelteKit 5 SPA. The scope is tightly bounded: add per-device language selection (EN / CA / ES) using `localStorage` persistence, extract all static UI strings into a message catalog, and wire every view to render strings from that catalog. The server (Bun WebSocket) is untouched — locale is a 100% client-side concern. This constraint simplifies the problem significantly: no server hooks, no cookie syncing, no URL routing changes.

The recommended library is `@inlang/paraglide-js` v2. It is the only option in the SvelteKit ecosystem that emits compiled, tree-shakable, type-safe message functions — typos in keys are compile errors, unused strings are not bundled, and there is zero runtime key-lookup overhead. The correct locale strategy for this app is `["localStorage", "preferredLanguage", "baseLocale"]` — no server middleware, no URL strategy. The deprecated `@inlang/paraglide-sveltekit` v1 adapter must be avoided; the Vite plugin is now bundled inside `@inlang/paraglide-js` v2 directly.

The primary risk is not the library — it is implementation correctness in three areas. First, locale state must be a Svelte 5 `$state` rune (in a `.svelte.ts` singleton), not a plain variable, or components will render stale translations after locale switches. Second, `initLocale()` must be called inside `onMount` (not at module load time) to avoid `localStorage is not defined` errors during `vite build`. Third, string extraction must cover `aria-label` attributes, `placeholder` attributes, and programmatically-built strings (WebSocket error handlers, toast messages) — not just visible template text. All six critical pitfalls map cleanly to two phases: Infrastructure and String Extraction.

## Key Findings

### Recommended Stack

The only new dependency is `@inlang/paraglide-js ^2.16.0`. The Vite plugin ships inside it. No separate adapter, no separate runtime package. The existing stack (SvelteKit 5, Svelte 5 runes, Tailwind v4, Bun WebSocket, Railway) is validated and requires no changes except patching `vite.config.ts`, `svelte.config.js`, and `src/app.html`.

**Core technologies:**
- `@inlang/paraglide-js ^2.16.0`: i18n compiler + runtime + Vite plugin — compiler-based, type-safe, tree-shakable; only correct option for SvelteKit 5 + SSR-disabled routes
- `sv add paraglide` (Svelte CLI): scaffold tool — generates project config, Vite plugin config, message stubs, and `app.html` patches in one command
- Strategy `["localStorage", "preferredLanguage", "baseLocale"]`: correct for per-device locale in a CSR-only app; no server hooks, no URL routing

**Do not install:**
- `@inlang/paraglide-sveltekit` (deprecated v1 adapter — last published over 1 year ago)
- Any URL-based strategy or `paraglideMiddleware()` in `hooks.server.ts` (not applicable to this static SPA)

### Expected Features

**Must have (table stakes) — all P1 for v1.3:**
- Language picker on the join screen — 3 pill buttons showing native names: "English · Català · Español" (not flags, not ISO codes)
- Locale written to `localStorage` on selection and read on mount — persists through refreshes
- All static UI strings extracted from all views (join, groom, party, admin dashboard, admin setup, shared components) into `messages/en.json`, `ca.json`, `es.json`
- All views render strings from the message catalog — no hardcoded strings remaining
- English fallback for any key missing in CA or ES — silent, never exposes raw keys to players
- Locale is per-device only — NOT sent over WebSocket, NOT in server game state

**Should have — P2 (low effort, add in same milestone):**
- `navigator.language` auto-detection as first-visit default
- In-game language switcher from party/group view header

**Defer (v2+):**
- Locale-aware pluralization ("1 punt / 2 punts") — informal phrasing is acceptable for a party game
- Locale-aware number formatting — not relevant at this score scale

**Anti-features (explicitly excluded):**
- URL-based locale routing — adds complexity, conflicts with existing join-code flow, causes production 404s with `adapter-static` (confirmed Paraglide issue #503)
- Translating user-authored content (chapter names, trivia, clue text, reward text)
- Flag icons as locale identifiers
- External translation management platform

### Architecture Approach

The architecture introduces a single new module — `src/lib/i18n/locale.svelte.ts` — that owns all locale state, localStorage persistence, and the wrapper around Paraglide's `setLocale()`. Every component imports from this module (never from Paraglide runtime directly). Message functions from the compiled `src/lib/paraglide/messages.js` are called inline in templates as `m.key()`. Reactivity is driven by the `$state` locale variable in the module: when locale changes, Svelte 5 invalidates all components that read it, causing `m.key()` calls to re-execute. The Bun WebSocket server and all socket/state types are completely untouched.

**Major components:**
1. `src/lib/i18n/locale.svelte.ts` — reactive `$state` locale, `initLocale()` (reads localStorage), `setLocale()` (writes localStorage + calls Paraglide), `onSetLocale` sync hook
2. `messages/en.json`, `ca.json`, `es.json` — source-of-truth string catalogs; `en` is base/fallback locale
3. `src/lib/paraglide/` (compiler output) — generated `messages.js` (typed `m.key()` functions) and `runtime.js`; not hand-edited
4. `src/routes/+layout.svelte` — calls `initLocale()` inside existing `onMount`; no new DOM nodes
5. Join page `+page.svelte` — language picker UI (3 pill buttons); primary locale-change entrypoint
6. All route pages + shared components — modified to replace hardcoded strings with `m.*` calls

### Critical Pitfalls

1. **Locale state must be `$state`, not a plain variable** — If locale is stored in a non-reactive variable, components freeze at the first render value and never update. Declare `let locale = $state<SupportedLocale>('en')` in the `.svelte.ts` module and wire via `onSetLocale()`. Verify in Infrastructure phase.

2. **`initLocale()` must be called inside `onMount`, not at module load time** — Vite evaluates modules in Node.js during `vite build` even with `ssr = false`; `localStorage` is not defined there. Top-level `localStorage` calls throw `ReferenceError` at build time. Guard with `onMount`.

3. **URL-based locale strategy causes production 404s with `adapter-static`** — Paraglide issue #503 (open, unresolved): static adapter + SPA mode + URL strategy generates incorrect `modulepreload` paths that 404 in production. Use only `["localStorage", "preferredLanguage", "baseLocale"]`.

4. **Under-extraction: `aria-label`, `placeholder`, and programmatic strings are invisible to visual scans** — These are the most common missed strings. Run `grep -r 'aria-label\|placeholder\|toast\|announce'` as a final audit before marking extraction complete. Join screen name input placeholder and WebSocket error handler strings are confirmed high-risk locations.

5. **Over-extraction: user-authored content must NOT enter the catalog** — Chapter names, trivia questions, scavenger clues, reward text, and player names come from game state. Wrapping them in translation calls adds noise and breaks catalog clarity. Establish the boundary rule before extraction begins.

6. **FOUC (Flash of Wrong Locale) on first load** — The app may paint in English for one frame before reading the stored locale. Fix: add an inline `<script>` in `app.html` that reads `localStorage` synchronously and sets `window.__initialLocale` before the SPA boots. Bundle all three catalogs statically — combined size is under 10KB, lazy loading adds complexity with no benefit.

## Implications for Roadmap

The work naturally partitions into 4 phases following the dependency chain from ARCHITECTURE.md. Infrastructure must pass before strings can be extracted; extraction must be complete before translation produces value; translation must be verified across devices before the milestone ships.

### Phase 1: i18n Infrastructure

**Rationale:** Everything else depends on this. Library, Vite plugin config, locale state module, and `onMount` initialization must be proven correct before a single string is extracted. Getting the reactivity model wrong here requires rewriting all downstream work.
**Delivers:** Working locale switching on a stub join screen — all 3 locales render, localStorage persists through refresh, no FOUC, no build errors.
**Addresses:** Language picker mechanism, localStorage persistence, English fallback wiring
**Avoids:** Pitfalls 1 (non-reactive locale state), 2 (module-load localStorage access), 3 (URL strategy 404s), 6 (FOUC)

### Phase 2: String Extraction and Translation

**Rationale:** Can only begin once infrastructure is proven. Must be exhaustive — partial extraction produces a worse UX than no localization (some strings update, others do not). The English catalog must be complete before CA and ES translations begin, to prevent key drift.
**Delivers:** Complete `en.json`, `ca.json`, `es.json` covering all 5 routes + shared components; no hardcoded UI strings remaining.
**Addresses:** All static UI string rendering in chosen locale; English fallback for missing keys
**Avoids:** Pitfalls 4 (under-extraction of aria-labels/placeholders/toasts), 5 (over-extraction of user content)

### Phase 3: Language Picker UI

**Rationale:** The picker is the sole user-facing entrypoint and must meet specific mobile UX requirements. It can be developed in parallel with Phase 2 but must be complete and verified before Phase 4.
**Delivers:** 3-pill language picker on the join screen; filled active state on selected locale; `navigator.language` auto-detection as first-visit default.
**Addresses:** Language picker (P1), native language name display (P1), browser auto-detection (P2)
**Avoids:** UX pitfall of using ISO codes or flags; pitfall of page-reload-on-switch losing join form state

### Phase 4: Multi-Device Verification

**Rationale:** Per-device locale isolation is a correctness requirement. A bug where locale leaks into WebSocket state would be a game integrity regression. Verification requires a production build (not just dev server) on actual iOS Safari and Android Chrome.
**Delivers:** All 9 items from the "Looks Done But Isn't" checklist confirmed passing across iOS and Android.
**Addresses:** Per-device locale isolation, accessibility (`html lang` attribute update), catalog completeness parity check
**Avoids:** Silent locale-in-WebSocket regression; missed `aria-label` translations invisible to visual review

### Phase Ordering Rationale

- Infrastructure before extraction: Paraglide's TypeScript integration makes every key in `en.json` a compile-time type. Adding keys before the compiler plugin is configured means no type safety during extraction.
- English catalog before translated catalogs: `ca.json` and `es.json` must mirror `en.json` key structure exactly. Producing English first, then duplicating and translating, avoids key drift and makes the catalog completeness check trivial.
- Phase 3 (picker) can overlap Phase 2 (extraction): the picker component only needs `setLocale()` to work — it has no dependency on specific message keys. These two phases can be parallelized if bandwidth allows.
- Verification last: device testing requires a passing `vite build` with all catalogs complete — not achievable until Phases 1-3 are done.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1 (Infrastructure):** Paraglide v2 docs are complete and current. The `.svelte.ts` `$state` pattern and `onMount` guard are fully specified. Standard work.
- **Phase 3 (Language Picker UI):** Mobile UX patterns for 3-option pickers are well established. Tailwind v4 handles pill/tab layout. No novel decisions required.
- **Phase 4 (Multi-Device Verification):** The complete verification checklist is specified in PITFALLS.md. Execute, do not research.

Phases that benefit from brief phase-level research:
- **Phase 2 (String Extraction):** The exact set of strings across this app's 5 routes and 7+ shared components is unknown until source files are read. A brief audit pass at the start of Phase 2 to enumerate all translation surface area (including dynamic/programmatic strings) is recommended before writing the implementation plan.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Paraglide v2.16.0 confirmed on npm (published 2026-04-15). Deprecation of v1 adapter confirmed. Vite plugin bundling confirmed in official docs and migration guide. |
| Features | HIGH | Language picker UX from Smashing Magazine + SimpleLocalize. localStorage from MDN. Paraglide strategy from official docs. Game-specific patterns derived from confirmed app architecture. |
| Architecture | HIGH | All patterns verified against Paraglide v2 official docs + Svelte 5 runes model. Anti-pattern (URL strategy 404) backed by open GitHub issue #503. |
| Pitfalls | HIGH | Reactivity traps from Svelte 5 official docs + community issue analysis. FOUC pattern from recent source (2026-03-11). ICU plural edge cases MEDIUM but low impact — pluralization deferred to v2+. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact string count and surface area:** Unknown until Phase 2 audit. Estimate is 100-150 keys. If significantly larger, Phase 2 should be split into extraction (own phase) and translation (separate phase) to keep phase scope manageable.
- **Catalan translation quality:** Research did not assess translation quality — only catalog structure. If developer Catalan fluency is limited, a native review pass before the event date should be planned. This is an execution gap, not a research gap.
- **ICU pluralization deferral is a known trade-off:** Score/token strings will use informal phrasing ("2 punts" without grammatical agreement) in v1.3. If the event host requests correct plural grammar before the event, Phase 2 scope expands to include ICU format strings in CA/ES catalogs.

## Sources

### Primary (HIGH confidence)
- [Paraglide JS — inlang official docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) — library overview, version, features
- [Paraglide JS Strategy docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy) — localStorage, preferredLanguage, baseLocale strategies
- [Paraglide JS Basics docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) — setLocale, getLocale, reload option
- [Svelte CLI paraglide docs](https://svelte.dev/docs/cli/paraglide) — `sv add paraglide` scaffold
- [Paraglide JS SvelteKit docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit) — hooks, app.html, strategy config
- [@inlang/paraglide-js on npm](https://www.npmjs.com/package/@inlang/paraglide-js) — v2.16.0 confirmed current
- [@inlang/paraglide-sveltekit on npm](https://www.npmjs.com/package/@inlang/paraglide-sveltekit) — v0.16.1 deprecated confirmed
- [opral/paraglide-js GitHub](https://github.com/opral/paraglide-js) — issue #503: static adapter + URL strategy causes 404s
- [Svelte docs — stores](https://svelte.dev/docs/svelte/stores) — store/rune interop model
- [Smashing Magazine — designing better language selector](https://www.smashingmagazine.com/2022/05/designing-better-language-selector/) — picker UX best practices
- [SimpleLocalize — flags in language selectors](https://simplelocalize.io/blog/posts/flags-as-language-in-language-selector/) — why to avoid flags
- [CLDR Language Plural Rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html) — Spanish/Catalan plural rules

### Secondary (MEDIUM confidence)
- [SvelteKit Paraglide 2.0 Migration guide](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/) — confirms adapter removal, Vite plugin unification (community blog, consistent with official docs)
- [CoMiGo Games — i18n for Svelte 5](https://comigo.games/en/n/i18n-library-for-svelte5/) — rune-native i18n pattern
- [David Bushell — SvelteKit i18n and FOWL](https://dbushell.com/2026/03/11/sveltekit-internationalization-flash-of-wrong-locale/) — FOUC/FOWL inline script pattern
- [Mainmatter — global state in Svelte 5](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/) — store/rune interop analysis
- [Shopify Engineering — i18n best practices for frontend](https://shopify.engineering/internationalization-i18n-best-practices-front-end-developers) — game-specific i18n patterns

---
*Research completed: 2026-04-17*
*Ready for roadmap: yes*
