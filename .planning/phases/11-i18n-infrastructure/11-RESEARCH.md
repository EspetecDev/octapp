# Phase 11: i18n Infrastructure - Research

**Researched:** 2026-04-18
**Domain:** Paraglide JS v2 + SvelteKit 5 + Svelte 5 runes, SSR-disabled SPA
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `npx sv add paraglide` scaffold to install — it generates `project.inlang/settings.json`, patches `vite.config.ts`, adds message stubs, and updates `app.html`. Override any scaffold choices that conflict with the SSR-disabled config (URL strategy must NOT be selected during scaffold prompts).
- **D-02:** Locale module lives at `src/lib/i18n/locale.svelte.ts` — own subdirectory under `src/lib/i18n/` for the full i18n module family.
- **D-03:** `localStorage` key for locale is `octapp:locale` — consistent with existing `octapp:playerId` and `octapp:sessionCode` pattern.
- **D-04:** Inline `<script>` in `app.html` sets **both** `html[lang]` and `window.__initialLocale` synchronously before the SPA boots. The locale module reads `window.__initialLocale` in `initLocale()` so it doesn't need a second `localStorage` read.
- **D-05:** No CSS class or `data-locale-ready` attribute — Paraglide renders catalog strings synchronously once locale is set; no layout shift expected and no content hiding needed.
- **D-06:** `locale.svelte.ts` exposes a `$state` rune as the reactive locale signal. Components import `locale` from `src/lib/i18n/locale.svelte.ts` (never from Paraglide runtime directly). `initLocale()` called inside `onMount` in `+layout.svelte` alongside `createSocket()`.
- **D-07:** On first visit (no stored `octapp:locale`), auto-detect from `navigator.language` and match to nearest supported locale (ca → ca, es → es, everything else → en).
- **D-08:** A temporary 3-button locale toggle strip is added to the **bottom** of `+page.svelte` (join page), outside the form, clearly marked with a comment for removal in Phase 13. It proves locale reactivity works visually with real strings before the real picker is built.

### Claude's Discretion

- Exact Paraglide `onSetLocale` / `onSetLanguageTag` API name — confirm against generated `runtime.js` at install time; either is fine, use whichever the installed version exposes.
- Whether `setLocale()` call alone triggers Svelte 5 reactivity or whether an explicit `$state` assignment is needed in `locale.svelte.ts` — planner should implement the `$state` bridge pattern from ARCHITECTURE.md as the safe default.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | App builds and runs with `@inlang/paraglide-js` v2, three locales (en/ca/es) configured in `project.inlang/settings.json`, and English as the compile-time fallback locale | Standard Stack section: package install, `project.inlang/settings.json` config, Vite plugin config |
| INFRA-02 | A reactive `src/lib/i18n/locale.svelte.ts` module wraps Paraglide's `setLocale`/`getLocale` so all components source locale state from a single `$state` rune — never importing from Paraglide runtime directly | Architecture Patterns: Pattern 1 (locale.svelte.ts module), data flow diagrams, full code example |
| INFRA-03 | Active locale is written to `localStorage` on change and read back on mount, persisting the user's choice across page refreshes | Architecture Patterns: Pattern 3 (onMount init), localStorage key `octapp:locale`, code examples |
| INFRA-04 | On first visit (no stored locale), app auto-detects browser preferred language via `navigator.language` and applies nearest supported locale (ca/es/en) | Architecture Patterns: `detectLocale()` helper, navigator.language matching strategy |
| INFRA-05 | App prevents flash of wrong locale (FOUC) via an inline `<script>` in `app.html` that reads `localStorage` synchronously before the SPA boots | Architecture Patterns: FOUC prevention section, `app.html` inline script code example, `window.__initialLocale` bridge |
</phase_requirements>

---

## Summary

Phase 11 wires Paraglide JS v2 into the existing SvelteKit 5 SPA so locale switching works end-to-end before a single production string is extracted. The library choice is locked (`@inlang/paraglide-js ^2.16.0`), the locale strategy is locked (`localStorage → preferredLanguage → baseLocale`), and the module shape is specified in the existing research. No server touches are needed — this is a 100% client-side concern. SSR is globally disabled, eliminating hydration concerns.

