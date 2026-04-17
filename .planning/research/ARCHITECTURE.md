# Architecture Research

**Domain:** i18n integration into SvelteKit 5 + Svelte 5 runes SPA (SSR disabled)
**Researched:** 2026-04-17
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (SPA, SSR disabled)                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  join page   │  │  groom page  │  │  party page  │ + admin/setup │
│  │  +page.svelte│  │  +page.svelte│  │  +page.svelte│               │
│  │  [NEW: lang  │  │  [NEW: uses  │  │  [NEW: uses  │               │
│  │   picker UI] │  │   m.key()]   │  │   m.key()]   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         └─────────────────┼─────────────────┘                        │
│                           ↓                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              src/lib/i18n/locale.svelte.ts                     │  │
│  │  locale = $state('en')   (read from localStorage on init)      │  │
│  │  setLocale(code) → writes localStorage + calls paraglide       │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
│                             ↓                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              src/lib/paraglide/   (compiler output)            │  │
│  │   messages.js  — tree-shakable m.key() functions               │  │
│  │   runtime.js   — getLocale(), setLocale(), onSetLocale()       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                             ↑                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              messages/   (source of truth for translators)     │  │
│  │   en.json   ca.json   es.json                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    Bun WebSocket server (UNCHANGED)                   │
│   server.ts — in-memory state, full-state broadcast                   │
│   No locale awareness. Locale is purely client-side.                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `locale.svelte.ts` | Reactive locale state, localStorage persistence, expose `setLocale()` and `locale` | `$state` rune + wrapper around paraglide `setLocale()` |
| `messages/*.json` | Source strings in en / ca / es | JSON key-value files, English as fallback |
| `paraglide/runtime.js` | Locale read/write/subscribe (paraglide-generated) | Imported into `locale.svelte.ts`; not used directly in components |
| `paraglide/messages.js` | Compiled, typed message functions (paraglide-generated) | Imported as `m` in every component that has UI strings |
| `+layout.svelte` | Locale initialization on mount (read localStorage) | Calls locale init; no new DOM nodes required |
| Join page `+page.svelte` | Language picker UI (new section) | Small flag/label buttons, calls `setLocale()` |

## Recommended Project Structure

```
src/
├── lib/
│   ├── i18n/
│   │   └── locale.svelte.ts    # NEW — reactive $state locale store + init
│   ├── paraglide/              # NEW (compiler-generated, gitignored or committed)
│   │   ├── messages.js         #   compiled message functions
│   │   ├── messages.d.ts       #   TypeScript types
│   │   └── runtime.js          #   getLocale / setLocale / onSetLocale
│   ├── components/             # UNCHANGED
│   ├── socket.ts               # UNCHANGED
│   ├── types.ts                # UNCHANGED
│   └── ...
├── routes/
│   ├── +layout.svelte          # MODIFIED — add locale init in onMount
│   ├── +layout.ts              # UNCHANGED (ssr = false, prerender = false)
│   ├── +page.svelte            # MODIFIED — add language picker, translate strings
│   ├── admin/
│   │   ├── +page.svelte        # MODIFIED — translate strings
│   │   └── setup/
│   │       └── +page.svelte    # MODIFIED — translate strings
│   ├── groom/
│   │   └── +page.svelte        # MODIFIED — translate strings
│   └── party/
│       └── +page.svelte        # MODIFIED — translate strings
├── app.html                    # MODIFIED — add %lang% and %dir% placeholders
└── app.css                     # UNCHANGED
messages/                       # NEW — translation source files
├── en.json
├── ca.json
└── es.json
project.inlang/                 # NEW — paraglide project config
└── settings.json
vite.config.ts                  # MODIFIED — add paraglideVitePlugin()
svelte.config.js                # MODIFIED — add paths: { relative: false }
```

### Structure Rationale

