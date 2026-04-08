# Bachelor Party Game

## What This Is

A smartphone-targeted interactive web game built for a bachelor party. The groom works through phone-based minigames and challenges across the full night to unlock rewards, while the rest of the group (5-10 people) participates by earning and spending points to help or sabotage him. A host/admin controls which phases unlock as the night progresses.

## Core Value

The groom has a memorable, personalized gauntlet to run through his own bachelor party — driven by his friends, full of surprises.

## Requirements

### Validated

- [x] SvelteKit 5 + Bun WebSocket server on a single Railway service — Validated in Phase 01: Foundation
- [x] 6-char join code session creation + real-time full-state broadcast — Validated in Phase 01: Foundation
- [x] Client-side reconnect with exponential backoff + full-state snapshot on reconnect — Validated in Phase 01: Foundation
- [x] Four production views: join wizard, admin dashboard, groom waiting, group waiting — Validated in Phase 01: Foundation

### Active

- [ ] Admin panel to manage the night: unlock phases, configure content before the event
- [ ] Groom view: progress through locked phases, completing minigames to advance
- [ ] Group view: join the game on their phones, earn points, spend them on power-ups and sabotages
- [ ] Trivia minigame — questions about the groom submitted by friends
- [ ] Phone sensor minigame — tilt, shake, or tap-based challenge
- [ ] Memory/puzzle minigame — match cards or solve a puzzle
- [ ] Scavenger hunt mechanic — app gives riddles/directions to find real-world items
- [ ] Real-time multiplayer sync — group sees groom's progress; power-ups/sabotages take effect live
- [ ] Phase system — admin unlocks phases throughout the night (e.g., dinner → bar → club)
- [ ] Reward reveal — completing a phase unlocks something (dare, item clue, embarrassing content, etc.)

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
*Last updated: 2026-04-08 — Phase 01 Foundation complete*