The implementation has five sequentially-dependent steps: scaffold (install + configure), create the reactive locale module, wire initialization into `+layout.svelte`, add the FOUC inline script to `app.html`, and add the temporary verification stub to the join page. The most critical correctness constraint is that `initLocale()` is called inside `onMount` (not at module top-level) and that the `$state` rune bridge via `onSetLocale()` is in place so Svelte 5 reactivity propagates locale changes to all components.

The existing code is clean and ready for integration. `+layout.svelte` already has an `onMount` block calling `createSocket()` — `initLocale()` goes beside it. `socket.ts` establishes the `localStorage` key convention (`octapp:*`). `app.html` is minimal and has only a static `lang="en"` that must be replaced with the dynamic inline script.

**Primary recommendation:** Follow the five-step task sequence exactly — scaffold → locale module → layout wire → FOUC script → verification stub. Verify `vite build` succeeds at the end of each step before proceeding.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@inlang/paraglide-js` | `^2.16.0` | i18n compiler + runtime + Vite plugin | Compiler emits tree-shakable, type-safe message functions. Only correct choice for SvelteKit 5 + SSR-disabled routes. Single package — no separate adapter needed in v2. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sv` (Svelte CLI, `npx sv add paraglide`) | bundled with SvelteKit | Scaffold tool | First-time setup only — generates `project.inlang/settings.json`, Vite plugin config, message stubs, `app.html` patches |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@inlang/paraglide-js` | `svelte-i18n` | svelte-i18n uses Svelte stores (`$_`); does not compose with `$derived` runes in `.svelte.ts` files. Higher runtime overhead (dictionary lookup vs compiled functions). NOT suitable for this codebase. |
| `@inlang/paraglide-js` | Custom rune-native catalog | Could work (see PITFALLS.md Option B), but loses type-safety, lint-rule-missing-translation, and IDE integration. Only worthwhile if Paraglide has irreconcilable issues post-scaffold. |

### Installation

```bash
# Scaffold everything at once (recommended — generates all config files)
npx sv add paraglide
# When prompted for strategy: select localStorage only (NOT url, NOT cookie)
# When prompted for additional locales: add ca and es
```

The scaffold command patches `vite.config.ts`, creates `project.inlang/settings.json`, creates `messages/en.json` stub, and updates `src/app.html`. Review all scaffold changes for conflicts before proceeding.

**Do NOT install:**
- `@inlang/paraglide-sveltekit` — deprecated v1 adapter, last published >1 year ago
- Any separate `@inlang/paraglide-vite` package — the Vite plugin ships inside `@inlang/paraglide-js/vite`

---

## Architecture Patterns

### Recommended Project Structure (Phase 11 scope only)

```
src/
├── lib/
│   ├── i18n/
│   │   └── locale.svelte.ts    # NEW — reactive $state locale + initLocale() + setLocale()
│   ├── paraglide/              # NEW (compiler-generated by Vite plugin — do not hand-edit)
│   │   ├── messages.js         #   tree-shakable m.key() functions
│   │   ├── messages.d.ts       #   TypeScript types for all message keys
│   │   └── runtime.js          #   getLocale() / setLocale() / onSetLocale()
│   └── (socket.ts, types.ts, components/ — UNCHANGED)
├── routes/
│   ├── +layout.svelte          # MODIFIED — add initLocale() inside existing onMount
│   └── +page.svelte            # MODIFIED — add temporary verification stub at bottom
├── app.html                    # MODIFIED — add FOUC inline script, make lang dynamic
messages/                       # NEW — translation source files (scaffold creates en.json stub)
├── en.json
├── ca.json                     # Created in Phase 12; stub can be empty for now
└── es.json                     # Created in Phase 12; stub can be empty for now
project.inlang/                 # NEW — Paraglide project config (scaffold generates)
└── settings.json
vite.config.ts                  # MODIFIED — scaffold adds paraglideVitePlugin()
svelte.config.js                # MODIFIED — add paths: { relative: false }
```

### Pattern 1: Reactive Locale Module (`locale.svelte.ts`)

**What:** A `.svelte.ts` module owns all locale state as a `$state` rune. It wraps Paraglide's `setLocale()` with localStorage persistence and bridges Paraglide's `onSetLocale()` callback to Svelte 5 reactivity. Components import `locale` and `setLocale` exclusively from this module.

**When to use:** Always — every locale read and write goes through this file. Never import from `$lib/paraglide/runtime.js` in components.

**Implementation note (Claude's Discretion):** The exact callback name (`onSetLocale` vs `onSetLanguageTag`) must be confirmed against the generated `src/lib/paraglide/runtime.js` after scaffold runs. The pattern is the same either way — subscribe to Paraglide's internal locale change event and update the `$state` variable.

```typescript
// src/lib/i18n/locale.svelte.ts
import {
  setLocale as paraglideSetLocale,
  getLocale,
  onSetLocale          // or onSetLanguageTag — check generated runtime.js
} from '$lib/paraglide/runtime.js';