- **`src/lib/i18n/locale.svelte.ts`:** Wraps paraglide's `setLocale()` with a `$state` rune so the current locale is reactive and components can derive from it. Also owns the localStorage read-on-init and write-on-change logic. This is the only file components import for locale reads — they never call paraglide runtime directly.
- **`src/lib/paraglide/`:** Compiler output. Not hand-edited. Regenerated on `vite dev` / `vite build` when message files change. Can be committed or gitignored (committing is safer for CI).
- **`messages/`:** Lives at project root by convention (where the inlang project config points). Translators edit these; developers do not hand-edit `paraglide/` output.
- **`svelte.config.js` `paths: { relative: false }`:** Required for the static SPA adapter when paraglide is present to prevent asset 404s on any non-root paths.

## Architectural Patterns

### Pattern 1: Locale State in a `.svelte.ts` Module (Recommended)

**What:** A single `locale.svelte.ts` module owns all locale state using Svelte 5 `$state` rune. Components import `locale` to read the current value and `setLocale()` to change it. The module bridges between Svelte 5 reactivity and paraglide's internal locale system.

**When to use:** Always — this is the correct pattern for Svelte 5 apps. Svelte stores (`writable`) also work, but `$state` in `.svelte.ts` is idiomatic Svelte 5 and matches the existing codebase patterns.

**Trade-offs:** Introduces one indirection layer (module wraps library). Benefit: components stay decoupled from paraglide internals. If paraglide is ever swapped, only this module changes.

**Example:**
```typescript
// src/lib/i18n/locale.svelte.ts
import { setLocale as paraglideSetLocale, getLocale, onSetLocale } from '$lib/paraglide/runtime.js';

const LOCALE_KEY = 'octapp:locale';
const SUPPORTED = ['en', 'ca', 'es'] as const;
type SupportedLocale = typeof SUPPORTED[number];

// Reactive locale state — components read this
export let locale = $state<SupportedLocale>(getLocale() as SupportedLocale);

// Keep $state in sync when paraglide's locale changes
onSetLocale((next) => {
  locale = next as SupportedLocale;
});

export function setLocale(next: SupportedLocale): void {
  localStorage.setItem(LOCALE_KEY, next);
  paraglideSetLocale(next);
}

export function initLocale(): void {
  const stored = localStorage.getItem(LOCALE_KEY) as SupportedLocale | null;
  if (stored && SUPPORTED.includes(stored)) {
    paraglideSetLocale(stored);
  }
}
```

### Pattern 2: Message Functions Called Directly in Markup

**What:** Components import the compiled `m` object from `$lib/paraglide/messages.js` and call functions inline. No store subscription, no helper wrapper. Strings are re-evaluated on each render.

**When to use:** Always — this is paraglide's designed usage. Works in component markup naturally because the component re-renders when `locale` state changes (since `locale.svelte.ts` exports a `$state` that Svelte 5 tracks as a dependency).

**Trade-offs:** Message function calls are NOT inherently reactive in isolation — they return a plain string. Reactivity comes from the component being invalidated by the `locale` `$state` mutation. Components must import `locale` (even if only to create the dependency) or the template must reference it in a way Svelte 5 tracks. The cleanest approach: reference `locale` somewhere in the script block so Svelte registers the dependency.

**Example:**
```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { locale, setLocale } from '$lib/i18n/locale.svelte.ts';
  // Importing locale creates the reactive dependency; m.* calls react when locale changes
</script>

<h1>{m.join_title()}</h1>
<p>{m.join_subtitle()}</p>
<button onclick={() => setLocale('ca')}>CA</button>
```

### Pattern 3: Layout-Level Locale Initialization via `onMount`

**What:** `+layout.svelte` calls `initLocale()` inside `onMount`. This is the correct entry point because: (a) `onMount` only runs in the browser, (b) SSR is disabled so there is no server execution to worry about, (c) it runs once before any child page renders its first update.

**When to use:** Always — do not call `initLocale()` at module load time. Even with `ssr = false`, the Vite build pipeline evaluates modules server-side during the build step, where `localStorage` is undefined. `onMount` is safe.

**Trade-offs:** There is a 1-frame flash-of-default-locale if the stored locale differs from the default. For this app (mobile, fast, single page, English-default), this is unnoticeable in practice.

