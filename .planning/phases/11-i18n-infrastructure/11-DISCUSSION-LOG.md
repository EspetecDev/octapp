# Phase 11: i18n Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 11-i18n-infrastructure
**Areas discussed:** Setup approach, FOUC prevention depth, Verification stub

---

## Setup Approach

| Option | Description | Selected |
|--------|-------------|----------|
| sv add paraglide scaffold | Run `npx sv add paraglide` — generates project.inlang/settings.json, patches vite.config.ts, adds message stubs, and updates app.html in one shot. Override anything that conflicts (e.g. URL strategy). | ✓ |
| Manual setup | Add the npm package, write project.inlang/settings.json and vite.config.ts changes by hand — more control but more steps and easier to miss a config detail. | |

**User's choice:** sv add paraglide scaffold
**Notes:** Override URL strategy during scaffold prompts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| src/lib/i18n/locale.svelte.ts | Own directory for the i18n module family — locale store, plus future helpers, all under src/lib/i18n/ | ✓ |
| src/lib/locale.svelte.ts | Flat in src/lib/ alongside socket.ts and other lib files | |

**User's choice:** src/lib/i18n/locale.svelte.ts
**Notes:** Own subdirectory keeps i18n concerns grouped.

---

## FOUC Prevention Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Set html[lang] + window.__initialLocale | Synchronously set both — browser never renders with wrong lang attribute, locale module reads window.__initialLocale in initLocale() to skip localStorage read again | ✓ |
| Only set window.__initialLocale | Just expose the stored value; locale module handles html[lang] after mount — simpler script but lang attribute may flicker on first paint | |
| Only set html[lang] | Update the lang attribute immediately; locale module still reads localStorage in onMount | |

**User's choice:** Set html[lang] + window.__initialLocale
**Notes:** Most complete prevention — no partial flicker.

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — just set lang + initialLocale | Paraglide renders catalog strings synchronously once locale is set — no layout shift expected; no need to hide content | ✓ |
| Yes — add data-locale-ready attribute | Add a data attribute removed by locale module after init — overkill for this app, adds flash of hidden content risk | |

**User's choice:** No CSS class or data attribute
**Notes:** Keeping the FOUC script minimal.

---

## Verification Stub

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary locale toggle in the join page | Add a small dev-visible 3-button strip to +page.svelte during Phase 11, clearly marked for removal in Phase 13 — proves reactivity visually with real strings | ✓ |
| Browser console test only | Call setLocale() from browser DevTools and verify strings update — no UI code needed, removed before Phase 13 | |
| Automated test (Playwright/Vitest) | Write a test that calls setLocale() and checks rendered strings — correct but adds test infra overhead | |

**User's choice:** Temporary locale toggle in the join page
**Notes:** Visual proof is better than console-only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom of the page, outside the form | Small row of 3 text buttons at the bottom — out of the way of the join form, easy to find and remove in Phase 13 | ✓ |
| Top of the page, above the title | Visible immediately but sits inside the main visual flow | |

**User's choice:** Bottom of the page, outside the form

---

## Claude's Discretion

- Exact Paraglide `onSetLocale` API name (may vary between v2 minor releases)
- Whether `setLocale()` alone triggers Svelte 5 reactivity or needs explicit `$state` assignment

## Deferred Ideas

None.