const LOCALE_KEY = 'octapp:locale';
const SUPPORTED = ['en', 'ca', 'es'] as const;
type SupportedLocale = typeof SUPPORTED[number];

// Reactive locale state — components read this value
export let locale = $state<SupportedLocale>(getLocale() as SupportedLocale);

// Keep $state in sync whenever Paraglide's internal locale changes
onSetLocale((next: string) => {
  locale = next as SupportedLocale;
});

// Called by components and the verification stub
export function setLocale(next: SupportedLocale): void {
  localStorage.setItem(LOCALE_KEY, next);
  document.documentElement.lang = next;   // keep html[lang] in sync (VERIFY-03)
  paraglideSetLocale(next);
}

// Called once in +layout.svelte onMount
// Reads window.__initialLocale (set by FOUC inline script) to avoid a second localStorage read
export function initLocale(): void {
  const initial = (window as Record<string, unknown>).__initialLocale as SupportedLocale | undefined;
  if (initial && SUPPORTED.includes(initial)) {
    paraglideSetLocale(initial);
    // $state is updated via the onSetLocale callback above
  }
}

// Browser language auto-detection for first visit
function detectLocale(): SupportedLocale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ca')) return 'ca';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}
```

**Critical:** `locale` must be declared with `$state`, not a plain `let`. Plain `let` in a `.svelte.ts` module is not reactive — components freeze at the initial value.

### Pattern 2: FOUC Prevention Inline Script in `app.html`

**What:** A `<script>` block placed before `%sveltekit.head%` runs synchronously as the browser parses HTML, before the SPA boots. It reads `localStorage`, validates the stored locale against the supported list, falls back to `navigator.language` detection on first visit, and sets both `document.documentElement.lang` and `window.__initialLocale`. The locale module reads `window.__initialLocale` in `initLocale()` to skip a redundant localStorage read.

**When to use:** Always — must be the first script in `<head>` for FOUC prevention to work.

**Current state of `app.html`:** Static `lang="en"` on the `<html>` tag. This must be replaced with the inline script that sets `lang` dynamically.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f0f0f" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <!-- FOUC prevention: read locale before SPA boots -->
    <script>
      (function() {
        var supported = ['en', 'ca', 'es'];
        var stored = localStorage.getItem('octapp:locale');
        var locale;
        if (stored && supported.indexOf(stored) !== -1) {
          locale = stored;
        } else {
          // First visit: derive from navigator.language
          var lang = (navigator.language || 'en').toLowerCase();
          if (lang.indexOf('ca') === 0) locale = 'ca';
          else if (lang.indexOf('es') === 0) locale = 'es';
          else locale = 'en';
        }
        document.documentElement.lang = locale;
        window.__initialLocale = locale;
      })();
    </script>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover" style="background-color: #0f0f0f; margin: 0;">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

**Note:** The inline script uses ES5 syntax (`var`, `indexOf`) for maximum browser compatibility, including old iOS Safari versions.

### Pattern 3: Layout Initialization (`+layout.svelte`)

**What:** `initLocale()` is added to the existing `onMount` block alongside `createSocket()`. No new DOM nodes, no new lifecycle hooks.

**Current `+layout.svelte`:**
```svelte
onMount(() => {
  createSocket();
});
```

**After modification:**
```svelte
onMount(() => {
  initLocale();   // read window.__initialLocale → set paraglide locale → $state syncs
  createSocket();
});
```

`initLocale()` must run before `createSocket()` to ensure the locale is set before any component-level subscriptions fire. Both are fast synchronous operations.

### Pattern 4: Verification Stub on Join Page

**What:** A temporary 3-button strip at the bottom of `+page.svelte` (outside the `<main>` form) that calls `setLocale()` and shows at least one translated string. Proves reactivity end-to-end before Phase 12 string extraction begins.

**When to remove:** Phase 13 replaces this with the production language picker UI.

```svelte
<!-- TODO(Phase 13): replace with real language picker UI -->
<div style="position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; z-index: 999;">
  <button onclick={() => setLocale('en')} style="opacity: {locale === 'en' ? 1 : 0.4}">en</button>
  <button onclick={() => setLocale('ca')} style="opacity: {locale === 'ca' ? 1 : 0.4}">ca</button>
  <button onclick={() => setLocale('es')} style="opacity: {locale === 'es' ? 1 : 0.4}">es</button>