**Example:**
```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createSocket, destroySocket } from '$lib/socket.ts';
  import { initLocale } from '$lib/i18n/locale.svelte.ts';
  import '../app.css';

  onMount(() => {
    initLocale();   // read localStorage, set paraglide locale
    createSocket();
  });
  onDestroy(() => destroySocket());
</script>

<slot />
```

### Pattern 4: Server Error Codes Mapped to Translated Strings Client-Side

**What:** The Bun WebSocket server sends error codes (`WRONG_CODE`, `GROOM_TAKEN`) as plain strings. The join page maps these codes to translated error messages using `m.*` functions.

**When to use:** Whenever server-sourced text must be localized. Never localize server error strings on the server.

**Trade-offs:** Requires a mapping table or switch in the join page. Simple and maintainable.

**Example:**
```typescript
// In the join page error handler
function translateError(code: string): string {
  switch (code) {
    case 'WRONG_CODE': return m.error_wrong_code();
    case 'GROOM_TAKEN': return m.error_groom_taken();
    default: return m.error_generic();
  }
}
```

## Data Flow

### Locale Initialization Flow

```
Browser loads app (SPA, no SSR)
    ↓
+layout.svelte onMount fires
    ↓
initLocale() reads localStorage('octapp:locale')
    ↓
paraglideSetLocale('ca') — updates paraglide internal state
    ↓
onSetLocale() callback fires → locale $state mutated to 'ca'
    ↓
Svelte 5 invalidates all components reading locale
    ↓
m.key() calls re-execute → strings render in Catalan
```

### Locale Change Flow (User Taps Language Picker)

```
User taps [CA] button on join screen
    ↓
setLocale('ca') called in locale.svelte.ts
    ↓
localStorage.setItem('octapp:locale', 'ca')
    ↓
paraglideSetLocale('ca')
    ↓
onSetLocale callback → locale $state = 'ca'
    ↓
All components reading locale invalidated → re-render in Catalan
    ↓
(persists across page navigations and refreshes)
```

### Key Data Flows

1. **WebSocket game state flow:** Completely unchanged. `socket.ts`, `gameState`, and all `STATE_SYNC` / `PLAYER_JOINED` / `EFFECT_ACTIVATED` handling are untouched. Locale never crosses the WebSocket wire.
2. **Translation lookup:** Build-time compiled. `m.key()` is a plain function returning a string for the current locale. No async, no network, no store subscription in the component.
3. **localStorage namespace:** Locale uses key `octapp:locale`. Existing keys `octapp:playerId` and `octapp:sessionCode` are unchanged. No conflicts.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 3 locales (current scope) | Flat JSON files, no lazy loading needed — all locales compiled into bundle |
| 10+ locales | Paraglide supports per-locale code splitting (each locale = separate chunk) — not needed here |
| SSR re-enabled in future | Add `hooks.server.ts` with `paraglideMiddleware()` + cookie strategy to replace localStorage; component code unchanged |

### Scaling Priorities

1. **First bottleneck:** None for this scope. Three locales, ~100 strings, client-only. Bundle impact is negligible.
2. **SSR adoption:** If SSR is ever re-enabled, the locale module is the only file requiring changes. Components using `m.*` are unaffected.

## Anti-Patterns

### Anti-Pattern 1: URL-based Locale Strategy

**What people do:** Configure paraglide with a `url` strategy to serve locale-prefixed routes like `/ca/join`, `/es/groom`.

**Why it's wrong:** Paraglide GitHub issue #503 is open and unresolved. Static adapter + SPA mode + URL strategy causes incorrect `modulepreload` href paths in production builds, resulting in `/_app` chunks being requested from `/{lang}/_app` — a 404 in production. This project uses `adapter-static` with `fallback: 'index.html'`, which is exactly the affected configuration.

**Do this instead:** Use `localStorage` + `preferredLanguage` + `baseLocale` strategy only. URLs stay language-agnostic (`/`, `/groom`, `/party`). Locale is stored in localStorage and restored on load.

