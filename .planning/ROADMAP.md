# Roadmap: Bachelor Party Game

## Milestones

- ✅ **v1.1 Deployment & Testing** — Phases 1–7 (shipped 2026-04-13) — [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Load Preconfigured Games** — Phases 8–10 (in progress)

## Phases

<details>
<summary>✅ v1.1 Deployment & Testing (Phases 1–7) — SHIPPED 2026-04-13</summary>

All 7 phases complete. Full phase details, plans, and requirements in the milestone archive:
[milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.2 Load Preconfigured Games (In Progress)

**Milestone Goal:** Let admins export and import full game configs as JSON files so a setup can be saved, shared, and reused across events. Zero new server changes, zero new WebSocket message types.

- [x] **Phase 8: Config Serializer** - Pure TypeScript module establishing the GameConfig type and serialization/validation contract (completed 2026-04-14)
- [x] **Phase 9: Export** - Admin can download current game setup as a JSON file, including iOS Safari fallback (completed 2026-04-16)
- [ ] **Phase 10: Import + E2E Verification** - Admin can load a config file into the setup form, with validation, confirmation, and end-to-end verification

## Phase Details

### Phase 8: Config Serializer
**Goal**: The GameConfig data contract and its serialization/validation logic exist as a tested, isolated module that all other v1.2 phases can depend on
**Depends on**: Phase 7
**Requirements**: SER-01, SER-02, SER-03
**Success Criteria** (what must be TRUE):
  1. A `GameConfig` TypeScript type exists that covers chapters (trivia, scavenger clues, rewards), power-up catalog, and starting tokens — with no runtime-only Chapter fields (`servedQuestionIndex`, `minigameDone`, `scavengerDone`)
  2. `serializeConfig(chapters, powerUpCatalog, startingTokens)` returns a `GameConfig` object with runtime fields stripped
  3. `validateConfig(data: unknown)` returns a typed result for valid input and a descriptive error string for invalid input (missing required fields, wrong types)
  4. `GameConfig` is re-exported from `src/lib/types.ts` so downstream code imports from one place
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — GameConfig type + serializeConfig + validateConfig + types.ts re-export

### Phase 9: Export
**Goal**: Admin can download the current game setup as a JSON file from /admin/setup, and the download works on both desktop and iOS Safari
**Depends on**: Phase 8
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Export Config" on /admin/setup triggers a file download named `octapp-setup.json`
  2. The downloaded JSON contains chapters, power-up catalog, and starting tokens — with no runtime-only fields present
  3. On iOS Safari, tapping "Export Config" opens a new tab with the JSON (share sheet save flow) rather than silently failing
  4. `URL.revokeObjectURL` is called after every export to prevent memory leaks
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md — exportSetup function + iOS Safari fallback + two-button sticky bar
**UI hint**: yes

### Phase 10: Import + E2E Verification
**Goal**: Admin can load a previously exported config file into the setup form, review it, and save it — with full validation, confirmation prompt, and end-to-end verification that export → import → save produces correct server state
**Depends on**: Phase 9
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Import Config" on /admin/setup opens a file picker filtered to `.json` files
  2. Selecting a structurally invalid file shows an inline error message and leaves the current setup unchanged
  3. Selecting a valid file shows a confirmation prompt before replacing the current setup
  4. After confirming, the setup form is populated with imported values and `restoredFromState` is set so the next `STATE_SYNC` does not overwrite the imported data
  5. End-to-end test passes: export a live config, reload the page, import the file, verify form values match, click Save, verify server state matches in a second browser tab
**Plans**: 1 plan

Plans:
- [ ] 09-01-PLAN.md — exportSetup function + iOS Safari fallback + two-button sticky bar

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
| 8. Config Serializer | v1.2 | 1/1 | Complete   | 2026-04-14 |
| 9. Export | v1.2 | 1/1 | Complete   | 2026-04-16 |
| 10. Import + E2E Verification | v1.2 | 0/? | Not started | - |