</div>
```

The stub uses inline styles (not Tailwind) to keep it visually distinct and easy to find/remove. The active locale button is highlighted via opacity.

### Pattern 5: `vite.config.ts` Patch

The scaffold modifies `vite.config.ts` automatically. Verify it produces this shape (strategy must NOT include `url`):

```typescript
import { paraglideVitePlugin } from "@inlang/paraglide-js/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
  ],
});
```

Plugin order matters: `tailwindcss()` and `sveltekit()` before `paraglideVitePlugin()`.

### Pattern 6: `svelte.config.js` Patch

Add `paths: { relative: false }` to the kit config. Required for `adapter-static` + SPA mode to prevent asset 404s on any non-root path when Paraglide is present:

```javascript
kit: {
  adapter: adapter({ ... }),
  paths: { relative: false },   // ADD THIS
},
```

### Pattern 7: `project.inlang/settings.json`

The scaffold generates this file. Verify it matches (or correct it after scaffold):

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

`sourceLanguageTag: "en"` makes English the compile-time fallback. Missing keys in `ca.json` or `es.json` silently render the English string — no runtime error.

### Pattern 8: Message Stubs for Phase 11 Verification

Phase 11 needs at least one string in all three catalogs to prove the verification stub renders correctly. Create minimal stubs:

```json
// messages/en.json
{ "test_locale_active": "Active locale: English" }

// messages/ca.json
{ "test_locale_active": "Idioma actiu: Català" }

