# Domain Pitfalls: Retrofitting i18n into SvelteKit 5 / Svelte 5 Runes App

**Domain:** Adding i18n (Catalan/Spanish/English fallback) to an existing SvelteKit 5 + Svelte 5 runes party game app
**Researched:** 2026-04-17
**Confidence:** HIGH for reactivity traps (Svelte 5 official docs + community issue analysis); HIGH for FOWL/localStorage patterns (multiple confirmed sources); MEDIUM for library-specific behaviour (svelte-i18n store interop with runes, single-source); MEDIUM for ICU/pluralization edge cases in Catalan (CLDR verified, app impact is LOW due to simple text)

---

## Critical Pitfalls

Mistakes that require significant rework, cause invisible bugs, or produce bad UX on the night of the event.

---

### Pitfall 1: svelte-i18n's `$_` Is a Svelte Store — Not a Rune — So `$derived` Cannot Wrap It

**What goes wrong:**
The existing codebase uses Svelte 5 runes (`$state`, `$derived`, `$effect`) exclusively. When svelte-i18n is added, developers attempt to use `$_` (the translation function store) inside `$derived` or assign it to a `$state` variable. This fails silently or throws.

The specific failure mode: if a developer writes `const label = $derived($_(key))` inside a `.svelte.ts` module, the reactive subscription to the store is **not established** because rune-based `$derived` does not automatically subscribe to Svelte stores. The translation function returns the initial locale value and freezes — switching the locale produces no update.

Conversely, in `.svelte` files, using `$_('key')` in the template works (because Svelte compiles the store subscription via the `$` prefix), but mixing this with rune-based state management creates confusing ownership: some state is reactive via runes, some via store subscriptions.

**Why it happens:**
Svelte 5 runes do not automatically track Svelte store subscriptions. The tracking models are different: stores use `.subscribe()`, runes use compiler-tracked fine-grained reactivity. A rune `$derived` block tracks `$state` and `$derived` dependencies only — not `.subscribe()` calls. This is documented but non-obvious.

**How to avoid:**
Two valid approaches:

Option A — Keep svelte-i18n and use it only in `.svelte` templates (not in `.svelte.ts` files). Use `$_('key')` directly in template markup. Never try to pass `$_` through a rune chain. This is the path of least resistance for a simple app.

Option B — Replace svelte-i18n with a rune-native solution: a `$state.raw({})` dictionary keyed by locale, with a `setLocale()` function that swaps the reference. Translation calls become plain function calls on a reactive object. Example:
```typescript
// i18n.svelte.ts
import en from '$lib/i18n/en.json';
import ca from '$lib/i18n/ca.json';
import es from '$lib/i18n/es.json';

const catalogs = { en, ca, es } as const;
let activeCatalog = $state.raw(catalogs.en);

export function setLocale(locale: 'en' | 'ca' | 'es') {
  activeCatalog = catalogs[locale];
}
export function t(key: string): string {
  return (activeCatalog as Record<string, string>)[key] ?? key;
}
```

For this app's scale (3 languages, one-time event, no CI pipeline needed) Option B is recommended. It avoids the entire store/rune interop problem.

**Warning signs:**
- `$_('key')` works on first render but does not update when the locale is changed
- Translations update in the template but a derived value computed from `$_()` stays stale
- TypeScript errors about `$_` not being callable inside `.svelte.ts` files

**Phase to address:** i18n Infrastructure phase (earliest). The library/approach decision must be made before any string extraction begins.

---

### Pitfall 2: Flash of Untranslated Content (FOUC) on First Load from localStorage

**What goes wrong:**
The locale is persisted in `localStorage`. On first load:
1. SvelteKit renders the page (SSR is disabled on game routes, so this is client-side only, but hydration still happens)
2. The component tree renders with the default/fallback locale (English)
3. JavaScript runs, reads `localStorage.getItem('locale')`, sets the locale
4. Components re-render with the correct locale (Catalan or Spanish)

The user sees a brief flash of English text — all labels, buttons, and UI strings flash in English then snap to the correct language. On slow devices or on first contentful paint, this is visible.

