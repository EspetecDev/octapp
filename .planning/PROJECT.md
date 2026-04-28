# Bachelor Party Game

## What This Is

A smartphone-targeted interactive web game built for a bachelor party. The groom works through phone-based minigames and challenges across the full night to unlock rewards, while the rest of the group (5-10 people) participates by earning and spending points to help or sabotage him. A host/admin controls which phases unlock as the night progresses.

**Status: Shipped ✅** — live at https://octapp-production.up.railway.app

## Core Value

The groom has a memorable, personalized gauntlet to run through his own bachelor party — driven by his friends, full of surprises.

## Current Milestone: v1.3 Localization

**Goal:** Make all UI strings translatable and let each player pick their preferred language (Catalan, Spanish, or English) on the join screen — with no effect on other devices.

**Target features:**
- i18n infrastructure: message catalog for en / ca / es, English as base/fallback
- Language picker on the join screen (persisted per device)
- All static UI strings extracted and translated across all views (join, groom, party, admin dashboard + setup)
- Per-player locale — each device renders independently in their chosen locale

## Current State: v1.3 in progress (Phase 12 complete 2026-04-28)

- **Live URL:** https://octapp-production.up.railway.app
- **Tech:** SvelteKit 5 + Bun WebSocket server, Railway (single replica, in-memory state)
- **LoC:** ~3,847 (TypeScript/Svelte)
- **Coverage:** 10 phases, 31 plans complete

## Requirements

### Validated

- ✓ SvelteKit 5 + Bun WebSocket server on a single Railway service — v1.0
- ✓ 6-char join code session creation + real-time full-state broadcast — v1.0
- ✓ Client-side reconnect with exponential backoff + full-state snapshot on reconnect — v1.0
- ✓ Four production views: join wizard, admin dashboard, groom waiting, group waiting — v1.0
- ✓ Admin pre-event setup: configure chapters (trivia questions, scavenger clues, rewards) and power-up/sabotage catalog — v1.0
- ✓ Admin live-night controls: chapter progression via Unlock Chapter, real-time scores view — v1.0
- ✓ Chapter transition: recap card overlay on groom and party pages on chapter unlock — v1.0
- ✓ Game type system: Chapter, TriviaQuestion, PowerUp types + SAVE_SETUP/UNLOCK_CHAPTER handlers — v1.0
- ✓ Trivia minigame — question + 4 options, 15s radial countdown, client-side answer check, win/loss overlay + haptic — v1.0
- ✓ Memory/matching minigame — 4×3 grid, CSS flip, immutable pair matching, 30s countdown — v1.0
- ✓ Scavenger hunt mechanic — clue display, optional hint (−10pts), groom "I Found It!" + admin override — v1.0
- ✓ Reward reveal — full-screen unlock on groom + party pages; past rewards accordion on groom — v1.0
- ✓ Groom view: screen router (minigame → scavenger → reward) driven by Chapter state flags — v1.0
- ✓ Group token economy: per-player balances, earn button, context-filtered shop, power-ups + sabotages — v1.0
- ✓ Power-up/sabotage effects (timer delta, scramble options, emoji-storm distraction overlay) with live announcements — v1.0
- ✓ Railway deployment — live public URL, HTTPS, WebSocket 101 confirmed, ADMIN_TOKEN secured — v1.1
- ✓ Multi-device validation — admin + groom + party tested simultaneously on real hardware — v1.1
- ✓ Android back button guard — beforeNavigate + history.pushState on groom and party pages — v1.1
- ✓ Server crash protection — uncaughtException + unhandledRejection handlers, no process.exit() — v1.1
- ✓ `GameConfig` TypeScript type + `serializeConfig` + `validateConfig` as a pure isolated module — v1.2
- ✓ Admin can export full game setup as a JSON file (with iOS Safari `window.open()` fallback) — v1.2
- ✓ Admin can import a JSON file to replace current setup — validation, confirm prompt, `restoredFromState` guard — v1.2