// messages/es.json
{ "test_locale_active": "Idioma activo: Español" }
```

These keys will be replaced/extended in Phase 12. The test key confirms Paraglide compiles, the module imports correctly, and the verification stub displays different text when locale is switched.

### Anti-Patterns to Avoid

- **Top-level `localStorage` access in any `.ts` or `.svelte.ts` file:** Vite evaluates modules at build time in Node.js where `localStorage` is undefined. Results in `ReferenceError` during `vite build`. Always wrap in `onMount`.
- **`let locale = 'en'` (plain variable) instead of `let locale = $state('en')`:** Not reactive — components never update when locale changes. This is the single most common implementation error.
- **Importing from `$lib/paraglide/runtime.js` in components:** Scatters persistence logic. Changes to the key name or strategy require edits in every component. All components must import from `$lib/i18n/locale.svelte.ts`.
- **Selecting URL strategy during scaffold:** The `url` strategy causes production 404s with `adapter-static` + SPA mode (Paraglide issue #503, confirmed open). Must not be selected.
- **Calling `setLocale()` without updating `document.documentElement.lang`:** The `html[lang]` attribute must stay in sync for screen readers and `VERIFY-03`. Update it inside `setLocale()` in the locale module.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale persistence | Custom cookie/IndexedDB system | `localStorage` via `octapp:locale` key | localStorage is synchronous, trivially readable by the inline FOUC script, already the project convention |
| Type-safe message keys | Custom TypeScript enum of string keys | Paraglide-generated `messages.d.ts` | Paraglide emits types from `en.json` automatically; typos in `m.key()` calls are TypeScript errors at compile time |
| Fallback for missing translations | Runtime null-check chain | Paraglide `sourceLanguageTag: "en"` | Compiler bakes English fallback into generated functions; no runtime overhead, no missing-key crashes |
| Message compilation | JSON import + key lookup function | Paraglide Vite plugin | Compiler emits tree-shakable functions; unused strings are not bundled; no runtime dictionary lookup overhead |

---

## Common Pitfalls

### Pitfall 1: `localStorage` Called at Module Load Time

**What goes wrong:** `initLocale()` or any `localStorage.getItem()` call at the top level of `locale.svelte.ts` throws `ReferenceError: localStorage is not defined` during `vite build`. Even with `ssr = false` in `+layout.ts`, Vite evaluates module code server-side during the build step.

**Why it happens:** Module-level code runs in Node.js during build. `onMount` only runs in the browser.

**How to avoid:** All `localStorage` access goes inside `initLocale()`. `initLocale()` is only called from `onMount` in `+layout.svelte`.

**Warning signs:** `vite build` fails with `ReferenceError: localStorage is not defined`.

### Pitfall 2: Locale State Not Reactive (`$state` Missing)

**What goes wrong:** Locale changes (e.g., clicking the verification stub buttons) update `localStorage` and call `paraglideSetLocale()`, but no component re-renders. Strings remain stuck in English.

**Why it happens:** A plain `let locale = 'en'` in a `.svelte.ts` module is not tracked by Svelte 5's compiler. Only `$state` variables create reactive dependencies.

**How to avoid:** Declare `export let locale = $state<SupportedLocale>('en')`. Wire `onSetLocale()` (or `onSetLanguageTag()`) to update this variable so Paraglide's internal locale changes propagate to Svelte reactivity.

**Warning signs:** Clicking locale buttons in the verification stub shows no change on screen. `localStorage` shows the new value but UI does not update.

### Pitfall 3: URL Strategy Selected During Scaffold

**What goes wrong:** `vite build` succeeds but production `modulepreload` links point to `/{locale}/_app/...` paths that 404 in production. The static SPA fallback (`index.html`) only applies to page routes, not asset chunks.

**Why it happens:** Paraglide issue #503 (open, unresolved as of 2026-04-18): static adapter + SPA mode + URL strategy generates incorrect asset paths.

**How to avoid:** During `npx sv add paraglide`, decline URL strategy if prompted. Manually verify the generated `strategy` array in `vite.config.ts` is `["localStorage", "preferredLanguage", "baseLocale"]` with no `"url"` entry.

**Warning signs:** App works in `vite dev` but crashes in production with 404s on JS chunks.

### Pitfall 4: FOUC Inline Script Placed After `%sveltekit.head%`

**What goes wrong:** The inline script runs after SvelteKit injects its JS, which boots the SPA before `window.__initialLocale` is set. Locale initialization reads `undefined` and falls back to English for one frame.

**Why it happens:** `%sveltekit.head%` expands to SvelteKit's script tags. Scripts after it run after those.

**How to avoid:** Place the FOUC inline `<script>` immediately before `%sveltekit.head%` in `app.html`, inside `<head>`.

**Warning signs:** Page refreshed with Catalan in localStorage briefly shows English text before switching.

### Pitfall 5: `svelte.config.js` Missing `paths: { relative: false }`

**What goes wrong:** Assets load correctly on `/` but 404 on any sub-path (e.g., `/groom`, `/party`) after Paraglide is added.

**Why it happens:** Paraglide's presence can cause `adapter-static` to generate relative asset paths (`../_app/...`) that resolve incorrectly from non-root paths.

**How to avoid:** Add `paths: { relative: false }` to the `kit` config in `svelte.config.js` as part of the scaffold step.

**Warning signs:** Production build works on the root URL but sub-pages fail to load JS/CSS.

### Pitfall 6: Scaffold Overwrites `app.html` Content

**What goes wrong:** `npx sv add paraglide` patches `app.html` and may overwrite the existing custom `<meta>` tags, `style`, or `body` attributes.

**Why it happens:** The scaffold does a diff-based patch but may not preserve all attributes if the structure diverges from its template.

**How to avoid:** Review the diff on `app.html` immediately after scaffold. The scaffold's `lang="%lang%"` or `dir="%dir%"` attribute approach may conflict with the FOUC inline script approach (D-04). The correct resolution: discard the scaffold's `lang="%lang%"` placeholder and use the FOUC inline script instead. The FOUC script sets `lang` synchronously — the `%lang%` placeholder is only useful for SSR (which is disabled).

**Warning signs:** Missing `<meta name="apple-mobile-web-app-capable">` or missing `style="background-color: #0f0f0f"` on body after scaffold.

---

## Code Examples

### Full `locale.svelte.ts` Module

```typescript
// src/lib/i18n/locale.svelte.ts
// Source: ARCHITECTURE.md Pattern 1, decisions D-03, D-04, D-06, D-07

import {
  setLocale as paraglideSetLocale,
  getLocale,
  onSetLocale,        // Confirm exact name in generated runtime.js after scaffold
} from '$lib/paraglide/runtime.js';

const LOCALE_KEY = 'octapp:locale';
const SUPPORTED = ['en', 'ca', 'es'] as const;
export type SupportedLocale = typeof SUPPORTED[number];

