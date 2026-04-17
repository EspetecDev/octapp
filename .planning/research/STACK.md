# Stack Research: v1.3 Localization (i18n)

**Project:** octapp — Bachelor Party Game
**Milestone:** v1.3 — Localization (ca / es / en)
**Researched:** 2026-04-17
**Confidence:** HIGH
**Scope:** i18n library selection and integration only — existing stack (SvelteKit 5, Bun WS, Tailwind v4, Railway) is validated and not re-examined here.

---

## Verdict: Use Paraglide JS 2.x with `localStorage` strategy

The one library worth installing for this use case is `@inlang/paraglide-js`. It is the only i18n library in the SvelteKit ecosystem that is compiler-based, framework-agnostic in v2, works cleanly with SSR disabled, and requires zero server hooks when URL routing is not needed.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@inlang/paraglide-js` | `^2.16.0` | i18n compiler + runtime + Vite plugin | Compiler emits tree-shakable message functions — only used strings are bundled. Type-safe (typos = compile errors). No runtime key-lookup overhead. Works with CSR-only routes. Single package — no separate adapter needed in v2. |

### Supporting Libraries

None. The Paraglide Vite plugin is bundled inside `@inlang/paraglide-js` as of v2. No separate `@inlang/paraglide-sveltekit` or `@inlang/paraglide-vite` package is needed.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Svelte CLI: `sv add paraglide` | One-shot scaffold | Generates `project.inlang/settings.json`, Vite plugin config, translation message stubs, and optional demo page. Use this as the init step. |
| VS Code inlang extension | IDE autocomplete for message keys | Optional but highly recommended — surfaces missing translations inline. |

---

## Installation

```bash
# Single runtime + build-time dependency
bun add @inlang/paraglide-js

# OR use Svelte CLI to scaffold everything at once (recommended for first setup)
npx sv add paraglide
```

The `sv add paraglide` command is the fastest path: it writes `project.inlang/settings.json`, patches `vite.config.ts`, updates `src/app.html` with `lang` / `dir` attributes, and creates `src/lib/paraglide/` output stubs.

---

## Configuration Reference

### `project.inlang/settings.json`

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "sourceLanguageTag": "en",
  "languageTags": ["en", "ca", "es"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/lint-rule-missing-translation/dist/index.js"
  ]
}
```

`sourceLanguageTag: "en"` is the canonical base locale. Message files that are missing a key in `ca` or `es` will surface a lint warning from the `lint-rule-missing-translation` module.

### `vite.config.ts` (patch to existing config)

```typescript
import { paraglideVitePlugin } from "@inlang/paraglide-js/vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      // SSR disabled on game routes — localStorage is the correct persistence target.
      // No URL strategy needed: per-device locale, not URL-encoded locale.
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
  ],
});
```

### Translation files

Generated into `messages/en.json`, `messages/ca.json`, `messages/es.json`. Format is flat JSON:

```json
// messages/en.json
{
  "join_title": "Join the game",
  "join_enter_code": "Enter your code"
}
```

Message functions are auto-generated into `src/lib/paraglide/messages.js`. Import and call as:

```typescript
import * as m from "$lib/paraglide/messages.js";
// ...
m.join_title()         // "Join the game" (current locale)
m.join_title({ locale: "ca" })  // force a specific locale
```

---

## How Locale Detection and Persistence Work

Paraglide evaluates strategies left-to-right and stops at the first that returns a valid locale.

| Strategy | Behavior |
|----------|----------|
| `localStorage` | Reads `paraglide:locale` key from `window.localStorage`. Browser-only — skipped transparently on server. |
| `preferredLanguage` | Reads `navigator.languages` (browser language setting). Good first-visit fallback without requiring user action. |
| `baseLocale` | Returns `"en"` — terminal fallback, always succeeds. |

For this app (SSR disabled on all game routes, no URL-based routing, per-device locale choice), the strategy `["localStorage", "preferredLanguage", "baseLocale"]` is the correct and minimal chain.

### Switching locale in the UI

```typescript
import { setLocale } from "$lib/paraglide/runtime.js";

// Default: triggers page reload (simplest, no hydration issues)
setLocale("ca");

// Without reload: requires manual reactive re-render signal
setLocale("ca", { reload: false });
```

For a phone-first game where locale is set once on the join screen, using the default (`reload: true`) is the right call. The join screen reloads; all subsequent game views render in the chosen locale from localStorage.

### Persistence flow

```
User picks "Català" on join screen
  → setLocale("ca")                     // writes "ca" to localStorage["paraglide:locale"]
  → page reloads
  → Paraglide reads localStorage on next boot
  → getLocale() === "ca" for all components
```

Each device has its own localStorage. Per-device locale is the default behavior with no extra work.

---

## Fallback Chain: ca → en, es → en

Paraglide's fallback for **missing message keys** (i.e., a key exists in `en.json` but is absent from `ca.json`) works at the **locale-selection level**, not the message level.

**How it actually works:** The compiler generates a function for every key in the base locale (`en`). For non-base locales, if a key is missing from `ca.json`, the generated function emits the `en` string at build time as the fallback value. This means:
- There is no runtime lookup failure — the function always returns a string.
- Missing `ca` or `es` translations silently fall back to `en` text.
- The `lint-rule-missing-translation` module flags these at build/dev time so they are visible.

