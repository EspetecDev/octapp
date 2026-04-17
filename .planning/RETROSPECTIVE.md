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

## Milestone: v1.2 — Load Preconfigured Games

**Shipped:** 2026-04-17
**Phases:** 3 | **Plans:** 4 | **Timeline:** 4 days (2026-04-14 → 2026-04-17)

### What Was Built

- Pure `GameConfig` TypeScript module — serialization type, `serializeConfig()` stripping runtime fields, `validateConfig()` with field-specific error messages
- Export Config button on /admin/setup — desktop blob download + iOS Safari `window.open()` fallback for WebKit bug #216918
- Import Config flow — hidden file input, FileReader validation, confirm-mode sticky bar swap, form population with `$state.snapshot()` + `restoredFromState` guard
- E2E roundtrip verified manually — export → reload → import → save → confirm server state matches

### What Worked

- **Pure-module approach for GameConfig** was the right call: isolated from UI, easy to test, no runtime deps. The "build the contract first" pattern from v1.1 carried over cleanly.
- **Research phase for Phase 9** surfaced the iOS WebKit blob URL bug before implementation — prevented a silent failure in the shipped product.
- **E2E checkpoint as a formal plan (10-02)** caught a real bug (`structuredClone` on Svelte 5 reactive proxy) that code review alone would have missed.
- **3-phase decomposition** (serializer → export → import + E2E) was the right granularity — each phase had a clear, testable outcome.

### What Was Inefficient

- **`restoredFromState = true` guard** had to be added mid-Phase 10 after the bug surfaced during E2E. This pattern was known from research but wasn't fully wired in the initial plan — should have been a first-class requirement in IMP-04.
- **`$state.snapshot()` vs `structuredClone`** was caught at E2E time, not at plan time. The research notes mentioned `structuredClone` as the existing pattern but didn't flag the reactive proxy caveat. A note in the plan would have prevented the mid-checkpoint fix.
- **REQUIREMENTS.md traceability table** still had "TBD" in the Plan column at archive time — the table was seeded correctly but never updated as plans completed.

### Patterns Established

- **`$state.snapshot()`** when reading from Svelte 5 `$state` runes into non-reactive contexts (import, serialization) — `structuredClone` throws on reactive proxies
- **`restoredFromState = true`** as an idempotency guard: always set it before the next `STATE_SYNC` can arrive after any programmatic form mutation
- **iOS Safari download detection**: `/iP(hone|ad|od)/i` + `window.open('_blank')` for blob downloads; `URL.revokeObjectURL` on desktop path only

### Key Lessons

1. **Platform quirks from research → plan checklist** — the iOS blob bug was researched but the `restoredFromState` guard wasn't explicitly planned. If research surfaces a "must do X", it should appear as a named task in the plan, not just a research note.
2. **E2E checkpoints find what unit tests can't** — the reactive proxy bug was invisible until real browser interaction. Manual E2E checkpoints are worth keeping even for "simple" features.
3. **Svelte 5 rune mutation requires `$state.snapshot()`** — when writing tests or doing any non-reactive read from rune state, always snapshot first. This will recur in future phases.

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: ~4 across 3 phases
- Notable: Phase 10 took two sessions due to the E2E checkpoint requiring real-browser verification; overall the milestone was lean and fast

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.1 (complete) | 7 | 27 | First project — established all patterns from scratch |
| v1.2 (complete) | 3 | 4 | Lean feature milestone — pure module + browser file I/O + E2E verification |

### Top Lessons

1. **Type/contract plan first** pays dividends for every subsequent UI plan in the phase
2. **Real-device testing is non-negotiable** for mobile web — local dev hides platform quirks
3. **Spawn the verifier after every phase** — don't let evidence live only in SUMMARY files
4. **Research surfacing a "must do X" → plan task**, not just a note — otherwise it slips to E2E
5. **`$state.snapshot()`** when reading Svelte 5 rune state outside reactive context — will recur
