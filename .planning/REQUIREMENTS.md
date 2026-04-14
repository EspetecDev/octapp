# Requirements: v1.2 — Load Preconfigured Games

**Milestone goal:** Let admins export and import full game configs as JSON files so a setup can be saved, shared, and reused across events.

**Scope:** Admin-only feature on /admin/setup. No server changes. No new WebSocket message types.

---

## Milestone Requirements

### Config Serializer

- [ ] **SER-01**: System defines a `GameConfig` TypeScript type representing the exportable subset of game setup (chapters with trivia, scavenger clues, rewards; power-up catalog; starting tokens) — excluding runtime-only Chapter fields (`servedQuestionIndex`, `minigameDone`, `scavengerDone`)
- [ ] **SER-02**: System provides a `serializeConfig(chapters, powerUpCatalog, startingTokens)` function that strips runtime fields and returns a `GameConfig` object
- [ ] **SER-03**: System provides a `validateConfig(data: unknown)` function that checks the parsed JSON conforms to the `GameConfig` shape and returns a typed result or a descriptive error

### Export

- [ ] **EXP-01**: Admin can download the current game setup as a JSON file from the /admin/setup page
- [ ] **EXP-02**: The exported JSON file contains chapters (with trivia questions, scavenger clues, rewards), the power-up catalog, and starting tokens — with all runtime-only Chapter fields stripped
- [ ] **EXP-03**: Export works on iOS Safari (uses `window.open()` fallback when `<a download>` is unsupported)

### Import

- [ ] **IMP-01**: Admin can select a local JSON file from the /admin/setup page to load a previously exported config
- [ ] **IMP-02**: System validates the selected file's structure before applying it — invalid files show an inline error message without modifying the current setup
- [ ] **IMP-03**: Admin is prompted to confirm before the current setup is replaced by the imported config
- [ ] **IMP-04**: A successfully imported config populates the setup form and requires the admin to review and save before the server state is updated

---

## Future Requirements

- Filename with timestamp on export (e.g. `octapp-config-2026-04-14.json`) — deferred, not selected for this milestone
- Block import button during active game — deferred, not selected for this milestone
- Export sourced from server state (rather than form state) — not needed; form state is the correct source

---

## Out of Scope

- Server-side import endpoint — browser-only; SAVE_SETUP WebSocket message already handles this
- New WebSocket message type (LOAD_CONFIG) — SAVE_SETUP already does what's needed
- Merge import (add to existing setup) — replace-entirely is simpler and safer
- Cloud save / hosted config sharing — one-time event app; local file is sufficient

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| SER-01 | Phase 8 | TBD |
| SER-02 | Phase 8 | TBD |
| SER-03 | Phase 8 | TBD |
| EXP-01 | Phase 9 | TBD |
| EXP-02 | Phase 9 | TBD |
| EXP-03 | Phase 9 | TBD |
| IMP-01 | Phase 10 | TBD |
| IMP-02 | Phase 10 | TBD |
| IMP-03 | Phase 10 | TBD |
| IMP-04 | Phase 10 | TBD |