**Configure source language as base locale:**
```json
"sourceLanguageTag": "en"
```
All locales inherit from `en`. There is no separate `ca → en → undefined` runtime chain to configure; it is baked in by the compiler.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@inlang/paraglide-js` | `svelte-i18n` | If you need ICU MessageFormat syntax (plurals with `{count, plural, ...}`) or are migrating an existing svelte-i18n project. Bundle is larger (runtime dictionary lookup vs compiled functions). Works fine with SSR disabled. |
| `@inlang/paraglide-js` | `i18next` + `i18next-svelte` | If you need a battle-tested library with rich plugin ecosystem (namespaces, back-end loaders, etc.). Overkill for a 3-locale, 1-event app. No first-class SvelteKit 5 integration. |
| `@inlang/paraglide-js` | `typesafe-i18n` | Predecessor pattern; Paraglide supersedes it for SvelteKit. Active development has moved to Paraglide. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@inlang/paraglide-sveltekit` (v1 adapter) | Deprecated. Last published >1 year ago (v0.16.1). Replaced by the Vite plugin built into `@inlang/paraglide-js` v2. | `@inlang/paraglide-js` v2 directly |
| `@inlang/paraglide-js-adapter-sveltekit` | Same package, same deprecation. | `@inlang/paraglide-js` v2 |
| URL-based locale routing (`/ca/join`, `/es/join`) | Adds routing complexity with no benefit for a per-device locale model. The SvelteKit SSR middleware (`paraglideMiddleware`) is only needed for URL strategy. | `strategy: ["localStorage", ...]` — no server hooks required |
| `paraglideMiddleware()` in `hooks.server.ts` | Only required for URL-based locale routing. Since game routes have SSR disabled and locale is per-device via localStorage, server middleware is unnecessary. | Skip server hooks entirely |
| `reroute` hook in `hooks.ts` | Only required when URL paths are locale-prefixed. Not applicable here. | Skip reroute hook |

---

## Stack Patterns by Variant

**If locale is per-device only (this app):**
- Strategy: `["localStorage", "preferredLanguage", "baseLocale"]`
- No server hooks, no URL routing changes
- `setLocale()` on join screen with default `reload: true`
- Zero server-side changes

**If URL routing were needed (not this app):**
- Strategy: `["url", "cookie", "baseLocale"]`
- Requires `paraglideMiddleware()` in `hooks.server.ts`
- Requires `reroute` hook in `hooks.ts` with `deLocalizeUrl()`
- `paths: { relative: false }` in `svelte.config.js` to prevent locale-prefixed 404s on assets

---

## SSR-Disabled Constraint

`ssr: false` on game routes has no negative interaction with Paraglide v2. The `localStorage` strategy documentation explicitly states: "This strategy is browser-only. On the server, localStorage is skipped and the next strategy is used instead." Since SSR is disabled on all game routes in this app, the server never runs for those routes — the browser is the only execution context, so localStorage works unconditionally.

The only file that touches the server in a Paraglide setup using the URL strategy would be `hooks.server.ts`. Since we use localStorage strategy, no `hooks.server.ts` changes are needed at all.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@inlang/paraglide-js` | `^2.16.0` | SvelteKit 5, Svelte 5 runes, Vite 5+ | v2.0 released 2024. v2.16.0 published April 2026. Actively maintained. |
| Vite plugin | bundled in `@inlang/paraglide-js/vite` | Vite 5+ | No separate install. Import from `@inlang/paraglide-js/vite`. |
| `@inlang/paraglide-sveltekit` | 0.16.1 (v1 era) | SvelteKit 4, NOT recommended for v5 | Deprecated. Do not install. |

---

## Sources

- [Paraglide JS — inlang official docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) — library overview, version, features (HIGH)
- [Paraglide JS Strategy docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy) — localStorage, preferredLanguage, baseLocale strategies; SSR fallback behavior (HIGH)
- [Paraglide JS Basics docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) — setLocale, getLocale, reload option (HIGH)
- [Svelte CLI paraglide docs](https://svelte.dev/docs/cli/paraglide) — `sv add paraglide` scaffold, generated files (HIGH)
- [Paraglide JS SvelteKit docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit) — hooks, app.html, strategy config (HIGH)
- [@inlang/paraglide-js on npm](https://www.npmjs.com/package/@inlang/paraglide-js) — latest version 2.16.0, published 2 days ago (HIGH)
- [@inlang/paraglide-sveltekit on npm](https://www.npmjs.com/package/@inlang/paraglide-sveltekit) — v0.16.1, last published >1 year ago, confirms deprecated (HIGH)
- [SvelteKit Paraglide 2.0 Migration guide](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/) — confirms adapter removal, Vite plugin unification (MEDIUM — community blog, verified against official docs)
- [opral/paraglide-js GitHub](https://github.com/opral/paraglide-js) — source, examples, issue tracker (HIGH)

---

*Stack research for: i18n / localization, SvelteKit 5 + Svelte 5 runes, SSR-disabled routes*
*Milestone: v1.3*
*Researched: 2026-04-17*
