// src/lib/i18n/locale.svelte.ts
// Decisions: D-02 (file location), D-03 (localStorage key), D-04 (window.__initialLocale),
//            D-06 ($state rune, single source of truth), D-07 (navigator.language detection)
// INFRA-02, INFRA-03, INFRA-04

import {
  setLocale as paraglideSetLocale,
  getLocale,
} from '$lib/paraglide/runtime.js';

// NOTE: This version of @inlang/paraglide-js (v2.16.0) does not export onSetLocale or
// onSetLanguageTag. The $state bridge is maintained by calling paraglideSetLocale with
// { reload: false } and manually updating the $state variable in setLocale().
//
// NOTE: Svelte 5 does not allow directly exporting a reassignable $state from a module.
// Instead, we export a reactive class instance. Components access locale via locale.current.

const LOCALE_KEY = 'octapp:locale';
const SUPPORTED = ['en', 'ca', 'es'] as const;
export type SupportedLocale = typeof SUPPORTED[number];

// Reactive locale state wrapped in a class to satisfy Svelte 5's module export constraint.
// Components read `locale.current` instead of a bare `locale` variable.
class LocaleState {
  current = $state<SupportedLocale>(getLocale() as SupportedLocale);
}

export const locale = new LocaleState();

// Public API: change locale, persist to localStorage, update html[lang] (VERIFY-03).
// All components must call this function — never call paraglideSetLocale directly.
export function setLocale(next: SupportedLocale): void {
  localStorage.setItem(LOCALE_KEY, next);
  document.documentElement.lang = next;
  // Call Paraglide setLocale with reload:false — we handle reactivity via $state update below.
  // Without reload:false, Paraglide v2 would trigger a full page reload on every locale switch.
  paraglideSetLocale(next, { reload: false });
  // Manually update $state because this runtime does not export an onSetLocale callback.
  locale.current = next;
}

// Detects nearest supported locale from browser navigator.language (D-07, INFRA-04).
// Used by initLocale() on first visit when no octapp:locale is stored.
function detectLocale(): SupportedLocale {
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('ca')) return 'ca';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

// Called once inside onMount in +layout.svelte (INFRA-03, INFRA-04).
// Reads window.__initialLocale set synchronously by the FOUC inline script in app.html (D-04).
// Falls back to detectLocale() only if __initialLocale is absent or invalid.
// Never calls localStorage directly — the FOUC script already read it.
export function initLocale(): void {
  const initial = (window as unknown as Record<string, unknown>).__initialLocale as SupportedLocale | undefined;
  if (initial && (SUPPORTED as readonly string[]).includes(initial)) {
    paraglideSetLocale(initial, { reload: false });
    // locale $state is updated manually since there is no onSetLocale callback
    locale.current = initial;
    return;
  }
  // Fallback: __initialLocale not set (FOUC script not yet added in Plan 03).
  // Use browser detection so locale module works independently during development.
  const fallback = detectLocale();
  paraglideSetLocale(fallback, { reload: false });
  locale.current = fallback;
}