**Why it happens:**
`localStorage` is not available until the browser runs JavaScript. There is no way to know the user's locale preference at HTML paint time. Even with SSR disabled, the initial DOM paint uses whatever default the app starts with.

**How to avoid:**
Two techniques together eliminate the flash:

Technique 1 — Synchronous localStorage read before any reactive render via an inline script in `app.html`:
```html
<script>
  const locale = localStorage.getItem('locale') || 'en';
  document.documentElement.setAttribute('lang', locale);
  window.__initialLocale = locale;
</script>
```
The i18n module reads `window.__initialLocale` synchronously before the first component mount.

Technique 2 — Load all translation catalogs at bundle time (not lazy) given the small size (3 locales × ~100 strings is a few KB). No async loading = no loading state = no flash.

For this app specifically: since all game routes have SSR disabled, and translations are small enough to bundle statically, the inline script + synchronous catalog assignment is the correct pattern. Do not use lazy locale loading.

**Warning signs:**
- Language switcher changes locale, but on next page refresh the UI flashes to English then corrects
- Users report a "blink" on join screen before the correct language appears

**Phase to address:** i18n Infrastructure phase. The `app.html` inline script must be the first thing established.

---

### Pitfall 3: Missing Translation Key Falls Back to Empty String Silently

**What goes wrong:**
A translation key exists in English but is missing from the Catalan or Spanish catalog. The `fallbackLocale` is set to English and the library is supposed to fall back. However:

- svelte-i18n's fallback mechanism requires the missing-key handling to be configured explicitly. With default settings, missing keys may return `undefined` (rendered as empty string in templates) rather than the fallback locale string.
- In Svelte templates, `{$_('key.that.does.not.exist')}` renders as empty string with no visible error, no console warning, and no crash. The button label, aria-label, or toast message simply vanishes.

**Why it happens:**
The fallback chain requires both `fallbackLocale` to be set at init time AND the locale's catalog to be registered before the fallback is consulted. A common mistake is registering only the selected locale's catalog and not the fallback locale's catalog — if the fallback catalog is not loaded, the fallback cannot work.

**How to avoid:**
- Always load all locale catalogs at startup (not lazily). With 3 small JSON files, lazy loading adds complexity with no benefit.
- Configure `handleMissingMessage` to return the English key string as a visible placeholder: `return `[MISSING: ${id}]`` during development. This makes every missing key immediately visible.
- In production, fall back to the English value explicitly:
```typescript
handleMissingMessage: ({ locale, id }) => {
  if (locale !== 'en') return en[id] ?? id; // fall to English, then key name
  return id; // if English itself is missing, show key name
}
```
- Add a CI/build-time check (even a simple script) that diffs the English catalog keys against Catalan and Spanish catalogs and fails if they diverge.

**Warning signs:**
- A button appears with no label
- A placeholder is empty instead of showing hint text
- An aria-label is missing (invisible, but causes accessibility failures)

**Phase to address:** i18n Infrastructure phase (configure the fallback and missing-key handler before extracting any strings). String Extraction phase (run catalog completeness check before merging).

---

### Pitfall 4: Under-Extracting — aria-labels, Placeholders, and Toast Notifications Are Invisible

**What goes wrong:**
The developer extracts all visible text from `.svelte` templates (headings, button labels, paragraph text) but misses:

- `aria-label` attributes: `<button aria-label="Copy join link">` — screen reader users in Catalan hear English
- `placeholder` attributes: `<input placeholder="Player name">` — visible on empty inputs
- Toast notification text: programmatically generated strings passed to the toast library that never appear in template search results
- Error messages from validation: `"Name must be at least 2 characters"` — generated in JS, not in a template
- Dynamic strings built in TypeScript files: `const msg = \`${player.name} used a power-up!\`` — grep for `$_` in templates will miss this

**Why it happens:**
Most extraction tools and manual audits scan `.svelte` template markup. Strings in `.ts` files, attribute values in non-text positions, and programmatic string construction are easy to miss.

**How to avoid:**
Systematic audit checklist before declaring string extraction complete. For this specific app, the high-risk locations are:

- All `aria-label` attributes across all views (join, groom, party, admin dashboard, admin setup)
- `<input placeholder>` on the join screen (player name field) and admin setup form fields
- Toast/notification text generated in `+page.svelte` or component script blocks (e.g., power-up announcements)
- Error messages in WebSocket `onmessage` handlers that surface to the player
- Dynamic "player X did Y" event strings in the party view announcements

Use `grep -r 'aria-label\|placeholder\|toast\|announce' --include='*.svelte' --include='*.ts'` as a final audit pass before marking extraction complete.

**Warning signs:**
- Language is switched to Catalan/Spanish but some UI text remains in English after extraction is "complete"
- Screen reader testing reveals untranslated labels
- Power-up announcement banner shows English text to a Catalan-speaking player

**Phase to address:** String Extraction phase. The audit checklist must be part of the phase acceptance criteria.

---

### Pitfall 5: Over-Extracting — User-Authored Content Gets Wrapped in Translation Calls

**What goes wrong:**
The developer wraps all strings that pass through the UI in translation calls, including:
- Chapter names configured by the admin (e.g., "La Platja" — an admin-typed string)
- Trivia question text and answer options
- Scavenger hunt clue text
- Reward descriptions
- Player names

These are user-authored, dynamic, stored in the game config — not static UI strings. Wrapping them in `$_()` will throw (no matching key) and the fallback will show the raw string as a "key", which technically works, but adds noise to the catalog and risks future developers thinking these belong in the translation files.

**Why it happens:**
When doing a sweep to extract strings, it is tempting to extract anything that is user-visible. The distinction between "static UI chrome" (belongs in the catalog) and "user content" (comes from the config/state, always displayed as-is) is not always obvious mid-extraction.

**How to avoid:**
Establish a clear rule before extraction begins: **only strings that are hardcoded in `.svelte` files or `.ts` files belong in the translation catalog.** Any string that comes from `$gameState`, a WebSocket message, or was typed by the admin in the setup form is user content and must NOT be wrapped in a translation call.

Document this boundary in a comment at the top of each locale JSON file:
```json
// TRANSLATION CATALOG: static UI strings only.
// User-authored content (chapter names, trivia, clues, rewards, player names) is NEVER translated.
```

**Warning signs:**
- Translation catalog contains keys like `"chapter.name.la_platja"` or `"question.how_many_fingers"`
- A player or admin name appears as a translation key in the English JSON

**Phase to address:** String Extraction phase. Establish the content boundary as the first step of the phase.

---

### Pitfall 6: Locale State Not Set Before Component Mount Causes a Missed Reactive Update

**What goes wrong:**
The locale is read from `localStorage` and applied in `onMount` or in a `$effect`. However, some components (especially those rendered immediately on the join screen) have already completed their first render pass before `onMount` fires. Their translations are computed once with the default locale (English) and cached — if the i18n solution does not properly invalidate all translation consumers on locale change, those components show stale English text until a full navigation.

This is distinct from FOUC (Pitfall 2): FOUC is a visible flash. This pitfall is a stuck translation — the component never re-renders after the locale is set.

**Why it happens:**
If the locale is stored in a non-reactive variable (a plain `let`, a module-level variable, or a Svelte context that is not based on `$state`), changes to it do not trigger reactive updates in components that already read it.

**How to avoid:**
- The locale must be stored in a `$state` rune (or a proper Svelte store) — not a plain `let` in a module.
- If using a `.svelte.ts` module for the i18n singleton, confirm that the locale variable is declared with `let locale = $state('en')` (not `let locale = 'en'`).
- Test: change locale from the language picker on the join screen, verify every visible string on the screen updates without a page reload.

**Warning signs:**
- Language picker updates `localStorage` and the locale variable but the page does not visually change until a reload
- Console shows no errors but translations remain stale after switching language

