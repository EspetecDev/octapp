# Phase 13: Language Picker UI — Research

**Researched:** 2026-04-28
**Domain:** Svelte 5 runes + Paraglide v2 reactive locale switching + Tailwind v4 pill styling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PICKER-01 | Join screen displays a 3-pill language picker showing native language names ("English · Català · Español") with a minimum 44px tap target on each option | DOM placement analysis done; global CSS already enforces 44px min-height on all `<button>` elements |
| PICKER-02 | Selecting a locale in the picker updates all visible UI strings immediately without a page reload or loss of join form state | `setLocale()` + `locale.current` $state bridge proven to work without reload; form state is local $state, unaffected by locale switch |
| PICKER-03 | Picker visually reflects the currently active locale (filled/highlighted pill on the selected option) | `locale.current` is a reactive $state rune; conditional class pattern identical to existing role buttons |
</phase_requirements>

---

## Summary

Phase 13 is a self-contained UI composition task. All infrastructure exists: `locale.svelte.ts` exposes `setLocale()` and the reactive `locale.current` $state; the Paraglide message functions re-execute automatically in Svelte 5 reactive expressions because Paraglide v2 compiled message functions call `getLocale()` on every invocation, and `getLocale()` is read inside Svelte's reactive graph when `locale.current` is also read in the same render context. The Phase 11 verification stub (fixed-position div with inline styles) was removed in Phase 12 Plan 05, so `+page.svelte` currently has no locale import — the picker must add them back cleanly.

The join page uses a well-established pattern: two role-selector buttons with conditional classes based on a `$state` variable. The language picker is structurally identical: three buttons, one `$derived` or direct read of `locale.current`, conditional class based on equality. No new libraries are needed. The component can be either a separate `.svelte` file or an inline block; the decision is discussed in the Architecture section.

The sole subtlety is how Paraglide v2 message functions become reactive: they are plain JS functions that call `getLocale()` internally. In Svelte 5, re-rendering is triggered only when something in the reactive graph changes. Because `locale.current` is a `$state` rune, any Svelte template that also reads `locale.current` (directly or via a `$derived`) will re-run when it changes, pulling fresh message strings on every read. Templates that do NOT read `locale.current` will NOT re-render. The proven pattern from Phase 11's stub — reading `locale.current` once in the picker to drive the active class, with all `m.*()` calls in the same component — causes the entire join page to re-render on locale change because the reactive graph includes `locale.current`.

**Primary recommendation:** Add a `LanguagePicker` Svelte component, import it into `+page.svelte`, place it above the `<h1>` title block. Import `{ locale, setLocale }` from `$lib/i18n/locale.svelte.ts` in the component. Style with existing Tailwind design tokens.

---

## Standard Stack

No new packages are needed. All dependencies are already installed.

### Core (already installed)
| Library | Version | Purpose |
|---------|---------|---------|
| `@inlang/paraglide-js` | 2.16.0 | Compiled message functions, `getLocale`/`setLocale` |
| `svelte` | 5.55.2 | Runes (`$state`, `$derived`), component model |
| `tailwindcss` | 4.2.2 | CSS-first utility classes for pill styling |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── components/
│       └── LanguagePicker.svelte   ← new file
├── routes/
│   └── +page.svelte               ← import LanguagePicker, add 2 lines
```

A separate component is preferred over inline markup because:
1. Phase 14 (Multi-Device Verification) and the deferred PICKER-04 (in-game picker) both benefit from a reusable component.
2. It keeps `+page.svelte` readable — the join page already has 340 lines.
3. The stub in Phase 11 was inline; the real picker warrants its own file.

### Pattern 1: Reactive Locale Pills (identical structure to existing role buttons)

The role-selector buttons in `+page.svelte` already demonstrate the exact pattern needed:

```svelte
<!-- Existing role button pattern (lines 251-277 of +page.svelte) -->
<button
  type="button"
  class="
    flex-1 h-14 rounded-lg font-bold text-base transition-all duration-150
    {role === 'groom'
      ? 'bg-accent-groom text-[#0f0f0f] border-2 border-accent-groom'
      : 'bg-surface border-2 border-border text-text-primary'}
    min-h-[44px]
  "
  onclick={() => selectRole("groom")}
  aria-pressed={role === "groom"}