// Reactive locale state — the single source of truth for current locale in Svelte
// $state is REQUIRED; plain let does not create reactive dependencies
export let locale = $state<SupportedLocale>(getLocale() as SupportedLocale);

// Bridge: Paraglide internal locale changes → Svelte $state update
// This ensures components re-render whenever locale changes via any code path
onSetLocale((next: string) => {
  locale = next as SupportedLocale;
});

// Public API: change locale, persist to localStorage, update html[lang]
export function setLocale(next: SupportedLocale): void {
  localStorage.setItem(LOCALE_KEY, next);
  document.documentElement.lang = next;
  paraglideSetLocale(next);
  // onSetLocale callback above fires → locale $state updates → components re-render
}

// Called once inside onMount in +layout.svelte
// Reads window.__initialLocale set by FOUC inline script (D-04)
// Falls back to navigator.language detection for first visit (D-07)
export function initLocale(): void {
  const initial = (window as Record<string, unknown>).__initialLocale as SupportedLocale | undefined;
  if (initial && (SUPPORTED as readonly string[]).includes(initial)) {
    paraglideSetLocale(initial);
    // locale $state updated via onSetLocale callback
  }
  // No else: if __initialLocale is valid, we're done.
  // The FOUC script already handles first-visit detection via navigator.language.
}
```

### `+layout.svelte` After Modification

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import ReconnectingOverlay from "$lib/ReconnectingOverlay.svelte";
  import LandscapeOverlay from "$lib/LandscapeOverlay.svelte";
  import { createSocket, destroySocket } from "$lib/socket.ts";
  import { initLocale } from "$lib/i18n/locale.svelte.ts";

  onMount(() => {
    initLocale();   // INFRA-03, INFRA-04: read __initialLocale → set paraglide locale
    createSocket();
  });

  onDestroy(() => {
    destroySocket();
  });
</script>

<ReconnectingOverlay />
<LandscapeOverlay />
<slot />
```

### Verification Stub in `+page.svelte`

Add these imports and the stub div at the bottom of the page (after `</main>`, before `<style>`):

```svelte
<script lang="ts">
  // Add to existing imports:
  import * as m from '$lib/paraglide/messages.js';
  import { locale, setLocale } from '$lib/i18n/locale.svelte.ts';
  // ... existing imports unchanged
</script>

<!-- ... existing page markup unchanged ... -->

<!-- TODO(Phase 13): replace with real language picker UI — remove this stub -->
<div style="position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; z-index: 999; background: #1a1a1a; padding: 0.5rem; border-radius: 0.5rem;">
  <span style="font-size: 0.75rem; color: #888; align-self: center;">{m.test_locale_active()}</span>
  <button onclick={() => setLocale('en')} style="opacity: {locale === 'en' ? 1 : 0.4}; color: white; background: none; border: 1px solid #444; border-radius: 4px; padding: 2px 8px; cursor: pointer;">en</button>
  <button onclick={() => setLocale('ca')} style="opacity: {locale === 'ca' ? 1 : 0.4}; color: white; background: none; border: 1px solid #444; border-radius: 4px; padding: 2px 8px; cursor: pointer;">ca</button>
  <button onclick={() => setLocale('es')} style="opacity: {locale === 'es' ? 1 : 0.4}; color: white; background: none; border: 1px solid #444; border-radius: 4px; padding: 2px 8px; cursor: pointer;">es</button>
</div>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / `npx` | `npx sv add paraglide` scaffold | Assumed present (SvelteKit project running) | — | Use `bun x sv add paraglide` if npx unavailable |
| Bun | Dev server, build | Confirmed (project uses Bun throughout) | — | — |
| `@inlang/paraglide-js` | INFRA-01 through INFRA-05 | Not yet installed | ^2.16.0 | — |
| `src/lib/paraglide/` | All paraglide imports | Not yet generated (Vite plugin generates on first build/dev) | — | Run `vite dev` once after scaffold |

**Missing dependencies with no fallback:**
- `@inlang/paraglide-js` — must be installed via scaffold before any other step can proceed

**Missing dependencies with fallback:**
- None

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@inlang/paraglide-sveltekit` v1 adapter (separate package) | `@inlang/paraglide-js` v2 Vite plugin (bundled) | Paraglide 2.0 release, 2024 | v1 adapter must NOT be installed; the Vite plugin is inside the main package |
| `onSetLanguageTag()` callback name | May be `onSetLocale()` in v2.16.x | v2.x API evolution | Check generated `runtime.js` after scaffold to find the correct callback name |
| `sv add paraglide` sets `lang="%lang%"` placeholder for SSR | With SSR disabled, FOUC inline script is the correct approach | SSR-disabled SPA pattern | Discard scaffold's `%lang%` approach; use the synchronous inline script pattern instead |