### Anti-Pattern 2: Calling `initLocale()` or Accessing `localStorage` at Module Load Time

**What people do:** Call `initLocale()` or read `localStorage` at the top level of a `.ts` or `.svelte.ts` file.

**Why it's wrong:** Vite evaluates modules during the SSR build phase, where `localStorage` is undefined. Even with `ssr = false` in `+layout.ts` (which disables SSR at runtime), the build-time module evaluation still runs in Node.js. This throws `ReferenceError: localStorage is not defined` during `vite build`.

**Do this instead:** Always call `initLocale()` inside `onMount`, which is browser-only and never executed during the build.

### Anti-Pattern 3: Importing Paraglide Runtime Directly in Components

**What people do:** Import `setLocale` from `$lib/paraglide/runtime.js` in every component that exposes a locale switcher.

**Why it's wrong:** Scatters localStorage persistence logic across many files. If the key name or persistence strategy changes, it must be updated everywhere.

**Do this instead:** All components import from `$lib/i18n/locale.svelte.ts`. All paraglide runtime interaction is centralized there.

### Anti-Pattern 4: Translating Server Error Messages on the Server

**What people do:** Pass the player's locale with every WebSocket message and have the Bun server return localized error strings.

**Why it's wrong:** Adds a client-only concern (locale) to the server protocol. Server error message strings would need per-locale string tables in the Bun server. Protocol becomes stateful per locale. No benefit since the server strings are short, not translatable by non-developers, and the client already receives an error code.

**Do this instead:** Server sends error codes (`WRONG_CODE`, `GROOM_TAKEN`). The join page maps error codes to `m.*` translated strings. WebSocket protocol stays locale-free.

## Integration Points

### Files to Create (New)

| File | Purpose |
|------|---------|
| `src/lib/i18n/locale.svelte.ts` | Reactive locale state, localStorage init/persist, setLocale wrapper |
| `messages/en.json` | English string catalog (base/fallback) |
| `messages/ca.json` | Catalan string catalog |
| `messages/es.json` | Spanish string catalog |
| `project.inlang/settings.json` | Paraglide project config (locales, source locale, outdir) |
| `src/lib/paraglide/` | Compiler output generated by paraglide Vite plugin — not hand-authored |

### Files to Modify (Existing)

| File | Change Required |
|------|----------------|
| `vite.config.ts` | Add `paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })` |
| `svelte.config.js` | Add `paths: { relative: false }` to kit config (prevents asset 404s) |
| `src/app.html` | Add `lang="%lang%"` and `dir="%dir%"` to `<html>` tag |
| `src/routes/+layout.svelte` | Add `initLocale()` call inside existing `onMount` |
| `src/routes/+page.svelte` | Add language picker UI; replace all hardcoded strings with `m.*` calls |
| `src/routes/admin/+page.svelte` | Replace all hardcoded strings with `m.*` calls |
| `src/routes/admin/setup/+page.svelte` | Replace all hardcoded strings with `m.*` calls |
| `src/routes/groom/+page.svelte` | Replace all hardcoded strings with `m.*` calls |
| `src/routes/party/+page.svelte` | Replace all hardcoded strings with `m.*` calls |
| `src/lib/ReconnectingOverlay.svelte` | Replace hardcoded strings with `m.*` calls |
| `src/lib/LandscapeOverlay.svelte` | Replace hardcoded strings with `m.*` calls |
| `src/lib/components/*.svelte` | Replace hardcoded strings in minigame components |

### Files NOT Touched