**Phase to address:** i18n Infrastructure phase. Verify reactivity in isolation before beginning string extraction.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Lazy-load locale catalogs per locale | Smaller initial bundle | Requires loading state, async initialization, prone to FOUC | Never for this app — catalogs are <10KB total, bundle all three statically |
| Use svelte-i18n stores alongside Svelte 5 runes | Familiar library, large ecosystem | Store/rune interop confusion, stale translations in `$derived` chains | Only acceptable if svelte-i18n is used exclusively in `.svelte` templates and never in `.svelte.ts` utility files |
| Fallback to key name on missing translation | No silent empty strings | Key names leak into production UI if extraction is incomplete (e.g., `"join.player_name_placeholder"` shown to user) | Acceptable during development; switch to English value fallback in production |
| Skip catalog completeness check | Faster extraction | Missing keys in Catalan/Spanish silently show English or empty until tested manually | Never — write a 10-line comparison script as part of extraction phase |
| Single flat JSON catalog (no namespacing) | Simpler to start | Naming collisions as catalog grows; no way to split by feature | Acceptable for this app given small catalog size (estimate: <150 keys total) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| localStorage + SSR disabled routes | Attempting to read localStorage during SSR (even checking `browser` is missed) | Always guard `localStorage` access with `if (typeof window !== 'undefined')` or import from `$app/environment` — even with SSR disabled, `+layout.ts` runs on server during prerendering if ever enabled |
| svelte-i18n `init()` | Calling `init()` inside a component's `onMount` | Call `init()` in the module scope of a layout script (`+layout.ts` or `+layout.svelte` `<script>`) so it runs once before any child component renders |
| ICU plural format in svelte-i18n | Writing `{count, plural, one {1 punto} other {# puntos}}` without testing count=0 | Spanish and Catalan use `one` for n=1 only — count=0 falls to `other` which is correct, but test explicitly |
| Tailwind v4 + RTL | Not relevant (Catalan/Spanish are LTR) | N/A — no RTL concern for these three locales |
| WebSocket messages with player names | Translating `${player.name} has joined` as a static key | Treat the message template as a translation key with a named interpolation: `t('player.joined', { name: player.name })` — never embed user content in the key |

---

## Performance Traps

For this app's scale (5–10 players, one event night), performance is not a concern. The only relevant trap:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reactive translation function called on every render cycle | Imperceptible lag on modern phones | Keep translation calls as plain function calls on a reactive catalog object, not as derived state chains | Irrelevant at this scale — game has <20 active components |
| Importing 3 locale JSON files in the main bundle | ~10KB increase in initial JS | Acceptable — no lazy loading needed for 3 small catalogs | Not a concern until catalogs exceed 50KB+ |

---

## Security Mistakes

No i18n-specific security concerns for this app. Translation catalogs are static developer-controlled JSON files — no user-supplied content enters the catalogs. The only adjacent concern:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Interpolating user content (player names) into translation strings via `innerHTML` | XSS if a player name contains HTML | Always use text interpolation (`textContent`-safe), never `{@html $t('key', { name })}` with `@html`; Svelte's default template rendering is XSS-safe |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No language picker on the join screen before the player submits their name | Players who prefer Catalan/Spanish must navigate away and come back | Language picker must be visible on the join screen before name submission — it's the first thing they see |
| Language picker changes locale but reloads the page, losing join form state | Player has to re-type their name after switching language | Locale switch must be in-place with no navigation — use reactive state update, not `goto()` |
| Same locale for all players because locale is set once on a shared device | Guest hands phone to another player; the new player cannot change language | Per-device localStorage locale is correct — but the language picker must be accessible at all times (e.g., persisted in the header or accessible from the party view) |
| Abbreviating "Català" in the language picker to save space | Non-obvious to users unfamiliar with the word | Show the full endonym: "Català" (not "CA"), "Español" (not "ES"), "English" (not "EN") |
| Forgetting to update `<html lang="...">` when locale changes | Screen readers announce content in the wrong language voice | Update `document.documentElement.lang` on every locale change |

---

## "Looks Done But Isn't" Checklist

