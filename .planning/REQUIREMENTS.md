# Requirements: Bachelor Party Game — v1.3 Localization

**Defined:** 2026-04-18
**Core Value:** The groom has a memorable, personalized gauntlet to run through his own bachelor party — driven by his friends, full of surprises.

## v1.3 Requirements

Requirements for the v1.3 Localization milestone. Each maps to roadmap phases.

### i18n Infrastructure

- [ ] **INFRA-01**: App builds and runs with `@inlang/paraglide-js` v2, three locales (en/ca/es) configured in `project.inlang/settings.json`, and English as the compile-time fallback locale
- [ ] **INFRA-02**: A reactive `src/lib/i18n/locale.svelte.ts` module wraps Paraglide's `setLocale`/`getLocale` so all components source locale state from a single `$state` rune — never importing from Paraglide runtime directly
- [ ] **INFRA-03**: Active locale is written to `localStorage` on change and read back on mount, persisting the user's choice across page refreshes
- [ ] **INFRA-04**: On first visit (no stored locale), app auto-detects browser preferred language via `navigator.language` and applies nearest supported locale (ca/es/en)
- [ ] **INFRA-05**: App prevents flash of wrong locale (FOUC) via an inline `<script>` in `app.html` that reads `localStorage` synchronously before the SPA boots

### String Catalog

- [ ] **I18N-01**: All static UI strings across all views (join wizard, groom view, party/group view, admin dashboard, admin setup, shared components) are extracted to `messages/en.json` — no hardcoded UI strings remain in any Svelte template
- [ ] **I18N-02**: All extracted strings have Catalan translations in `messages/ca.json`; any missing key falls back to English silently
- [ ] **I18N-03**: All extracted strings have Spanish translations in `messages/es.json`; any missing key falls back to English silently
- [ ] **I18N-04**: User-authored content (chapter names, trivia questions, scavenger clues, reward text, player names) is explicitly excluded from the catalog and renders as-is from game state

### Language Picker

- [ ] **PICKER-01**: Join screen displays a 3-pill language picker showing native language names ("English · Català · Español") with a minimum 44px tap target on each option
- [ ] **PICKER-02**: Selecting a locale in the picker updates all visible UI strings immediately without a page reload or loss of join form state
- [ ] **PICKER-03**: Picker visually reflects the currently active locale (filled/highlighted pill on the selected option)

### Verification

- [ ] **VERIFY-01**: A locale change on one device does not affect any other connected device — locale is fully per-device
- [ ] **VERIFY-02**: Locale is absent from all WebSocket messages and is not part of server-side game state
- [ ] **VERIFY-03**: The `html[lang]` attribute updates to reflect the active locale on every locale change
- [ ] **VERIFY-04**: Locale persists through page refresh and WebSocket reconnection on both iOS Safari and Android Chrome

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Language Picker

- **PICKER-04**: In-game language switcher accessible from the party/group view header during a live session

### Localization Quality

- **I18N-05**: ICU pluralization for count-bearing strings (token balances, player counts) with correct ca/es plural forms ("1 punt / 2 punts")
- **I18N-06**: Locale-aware number formatting for scores and token values

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| URL-based locale routing | Conflicts with join-code WebSocket flow; causes production 404s with adapter-static (Paraglide issue #503) |
| Translating user-authored content | Chapter names, trivia, clues, rewards come from game state — not static strings |
| Flag icons as locale identifiers | UX anti-pattern: flags represent countries, not languages |
| External translation management platform | One-time event app; simple JSON catalogs are sufficient |
| Server-side locale detection (Accept-Language header) | SSR is disabled on all game routes; locale is client-only |
| Right-to-left (RTL) language support | Not needed for ca/es/en |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 11 | Pending |
| INFRA-02 | Phase 11 | Pending |
| INFRA-03 | Phase 11 | Pending |
| INFRA-04 | Phase 11 | Pending |
| INFRA-05 | Phase 11 | Pending |
| I18N-01 | Phase 12 | Pending |
| I18N-02 | Phase 12 | Pending |
| I18N-03 | Phase 12 | Pending |
| I18N-04 | Phase 12 | Pending |
| PICKER-01 | Phase 13 | Pending |
| PICKER-02 | Phase 13 | Pending |
| PICKER-03 | Phase 13 | Pending |
| VERIFY-01 | Phase 14 | Pending |
| VERIFY-02 | Phase 14 | Pending |
| VERIFY-03 | Phase 14 | Pending |
| VERIFY-04 | Phase 14 | Pending |

**Coverage:**
- v1.3 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-18*
*Last updated: 2026-04-17 — traceability populated after roadmap creation*