| File | Reason |
|------|--------|
| `server/` (Bun WebSocket server) | Locale is 100% client-side; no locale state crosses WebSocket |
| `src/lib/socket.ts` | No locale awareness needed; server error codes mapped client-side |
| `src/lib/types.ts` | Game state types unchanged; locale is not a game state property |
| `src/routes/+layout.ts` | `ssr = false` / `prerender = false` already set; no changes needed |
| `src/lib/configSerializer.ts` | Config JSON export/import is locale-agnostic (game content, not UI strings) |
| `src/app.css` | Tailwind v4 styles unchanged; no RTL needed (all 3 locales are LTR) |
| `src/hooks.server.ts` | Does not exist; not needed. `paraglideMiddleware()` only applies to SSR request pipelines, which do not exist for a static SPA. |
| `src/hooks.ts` | The `reroute()` function is only needed for URL-based locale routing, which is explicitly excluded. |

### SSR-Disabled Implications (Confirmed Safe)

- **No hydration issues:** With `ssr = false` set globally in `+layout.ts`, there is no server render to hydrate. The client starts fresh on every load. Reading `localStorage` in `onMount` is unambiguously safe — there is no server/client locale mismatch possible.
- **No `hooks.server.ts` needed:** `paraglideMiddleware()` runs in SvelteKit's server request hook pipeline. This app uses `adapter-static` deployed on Railway with Bun serving the static files. There is no SvelteKit server request pipeline at runtime. The file would be unreachable.
- **No `hooks.ts` needed:** The `reroute()` function from paraglide handles URL rewriting for URL-based locale strategies. Since the URL strategy is excluded, there is nothing to reroute.
- **`adapter-static` with `fallback: 'index.html'`:** All routes serve the same `index.html`. Locale is determined client-side from localStorage, not URL segments. This is the correct configuration for per-device locale.

### Suggested Build Order (Dependency-Aware)

1. **Infrastructure** — Install `@inlang/paraglide-js`, configure `vite.config.ts`, create `project.inlang/settings.json`, create placeholder `messages/en.json` with a handful of test keys, update `svelte.config.js`, update `app.html`. Verify `src/lib/paraglide/` is generated. Create `locale.svelte.ts`. Add `initLocale()` to `+layout.svelte` `onMount`. Confirm `vite dev` and `vite build` pass.

2. **String catalog completion** — Extract every visible UI string from all 5 route pages and the 7 shared components into `messages/en.json`. This must be complete before translation work begins — partial catalogs cause TypeScript build errors (paraglide's generated types make missing keys a compile error). Once `en.json` is finalized, produce `ca.json` and `es.json`.

3. **Language picker** — Add the language picker to the join page (`+page.svelte`). Test localStorage persistence and instant re-render reactivity in all three languages. This is the gate for the rest of the translation work — the mechanism must work before strings matter.

4. **View translation — join page** — Replace all hardcoded strings in `+page.svelte` with `m.*` calls. The join page is the most visible entry point and contains the picker itself.

5. **View translation — groom and party pages** — Replace strings in the two primary game-night views. These are the most used screens during the actual event.

6. **View translation — admin and shared components** — Admin dashboard, setup page, `ReconnectingOverlay`, `LandscapeOverlay`, minigame components. Admin is used less often; shared components are simple.

7. **Multi-device verification** — Test all three locales across iOS and Android. Confirm locale persists through page refresh, back-button navigation, and WebSocket reconnect. Confirm other devices are unaffected when one device switches locale.

## Sources

- [Paraglide JS + SvelteKit official docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit) — HIGH confidence
- [Paraglide JS Strategy docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy) — HIGH confidence
- [Paraglide JS Basics docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) — HIGH confidence
- [Svelte CLI paraglide docs](https://svelte.dev/docs/cli/paraglide) — HIGH confidence
- [Paraglide issue #503: Static Adapter + SPA + URL strategy causes 404s in production](https://github.com/opral/paraglide-js/issues/503) — HIGH confidence (open, unresolved)
- [Paraglide 2.0 migration guide](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/) — MEDIUM confidence (community, consistent with official docs)
- [i18n with $state rune pattern for Svelte 5](https://comigo.games/en/n/i18n-library-for-svelte5/) — MEDIUM confidence (community, aligns with Svelte 5 reactivity model)

---
*Architecture research for: i18n integration — SvelteKit 5 + Svelte 5 runes + SSR disabled SPA*
*Researched: 2026-04-17*