- [ ] **Reactivity:** Switch locale via the language picker — every string on screen updates without a page reload
- [ ] **No FOUC:** Reload the page with Catalan stored in localStorage — UI paints in Catalan immediately, no English flash
- [ ] **Missing key fallback:** Remove one key from the Catalan catalog, switch to Catalan — confirm the English fallback string appears (not empty string, not the key name)
- [ ] **Placeholders:** Switch to Spanish — verify `<input placeholder>` text on the join screen shows in Spanish
- [ ] **aria-labels:** Switch to Catalan — run axe accessibility scan or inspect DOM; confirm `aria-label` values are in Catalan
- [ ] **Toast/announcements:** Trigger a power-up announcement with Spanish active — confirm the announcement text is in Spanish
- [ ] **User content NOT translated:** Admin-typed chapter names and trivia questions display exactly as typed, unchanged by locale
- [ ] **Catalog completeness:** English, Catalan, and Spanish catalogs have identical key sets — no key present in English but missing elsewhere
- [ ] **`<html lang>`:** Inspect `document.documentElement.lang` after switching locale — it reflects the active locale

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale translation after locale switch | LOW | Add `$state` to locale variable; ensure catalog reference is reactive |
| Missing key shows empty string in production | LOW | Add `handleMissingMessage` fallback to English value; re-deploy catalog JSON |
| Over-extracted user content (chapter names in catalog) | LOW | Remove keys from catalog, replace `$_()` call with direct variable reference |
| FOUC despite inline script | MEDIUM | Verify inline script is in `app.html` not `+layout.svelte` (which renders after first paint); check that catalog load is synchronous |
| svelte-i18n store reactivity broken in `.svelte.ts` file | HIGH (rewrite required) | Migrate to rune-native i18n module — this is why Option B (custom rune-based solution) is recommended over svelte-i18n |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Store/rune interop broken (Pitfall 1) | i18n Infrastructure | Switch locale, verify all strings update without reload |
| FOUC on localStorage load (Pitfall 2) | i18n Infrastructure | Reload with non-default locale in localStorage; confirm no English flash |
| Missing key → empty string (Pitfall 3) | i18n Infrastructure | Remove a key from CA catalog; confirm English fallback renders |
| Under-extraction: aria-labels, placeholders, toasts (Pitfall 4) | String Extraction | Audit checklist — grep for `aria-label`, `placeholder`, programmatic strings |
| Over-extraction: user content (Pitfall 5) | String Extraction | Confirm catalog contains no chapter/trivia/player content |
| Locale state set too late, stuck translations (Pitfall 6) | i18n Infrastructure | Test locale initialization order before any string extraction begins |

---

## Sources

- Svelte 5 rune/store interop: [Svelte docs — stores](https://svelte.dev/docs/svelte/stores), [Mainmatter — global state in Svelte 5](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/), [Loopwerk — refactoring stores to $state](https://www.loopwerk.io/articles/2025/svelte-5-stores/)
- Rune-native i18n pattern: [CoMiGo Games — i18n for Svelte 5](https://comigo.games/en/n/i18n-library-for-svelte5/)
- Flash of Wrong Locale / FOWL: [David Bushell — SvelteKit i18n and FOWL (2026-03-11)](https://dbushell.com/2026/03/11/sveltekit-internationalization-flash-of-wrong-locale/)
- svelte-i18n missing key handling: [svelte-i18n Methods docs](https://github.com/kaisermann/svelte-i18n/blob/main/docs/Methods.md), [svelte-i18n issue #172](https://github.com/kaisermann/svelte-i18n/issues/172)
- svelte-i18n SvelteKit setup: [svelte-i18n Svelte-Kit.md](https://github.com/kaisermann/svelte-i18n/blob/main/docs/Svelte-Kit.md)
- Paraglide localStorage strategy: [Paraglide-SvelteKit docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy)
- Hardcoded string extraction and over/under extraction: [Hard Coded Strings Extraction — i18n-ally](https://github.com/lokalise/i18n-ally/wiki/Hard-coded-Strings-Extraction), [SimpleLocalize best practices 2026](https://simplelocalize.io/blog/posts/best-practices-in-software-localization/)
- Spanish/Catalan plural rules: [CLDR Language Plural Rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html)
- aria-label translation: [Adrian Roselli — aria-label Does Not Translate](https://adrianroselli.com/2019/11/aria-label-does-not-translate.html)
- SvelteKit i18n community discussion: [sveltejs/kit #9618](https://github.com/sveltejs/kit/discussions/9618)

---
*Pitfalls research for: Retrofitting i18n into SvelteKit 5 + Svelte 5 runes (v1.3 Localization milestone)*
*Researched: 2026-04-17*
