# Bachelor Party Game

## What This Is

A smartphone-targeted interactive web game built for a bachelor party. The groom works through phone-based minigames and challenges across the full night to unlock rewards, while the rest of the group (5-10 people) participates by earning and spending points to help or sabotage him. A host/admin controls which phases unlock as the night progresses.

## Core Value

The groom has a memorable, personalized gauntlet to run through his own bachelor party — driven by his friends, full of surprises.

## Current Milestone: v1.1 Deployment & Testing

**Goal:** Deploy to Railway and validate the full game on real devices.

**Target features:**
- Railway deployment — configure env vars, deploy, get live public URL
- Multi-device smoke test — admin on PC, groom + party on 2 phones
- Bug fixing — fix issues surfaced during real multi-device play

## Requirements

### Validated

- [x] SvelteKit 5 + Bun WebSocket server on a single Railway service — Validated in Phase 01: Foundation
- [x] 6-char join code session creation + real-time full-state broadcast — Validated in Phase 01: Foundation
- [x] Client-side reconnect with exponential backoff + full-state snapshot on reconnect — Validated in Phase 01: Foundation
- [x] Four production views: join wizard, admin dashboard, groom waiting, group waiting — Validated in Phase 01: Foundation
- [x] Admin pre-event setup: configure chapters (trivia questions, scavenger clues, rewards) and power-up/sabotage catalog — Validated in Phase 02: Admin & Game Structure
- [x] Admin live-night controls: chapter progression via Unlock Chapter, real-time scores view — Validated in Phase 02: Admin & Game Structure
- [x] Chapter transition: recap card overlay on groom and party pages on chapter unlock — Validated in Phase 02: Admin & Game Structure
- [x] Game type system: Chapter, TriviaQuestion, PowerUp types + SAVE_SETUP/UNLOCK_CHAPTER handlers — Validated in Phase 02: Admin & Game Structure
- [x] Trivia minigame — question + 4 options, 15s radial countdown, client-side answer check, win/loss overlay + haptic — Validated in Phase 03: Groom Experience
- [x] Phone sensor minigame — iOS permission gate, DeviceMotion tilt meter (≥80% win), 30s countdown — Validated in Phase 03: Groom Experience
- [x] Memory/matching minigame — 4×3 grid, CSS flip, immutable pair matching, 30s countdown — Validated in Phase 03: Groom Experience
- [x] Scavenger hunt mechanic — clue display, optional hint (−10pts), groom "I Found It!" + admin override — Validated in Phase 03: Groom Experience
- [x] Reward reveal — full-screen unlock on groom + party pages; past rewards accordion on groom — Validated in Phase 03: Groom Experience
- [x] Groom view: screen router (minigame → scavenger → reward) driven by Chapter state flags — Validated in Phase 03: Groom Experience

### Active

- [x] Railway deployment — live public URL, production env vars configured — Validated in Phase 05: Railway Deploy & Smoke Test
- [ ] Multi-device validation — all roles (admin, groom, party) tested simultaneously on real devices
- [ ] Bug fixes from real-device testing

### Out of Scope

- Native mobile app — web app is enough; no App Store distribution overhead
- Persistent accounts/profiles — one-time event, no login system needed
- Large-scale multiplayer (20+ players) — designed for 5-10, no need to over-engineer real-time infra
- Social challenges requiring video recording/upload — adds complexity without clear payoff for this group size

## Context

- One-time event: the game is built for a single bachelor party night
- Smartphone-first: all players access via browser on their phones, no install required
- Small group (5-10 people) joining the same game session via a code or link
- Full night arc: admin drives the pacing by unlocking phases at the right moment (e.g., at dinner, when they arrive at the bar, etc.)
- Minigames must work on mobile — touch input, portrait orientation, no keyboard assumptions
- Content (trivia questions, scavenger locations, rewards) needs to be configurable before the event

## Constraints

- **Platform**: Mobile web browser — all interactions must work on iOS/Android Safari/Chrome, no native APIs beyond what browsers expose (accelerometer for sensor games is fair game)
- **Deployment**: Must be hostable simply — a single URL the host shares; no complex infra needed
- **Real-time**: Group interactions (power-ups, sabotage) require live sync — need a lightweight real-time layer (WebSockets or similar)
- **One-time use**: No need for persistence beyond the single session; data can be ephemeral

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | No install friction for guests; browser APIs sufficient for sensor games | — Pending |
| Admin-controlled phase unlocking | Host drives pacing, prevents groom from rushing ahead or the night losing structure | — Pending |
| Power-up/sabotage economy | Gives the group meaningful participation without making it groom-vs-everyone — they choose how to use it | — Pending |

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
*Last updated: 2026-04-10 — Milestone v1.1 Deployment & Testing started*
