# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.1 — Deployment & Testing

**Shipped:** 2026-04-13
**Phases:** 7 | **Plans:** 27 | **Timeline:** 7 days (2026-04-07 → 2026-04-13)

### What Was Built

- SvelteKit 5 + Bun WebSocket real-time game server — join by code, full-state sync, mobile-first
- Admin pre-event setup and live-night chapter control (recap card overlay on all devices)
- Two complete groom minigames (trivia, memory/matching) with radial countdown, haptics, win/loss overlays
- Scavenger hunt + reward reveal flow — groom-only history, party-wide full-screen reveal
- Group token economy — earn button, context-filtered shop, power-ups and sabotages with live announcements
- Railway production deploy — HTTPS + WebSocket confirmed, ADMIN_TOKEN secured, multi-device validated

### What Worked

- **GSD phase-by-phase planning** kept scope tight per phase. Type-contract plans (01, 02-01, 03-01, 04-01) first made server/client changes safe and predictable.
- **CSS class toggle pattern** for overlays (`.visible` + opacity) was established in Phase 1 and reused cleanly across all 7+ overlays without exception.
- **SvelteKit SSR-disabled at root layout** was a correct early decision — avoided hydration issues on every page.
- **Real-device testing in Phase 6** caught issues (sensor instant-win bug) that local dev never would. Cutting the sensor minigame was fast once the decision was made.
- **Separate `uncaughtException` + `unhandledRejection` handlers** with no `process.exit()` was exactly right for an in-memory server that can't afford wipes.

### What Was Inefficient

- **Phase 3 `01-PLAN`** (type contracts) should have been folded into Phase 2's type work — the split created friction when Phase 3 dependencies weren't fully enumerated.
- **MINI-01 checkbox** (trivia minigame) was never ticked in REQUIREMENTS.md despite the feature shipping in Phase 3 — small process slip that had to be fixed at archive time.
- **Phase 6 VERIFICATION.md was never generated** — the phase ran end-to-end and passed on real devices, but the verifier agent was never spawned. Evidence lives only in SUMMARY files. Technically fine, but breaks the formal audit chain.
- **Sensor minigame normalization bug** (divisor 9.8 vs 19.6) shipped into Phase 6 testing. The bug was in the Phase 4 implementation and wasn't caught until a real Android device. Sensor calibration should have had a unit test or manual check before validation.

### Patterns Established

- **Type-contract plan first**: always do a dedicated types + server handler plan before any UI work in a phase
- **CSS `.visible` class pattern** for overlay fade: prefer to existing `{#if}` blocks to allow exit animations
- **`initialSyncDone` guard** in `$effect` to prevent false-positive overlays on late-join STATE_SYNC
- **`$derived.by()`** for complex Svelte 5 derived state (screen routing); `$derived` for simple expressions
- **`no process.exit()`** in server error handlers when in-memory state must survive errors

### Key Lessons

1. **Delete features that don't work on real hardware** — the sensor minigame had a normalization bug that would have ruined the event. Cutting it was the right call; trivia + memory are enough.
2. **Spawn the verifier after every phase** — Phase 6 skipped it. The work was done but the audit chain has a hole. The habit should be: execute → verify → done.
3. **Checkbox hygiene matters** — three requirement checkboxes arrived at archive unchecked despite being done. Either close them in the plan SUMMARY commit or run a requirements sync at phase transition.
4. **Real-device testing is mandatory before ship** — local Chrome is not a phone. iOS/Android quirks (DeviceMotion permission gate, back button behavior, heartbeat drops) only surface on hardware.

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: ~12–15 across 7 phases
- Notable: type-contract plans were fastest (5–10 min each); UI plans with Svelte 5 runes were slowest (15–82 min, avg ~20 min)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.1 (complete) | 7 | 27 | First project — established all patterns from scratch |

### Top Lessons (First Milestone)

1. Type-contract plans first pay dividends for every subsequent UI plan in the phase
2. Real-device testing is non-negotiable for mobile web — local dev hides platform quirks
3. Spawn the verifier after every phase, not just when the checklist prompts you
