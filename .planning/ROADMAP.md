# Roadmap: Bachelor Party Game

## Milestones

- ✅ **v1.1 Deployment & Testing** — Phases 1–7 (shipped 2026-04-13) — [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Load Preconfigured Games** — Phases 8–10 (shipped 2026-04-17) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 Localization** — Phases 11–14 (in progress)

## Phases

<details>
<summary>✅ v1.1 Deployment & Testing (Phases 1–7) — SHIPPED 2026-04-13</summary>

All 7 phases complete. Full phase details, plans, and requirements in the milestone archive:
[milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Load Preconfigured Games (Phases 8–10) — SHIPPED 2026-04-17</summary>

All 3 phases complete. Full phase details, plans, and requirements in the milestone archive:
[milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 🚧 v1.3 Localization (In Progress)

**Milestone Goal:** Make all UI strings translatable and let each player pick their preferred language (Catalan, Spanish, or English) on the join screen — with no effect on other devices.

- [ ] **Phase 11: i18n Infrastructure** - Paraglide v2 wired, reactive locale module live, localStorage persistence and FOUC prevention proven correct
- [ ] **Phase 12: String Catalog** - All static UI strings extracted to en/ca/es JSON catalogs with no hardcoded strings remaining in any template
- [ ] **Phase 13: Language Picker UI** - 3-pill language picker on the join screen with immediate reactivity, active state, and browser auto-detection
- [ ] **Phase 14: Multi-Device Verification** - Per-device locale isolation and production build correctness confirmed on iOS Safari and Android Chrome

## Phase Details

### Phase 11: i18n Infrastructure
**Goal**: Paraglide JS v2 is installed and correctly wired so locale switching works end-to-end — reactive state, localStorage persistence, browser auto-detection, and FOUC prevention all proven before any string is extracted
**Depends on**: Phase 10
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. `vite build` completes without errors after adding Paraglide v2 Vite plugin and `project.inlang/settings.json` with en/ca/es locales and English as fallback
  2. Switching locale in the browser updates reactive state in `src/lib/i18n/locale.svelte.ts` and reflects in all components that consume it — without a page reload
  3. The chosen locale survives a page refresh: `localStorage` is written on change and read back on mount via `initLocale()` called inside `onMount`
  4. On first visit (no stored locale), the app applies the nearest supported locale derived from `navigator.language` rather than defaulting silently to English
  5. No flash of wrong locale occurs on load: an inline `<script>` in `app.html` reads `localStorage` synchronously before the SPA boots
**Plans**: 3 plans
Plans:
- [x] 11-01-PLAN.md — Scaffold Paraglide v2, correct vite.config.ts/svelte.config.js/settings.json, create message stubs, verify build
- [x] 11-02-PLAN.md — Create locale.svelte.ts reactive module, wire initLocale() into +layout.svelte onMount
- [ ] 11-03-PLAN.md — FOUC inline script in app.html, verification stub on join page, human verify end-to-end
**UI hint**: yes

### Phase 12: String Catalog
**Goal**: Every static UI string across all views and shared components is extracted to `messages/en.json` and fully translated in `messages/ca.json` and `messages/es.json`, leaving no hardcoded strings in any Svelte template
**Depends on**: Phase 11
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04
**Success Criteria** (what must be TRUE):
  1. `messages/en.json` contains all static UI strings from join wizard, groom view, party/group view, admin dashboard, admin setup, and shared components — including `aria-label` attributes, `placeholder` text, and programmatic strings in WebSocket error handlers and toast messages
  2. `messages/ca.json` and `messages/es.json` each contain translations for every key in `en.json`; no key is missing (any missing key falls back to English silently at runtime)
  3. No hardcoded UI string remains in any `.svelte` template — a search for quoted UI text across all route files returns zero matches
  4. User-authored content (chapter names, trivia questions, scavenger clues, reward text, player names) is not present in any catalog file and renders directly from game state
**Plans**: 5 plans
Plans:
- [ ] 12-01-PLAN.md — Extract join page + shared components (LandscapeOverlay, ReconnectingOverlay, MemoryMinigame, TriviaMinigame, ScavengerScreen, RadialCountdown, RewardScreen) into en.json
- [ ] 12-02-PLAN.md — Extract groom view + party/group view into en.json
- [ ] 12-03-PLAN.md — Extract admin dashboard + admin setup into en.json
- [ ] 12-04-PLAN.md — Audit complete en.json, present to user, collect ca/es translations (human checkpoint)
- [ ] 12-05-PLAN.md — Wire ca/es translations, remove Phase 11 stub key, final key-parity verification

### Phase 13: Language Picker UI
**Goal**: The join screen displays a working 3-pill language picker that updates all UI strings immediately on selection, reflects the active locale visually, and requires no page reload or loss of join form state
**Depends on**: Phase 11
**Requirements**: PICKER-01, PICKER-02, PICKER-03
**Success Criteria** (what must be TRUE):
  1. The join screen shows three pill buttons labeled "English", "Català", and "Español" (native names, not ISO codes or flags), each with a minimum 44px tap target on mobile
  2. Tapping a locale pill updates all visible UI strings immediately without a page reload and without clearing any text already entered in the join form
  3. The pill corresponding to the currently active locale is visually distinct (filled or highlighted) at all times, including on initial load
**Plans**: TBD
**UI hint**: yes

### Phase 14: Multi-Device Verification
**Goal**: Per-device locale isolation is confirmed correct in a production build, `html[lang]` updates on every locale change, locale persists through refresh and reconnection on real iOS Safari and Android Chrome devices
**Depends on**: Phase 12, Phase 13
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. Changing locale on one connected device does not change the locale or re-render any string on any other connected device — confirmed with two real devices open to the same session
  2. All WebSocket messages are inspected and confirmed to contain no locale field; server-side game state object contains no locale property
  3. The `html[lang]` attribute updates to the correct locale code on every locale change — confirmed via browser DevTools on both iOS and Android
  4. Locale persists through a page refresh and through a forced WebSocket reconnect on both iOS Safari and Android Chrome
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.1 | 4/4 | Complete | 2026-04-13 |
| 2. Admin & Game Structure | v1.1 | 4/4 | Complete | 2026-04-13 |
| 3. Groom Experience | v1.1 | 7/7 | Complete | 2026-04-13 |
| 4. Group Economy & Multiplayer | v1.1 | 4/4 | Complete | 2026-04-13 |
| 5. Railway Deploy & Smoke Test | v1.1 | 4/4 | Complete | 2026-04-13 |
| 6. Three-Device Validation | v1.1 | 4/4 | Complete | 2026-04-13 |
| 7. Mobile Bug Fixes | v1.1 | 4/4 | Complete | 2026-04-13 |
| 8. Config Serializer | v1.2 | 1/1 | Complete | 2026-04-14 |
| 9. Export | v1.2 | 1/1 | Complete | 2026-04-16 |
| 10. Import + E2E Verification | v1.2 | 2/2 | Complete | 2026-04-17 |
| 11. i18n Infrastructure | v1.3 | 2/3 | In Progress|  |
| 12. String Catalog | v1.3 | 0/5 | Not started | - |
| 13. Language Picker UI | v1.3 | 0/? | Not started | - |
| 14. Multi-Device Verification | v1.3 | 0/? | Not started | - |