### Active (v1.3 in progress)

- I18N-01: Paraglide v2 scaffold + en/ca/es catalogs ✓ Phase 11 + 12
- I18N-02: Complete Catalan catalog (146 keys, 0 missing) ✓ Phase 12
- I18N-03: Complete Spanish catalog (146 keys, 0 missing) ✓ Phase 12
- I18N-04: User-authored content excluded from catalogs ✓ Phase 12
- I18N-05: Language picker UI on join screen — Phase 13
- I18N-06: Per-player locale persistence (localStorage) — Phase 14

### Out of Scope

- Native mobile app — web browser is sufficient; no install friction is the goal
- User accounts / profiles — one-time event; no persistent identity needed
- Video recording/upload challenges — adds storage/backend complexity for marginal party value
- Large-scale multiplayer (20+ players) — designed for 5-10; over-engineering real-time infra is waste
- GPS/location-based scavenger hunt — riddles + manual confirm is simpler and more social
- Shared physical screen / TV mode — phones-only confirmed; no shared display to design for
- Persistent game history across sessions — one-time event; no need for cross-session data
- Vercel / serverless deployment — architecturally incompatible with persistent WebSocket game server
- Phone sensor minigame (tilt/balance) — instant-win normalization bug deemed not worth fixing; feature deleted in v1.1 (commit d4b4607)

## Context

- One-time event: game built and shipped for a single bachelor party
- Smartphone-first: all players access via browser on their phones, no install required
- Small group (5-10 people) joining the same game session via a code or link
- Full night arc: admin drives pacing by unlocking chapters at the right moment
- Content (trivia questions, scavenger locations, rewards, catalog) configured before the event via /admin/setup
- Tech stack confirmed: SvelteKit 5 + Svelte 5 runes, Bun WebSocket, Tailwind v4 CSS-first, Railway single replica

## Constraints

- **Platform**: Mobile web browser — all interactions must work on iOS/Android Safari/Chrome
- **Deployment**: Single Railway service URL shared with guests; no complex infra
- **Real-time**: Group interactions require live sync — Bun WebSocket with full-state broadcast
- **One-time use**: No persistence beyond single session; data is ephemeral in-memory

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | No install friction for guests; browser APIs sufficient | ✓ Good — guests joined without friction |
| Admin-controlled chapter unlocking | Host drives pacing, prevents groom from rushing ahead | ✓ Good — worked as designed |
| Power-up/sabotage economy | Gives group meaningful participation without making it adversarial | ✓ Good — group economy built and deployed |
| Single in-memory session per process | Phase 1 scope; one game at a time | ✓ Good — sufficient for a one-night event |
| CSS class toggle (.visible) for overlays | Allows fade-out animation to complete before removal | ✓ Good — consistent pattern across all overlays |
| SvelteKit SSR disabled on all game routes | Browser-API-dependent code (WebSocket, DeviceMotion) can't SSR | ✓ Good — no hydration issues |
| No process.exit() in error handlers | Preserves in-memory game state on Railway when errors occur | ✓ Good — server stays up and sessions survive |
| Delete sensor minigame (v1.1) | Instant-win normalization bug (divisor 9.8 vs 19.6); not worth fixing | ✓ Good — cleaner codebase, trivia + memory sufficient |
| beforeNavigate + history.pushState for back button | SvelteKit navigation guard blocks hardware Android back | ✓ Good — verified on real Android device |
| iOS Safari blob download via `window.open()` | WebKit bug #216918 — `<a download>` + blob URL silently fails on iOS | ✓ Good — export works on all devices |
| `$state.snapshot()` for import form population | `structuredClone` throws on Svelte 5 reactive proxy; `$state.snapshot()` produces a plain object | ✓ Good — fixed mid-E2E; pattern to follow for future rune mutations |
| `restoredFromState = true` set immediately on import | Prevents the next `STATE_SYNC` broadcast from silently overwriting imported form values | ✓ Good — critical guard for import correctness |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 — v1.3 Localization started*