---

## Open Questions

1. **Exact `onSetLocale` vs `onSetLanguageTag` API name**
   - What we know: Both names have appeared in Paraglide v2 documentation and community examples. The API was `onSetLanguageTag` in early v2 releases.
   - What's unclear: Whether v2.16.0 uses `onSetLocale`, `onSetLanguageTag`, or exports both as aliases.
   - Recommendation: After scaffold runs, inspect `src/lib/paraglide/runtime.js` and use whichever name is exported. The planner should note this as a post-scaffold verification step.

2. **Scaffold's `app.html` patch conflicts with D-04 FOUC strategy**
   - What we know: `sv add paraglide` patches `app.html` to use `lang="%lang%"` (a SvelteKit template variable for SSR). With SSR disabled, this variable is never populated — `lang` stays as the literal string `"%lang%"`.
   - What's unclear: Whether the scaffold's patch is destructive (overwrites existing content) or additive.
   - Recommendation: Run scaffold, immediately review the `app.html` diff. Remove the `lang="%lang%"` attribute and replace with the FOUC inline script approach. This is a post-scaffold manual correction step.

3. **Whether `ca.json` and `es.json` stubs must exist before `vite build`**
   - What we know: Paraglide requires all `languageTags` in `settings.json` to have corresponding message files. Missing files cause a build error.
   - What's unclear: Whether empty `{}` files satisfy the requirement or whether at least the keys from `en.json` must be present.
   - Recommendation: Create stub `ca.json` and `es.json` files with at least the `test_locale_active` key (same set as `en.json`) immediately after scaffold. This matches Phase 11 scope.

---

## Sources

### Primary (HIGH confidence)

- STACK.md (`.planning/research/STACK.md`) — Paraglide v2 version, strategy config, deprecated packages, install commands. Researched 2026-04-17.
- ARCHITECTURE.md (`.planning/research/ARCHITECTURE.md`) — `locale.svelte.ts` module shape, `onMount` init pattern, `app.html` integration, data flow diagrams, anti-patterns. Researched 2026-04-17.
- PITFALLS.md (`.planning/research/PITFALLS.md`) — All 6 critical pitfalls with root causes and prevention strategies. Researched 2026-04-17.
- SUMMARY.md (`.planning/research/SUMMARY.md`) — Consolidated findings, phase rationale, confidence assessment. Researched 2026-04-17.
- CONTEXT.md (`.planning/phases/11-i18n-infrastructure/11-CONTEXT.md`) — All locked decisions, discretion areas, verification stub spec.
- Existing code read directly: `src/routes/+layout.svelte`, `src/app.html`, `src/routes/+layout.ts`, `src/lib/socket.ts`, `src/routes/+page.svelte`, `vite.config.ts`, `svelte.config.js`, `package.json`

### Secondary (MEDIUM confidence)

- [Paraglide 2.0 Migration Guide — dropanote.de](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/) — confirms adapter removal, Vite plugin unification (community blog, consistent with official docs)
- [David Bushell — SvelteKit i18n and FOWL (2026-03-11)](https://dbushell.com/2026/03/11/sveltekit-internationalization-flash-of-wrong-locale/) — FOUC inline script pattern
- [CoMiGo Games — i18n for Svelte 5](https://comigo.games/en/n/i18n-library-for-svelte5/) — rune-native i18n bridge pattern

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — `@inlang/paraglide-js ^2.16.0` confirmed on npm (published 2026-04-15). Vite plugin bundling and strategy options confirmed against official docs.
- Architecture: HIGH — All patterns verified against Paraglide v2 official docs + Svelte 5 runes model. Existing code read directly — integration points are confirmed.
- Pitfalls: HIGH — Reactivity trap documented in Svelte 5 official docs. localStorage/build-time pitfall confirmed in Paraglide docs. URL strategy 404 backed by open GitHub issue #503.
- Open Questions: LOW — Three items need post-scaffold verification (API name, `app.html` diff review, stub file requirements). None are blockers that prevent planning; all are post-scaffold checks.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable library; Paraglide v2 API is stable, not fast-moving)