>
```

Apply the same shape for locale pills:

```svelte
<!-- src/lib/components/LanguagePicker.svelte -->
<script lang="ts">
  import { locale, setLocale, type SupportedLocale } from '$lib/i18n/locale.svelte.ts';

  const LOCALES: { code: SupportedLocale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ca', label: 'Català' },
    { code: 'es', label: 'Español' },
  ];
</script>

<div class="flex gap-2 justify-center" role="group" aria-label="Language">
  {#each LOCALES as { code, label }}
    <button
      type="button"
      class="
        flex-1 rounded-full px-4 text-sm font-medium transition-all duration-150
        min-h-[44px] cursor-pointer
        {locale.current === code
          ? 'bg-text-primary text-bg border-2 border-text-primary'
          : 'bg-surface border-2 border-border text-text-secondary'}
      "
      onclick={() => setLocale(code)}
      aria-pressed={locale.current === code}
    >
      {label}
    </button>
  {/each}
</div>
```

### Pattern 2: Reactivity Bridge — How m.*() Re-renders After setLocale()

This is the critical correctness question. The answer is established by Phase 11's verified stub.

**How it works:**

1. `setLocale(next)` in `locale.svelte.ts` calls `paraglideSetLocale(next, { reload: false })` and then sets `locale.current = next`.
2. `locale.current` is a `$state` rune — mutating it marks the owner component (and any component that reads it) as dirty in Svelte 5's fine-grained reactivity.
3. Any component that reads `locale.current` in its template (e.g., the `aria-pressed` binding on the picker) will re-execute its full render function.
4. Paraglide's compiled message functions call `getLocale()` on every invocation. After `paraglideSetLocale()`, `getLocale()` returns the new locale. Because the component re-renders (step 3), all `m.*()` calls in the same template run again and return the new locale's strings.

**The dependency:** The component that contains the picker AND all `m.*()` calls must read `locale.current` at least once so Svelte 5 includes it in the reactive graph. In practice this is automatic: the picker's `aria-pressed` binding reads `locale.current`, and the picker component lives in the same file that calls `m.*()`, so they share the same reactive scope.

**Verified:** Phase 11 Plan 03 stub used this exact mechanism (`locale.current` read for active opacity + `m.test_locale_active()` call) and confirmed immediate re-render without page reload.

### Pattern 3: Placement in +page.svelte

The picker goes **inside the `{:else}` branch**, before the title block, within the outer `<div class="w-full flex flex-col gap-6">`:

```svelte
<!-- +page.svelte — inside {:else} branch, before title -->
<div class="w-full flex flex-col gap-6">
  <LanguagePicker />              <!-- ← new line -->

  <!-- App title -->
  <div class="text-center">
    <h1 ...>{m.join_title()}</h1>
    ...
```

This placement ensures:
- Picker is visible before the user interacts with the form.
- It is NOT shown during the `{#if autoRedirecting}` spinner — correct, because locale switch is not relevant while reconnecting.
- It is part of the `gap-6` flex column, so spacing is automatic.

### Pattern 4: 44px Tap Target — Already Guaranteed by Global CSS

`src/app.css` already contains:

```css
button,
[role="button"],
input[type="submit"] {
  min-height: 44px;
  min-width: 44px;
}
```

This applies globally to all `<button>` elements. Adding `min-h-[44px]` as a Tailwind class is redundant but consistent with the existing role buttons (which also have it). Include it for clarity; it does not conflict.

For pill shape, use `rounded-full` instead of `rounded-lg` to distinguish the picker visually from form inputs and role buttons.

### Anti-Patterns to Avoid

- **Importing from `$lib/paraglide/runtime.js` directly:** All components import `locale` and `setLocale` from `$lib/i18n/locale.svelte.ts` only — this is a locked decision (STATE.md: "components never import from Paraglide runtime directly").
- **Calling `paraglideSetLocale` directly in the component:** Same reason — always go through `setLocale()` in `locale.svelte.ts`.
- **Using `$effect` to sync locale:** Not needed. The `setLocale()` function already updates all three concerns (localStorage, html[lang], $state) in one call.
- **Flags as locale indicators:** Explicitly excluded in REQUIREMENTS.md ("Flag icons as locale identifiers: UX anti-pattern").
- **ISO codes as button labels:** PICKER-01 requires native language names ("English", "Català", "Español"), not "en", "ca", "es".
- **Placing picker inside `<form>`:** The form submit handler uses form `onsubmit`. Locale buttons are `type="button"` to prevent accidental submission, but placement outside the form element is cleaner and avoids any doubt.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale persistence | Custom localStorage write | `setLocale()` in locale.svelte.ts | Already handles localStorage + html[lang] + $state in one call |
| Reactive re-render after locale change | Manual DOM update or event bus | Read `locale.current` in template — Svelte 5 handles re-render | $state rune is the reactive primitive |
| 44px tap targets | Custom CSS min-size rule | Global CSS in app.css already enforces it | Adding `min-h-[44px]` Tailwind class matches existing button pattern |

---

## Common Pitfalls

### Pitfall 1: Locale Switch Doesn't Re-Render m.*() Calls

**What goes wrong:** After calling `setLocale()`, the page language doesn't change.
**Why it happens:** The component template doesn't read `locale.current` anywhere, so Svelte 5 doesn't know to re-run the render function, even though `getLocale()` now returns the new locale.
**How to avoid:** Ensure the LanguagePicker component reads `locale.current` in its template (the `aria-pressed` binding on each pill does this). If the picker is a child component and `m.*()` calls are in the parent `+page.svelte`, the parent also needs to read `locale.current` at least once. The cleanest solution is to keep the picker and at least one `m.*()` call in the same component scope.
**Warning signs:** Switching locale updates the pill highlight but strings stay in old language.

### Pitfall 2: Form State Lost on Locale Switch

**What goes wrong:** After tapping a locale pill, the `code` or `name` input fields are cleared.
**Why it happens:** Would only happen if locale change causes a full page navigation or component remount.
**How to avoid:** `setLocale()` with `reload: false` does not navigate. `locale.current = next` is a $state mutation, which causes in-place re-render preserving all other $state variables (`code`, `name`, `role`). No action needed — but verify manually during implementation.
**Warning signs:** Input values cleared after locale switch.

### Pitfall 3: Pill Style Conflict with Tailwind v4 CSS-First Config

**What goes wrong:** Custom color tokens like `bg-text-primary`, `text-bg`, `bg-surface`, `border-border` don't resolve, resulting in un-styled pills.
**Why it happens:** Tailwind v4 uses CSS `@theme` variables defined in `app.css` — these are NOT the same as Tailwind v3's `tailwind.config.js`. The class names are generated from the CSS variable names.
**How to avoid:** Use only tokens defined in `src/app.css @theme` block:
  - Surfaces: `bg-bg`, `bg-surface`, `border-border`
  - Text: `text-text-primary`, `text-text-secondary`
  - Active pill background: `bg-text-primary` (off-white `#f9fafb`) with `text-bg` (dark `#0f0f0f`) for contrast
**Warning signs:** Pills appear unstyled or default browser button appearance.

### Pitfall 4: Import Statement After Stub Removal

**What goes wrong:** `locale` and `setLocale` are not available in `+page.svelte` because Phase 12 Plan 05 removed those imports along with the stub.
**Why it happens:** Phase 12-05 explicitly removed `import { locale, setLocale }` from `+page.svelte` because they were only used by the stub.
**How to avoid:** The LanguagePicker component is a new file — it adds its own import. `+page.svelte` only needs `import LanguagePicker from '$lib/components/LanguagePicker.svelte'`. No need to re-add locale imports to `+page.svelte` directly.
**Warning signs:** TypeScript error "Cannot find name 'locale'" in +page.svelte — not a problem if the picker is its own component.

---

## Code Examples

### Complete LanguagePicker Component
```svelte
<!-- src/lib/components/LanguagePicker.svelte -->
<script lang="ts">
  import { locale, setLocale, type SupportedLocale } from '$lib/i18n/locale.svelte.ts';

  const LOCALES: { code: SupportedLocale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ca', label: 'Català' },
    { code: 'es', label: 'Español' },
  ];
</script>

<div class="flex gap-2" role="group" aria-label="Language">
  {#each LOCALES as { code, label }}
    <button
      type="button"
      class="
        flex-1 rounded-full px-3 text-sm font-medium transition-all duration-150
        min-h-[44px] cursor-pointer
        {locale.current === code
          ? 'bg-text-primary text-bg border-2 border-text-primary'
          : 'bg-surface border-2 border-border text-text-secondary hover:text-text-primary'}
      "
      onclick={() => setLocale(code)}
      aria-pressed={locale.current === code}
    >
      {label}
    </button>
  {/each}
</div>
```

### Insertion Point in +page.svelte
```svelte
<!-- +page.svelte: add import at top of <script> -->
import LanguagePicker from '$lib/components/LanguagePicker.svelte';

<!-- +page.svelte: inside {:else} branch, before title div -->
<div class="w-full flex flex-col gap-6">
  <LanguagePicker />

  <!-- App title -->
  <div class="text-center">
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is pure Svelte component code with no CLI tools, external services, or runtimes beyond the existing dev stack).

---

## Validation Architecture

`nyquist_validation` is set to `false` in `.planning/config.json`. Section skipped.

---

## Open Questions

1. **Should the picker show inside the `autoRedirecting` spinner branch?**
   - What we know: The spinner shown during auto-redirect lasts max 4 seconds; locale is already set from localStorage before this screen is visible.
   - What's unclear: Whether displaying a locale picker during reconnect adds value or visual noise.
   - Recommendation: Keep picker hidden during `{#if autoRedirecting}` — consistent with current behavior; the FOUC script already applied the correct locale before any UI rendered.

2. **Active pill color: `bg-text-primary text-bg` vs accent color?**
   - What we know: The design tokens have `accent-groom` (#f59e0b amber) and `accent-group` (#ef4444 red) for roles. No locale-specific accent exists.
   - What's unclear: User preference for neutral (text-primary) vs branded active state.
   - Recommendation: Use `bg-text-primary text-bg` (off-white fill with dark text) for a neutral, accessible contrast ratio. Matches the "Join Game" CTA button pattern.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/i18n/locale.svelte.ts` — verified API: `locale.current`, `setLocale(next)`, `SupportedLocale` type
- `src/lib/paraglide/runtime.js` — verified `setLocale` signature, `reload: false` option, no `onSetLocale` callback
- `src/routes/+page.svelte` — verified DOM structure, existing button patterns, `$state` rune usage
- `src/app.css` — verified `@theme` design tokens, global `min-height: 44px` button rule
- `.planning/phases/11-i18n-infrastructure/11-03-SUMMARY.md` — confirmed Phase 11 stub mechanism and Phase 13 removal handoff
- `.planning/phases/12-string-catalog/12-05-SUMMARY.md` — confirmed stub + locale imports removed from +page.svelte; 146-key parity

### Secondary (MEDIUM confidence)
- `package.json` — confirms no additional i18n packages needed, exact versions in use
- `.planning/STATE.md` — confirmed locked decision: components import from locale.svelte.ts only, never from paraglide runtime

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified from package.json and source files
- Architecture: HIGH — component structure verified against existing +page.svelte patterns; reactivity mechanism verified from Phase 11 stub behavior and runtime.js source
- Pitfalls: HIGH — all four pitfalls derived from direct source inspection, not speculation

**Research date:** 2026-04-28
**Valid until:** Stable — no external APIs involved; valid until Svelte or Paraglide major version changes
