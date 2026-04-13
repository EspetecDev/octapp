# Roadmap: Bachelor Party Game

## Overview

Four phases take the project from bare infrastructure to a fully playable group experience. Phase 1 lays the real-time foundation that everything else runs on. Phase 2 gives the admin the tools to configure and drive the night. Phase 3 puts the complete groom experience in place — every minigame, the scavenger flow, and reward reveals. Phase 4 activates the group economy that turns spectators into participants with real power over the groom's fate.

## Milestone 1: Bachelor Party Game v1

## Phases

- [x] **Phase 1: Foundation** - SvelteKit + Bun WebSocket server, session join-by-code, real-time sync, mobile UX base (completed 2026-04-08)
- [ ] **Phase 2: Admin & Game Structure** - In-app content setup, phase state machine, lobby flow, admin dashboard
- [ ] **Phase 3: Groom Experience** - All 3 minigames, scavenger hunt flow, reward reveals
- [x] **Phase 4: Group Economy & Multiplayer** - Token economy, power-up/sabotage catalog, real-time group interactions (completed 2026-04-09)

## Phase Details

### Phase 1: Foundation
**Goal**: Any player can join a live game session on their phone and maintain a reliable real-time connection throughout the night.
**Depends on**: Nothing (first phase)
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-04, TECH-05, SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SYNC-01, SYNC-02, SYNC-03, SYNC-04, MOBX-01, MOBX-02, MOBX-03, MOBX-04, MOBX-05
**Success Criteria** (what must be TRUE):
  1. Admin visits `/admin` with the secret token and receives a 6-character join code
  2. A player navigates to the app URL, enters the code, picks a name and role (groom or group), and lands on a waiting screen
  3. Only one player can claim the groom role; a second attempt is rejected with a clear message
  4. When a player locks their phone and unlocks it, the connection restores automatically and the "Reconnecting..." overlay appears then dismisses without a hard reload
  5. All views fill the full viewport on iOS Safari without layout breakage, and a landscape-detection overlay appears if the phone is rotated
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 01-01-PLAN.md — SvelteKit scaffold, Tailwind v4 design tokens, route skeletons, Dockerfile
- [x] 01-02-PLAN.md — Bun WebSocket server, session management, state broadcast, admin token gate
- [x] 01-03-PLAN.md — Client WebSocket reconnect wrapper, Svelte stores, overlays, Wake Lock + sensor scaffolds
- [x] 01-04-PLAN.md — Join page, admin dashboard, groom and group waiting screens (full UI)

### Phase 2: Admin & Game Structure
**Goal**: The admin can configure all game content before the event and control the pace of the night by unlocking phases from a live dashboard.
**Depends on**: Phase 1
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06
**Success Criteria** (what must be TRUE):
  1. Admin can fill out an in-app setup form with trivia questions, scavenger clues, rewards, and the power-up/sabotage catalog before the event starts
  2. Configured content survives an admin browser refresh within the same session (server memory persists it)
  3. The game starts in a lobby state; no challenge content is visible to players until the admin explicitly unlocks Phase 1
  4. Unlocking a phase triggers a "new chapter" recap card visible to all connected players before challenges appear
  5. Admin dashboard shows who is currently connected, the active phase, and current scores at all times
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — Extend GameState type contracts (Chapter, TriviaQuestion, PowerUp, new message unions) in both src/lib/types.ts and server/state.ts
- [x] 02-02-PLAN.md — Server handlers: SAVE_SETUP and UNLOCK_CHAPTER with validation, score initialization, servedQuestionIndex
- [x] 02-03-PLAN.md — /admin/setup pre-event setup form (chapters, trivia pool, scavenger, rewards, power-up catalog)
- [x] 02-04-PLAN.md — Admin dashboard Zone 3+4 (chapter control, scores) and recap card overlay on groom/party pages

### Phase 3: Groom Experience
**Goal**: The groom can play through all three minigame types, complete scavenger steps, and unlock rewards — the full arc of a single game night.
**Depends on**: Phase 2
**Requirements**: MINI-01, MINI-02, MINI-03, MINI-04, MINI-05, MINI-06, MINI-07, HUNT-01, HUNT-02, HUNT-03, HUNT-04, RWRD-01, RWRD-02, RWRD-03
**Success Criteria** (what must be TRUE):
  1. Trivia minigame presents a question with 4 options and a radial countdown; correct/incorrect result triggers full-screen celebration or brief dismissal with haptic feedback
  2. Sensor minigame shows a tap-to-enable permission gate before accessing DeviceMotion, then runs the tilt/balance challenge using normalized sensor data on both iOS and Android
  3. Memory/matching minigame presents a card grid with a countdown timer; pairs animate on match and the game resolves within the time window
  4. After completing a minigame, the groom sees a scavenger clue and can optionally request a hint; marking it found (or admin confirming) unlocks the phase reward
  5. Reward reveal plays as a full-screen unlock moment visible to all players, and past rewards are accessible in a groom-only history screen
**Plans**: 7 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Type contracts + server handlers (Chapter fields, 3 new ClientMessages, MINIGAME_COMPLETE/SCAVENGER_DONE/HINT_REQUEST)
- [x] 03-02-PLAN.md — RadialCountdown shared component + groom page screen router skeleton + stub components
- [x] 03-03-PLAN.md — TriviaMinigame component (question + 4 options + 15s countdown + win/loss overlay)
- [x] 03-04-PLAN.md — SensorMinigame component (iOS permission gate + tilt meter + 30s countdown + win/loss overlay)
- [x] 03-05-PLAN.md — MemoryMinigame component (4×3 card grid + CSS flip + pair matching + 30s countdown)
- [x] 03-06-PLAN.md — ScavengerScreen + RewardScreen components + admin Confirm Found button
- [x] 03-07-PLAN.md — Party page reward reveal overlay (full-screen, persists until chapter advances)

### Phase 4: Group Economy & Multiplayer
**Goal**: Group members have a live token economy that lets them actively help or sabotage the groom during his challenges, with all actions announced to every player.
**Depends on**: Phase 3
**Requirements**: GRPX-01, GRPX-02, GRPX-03, GRPX-04, GRPX-05, GRPX-06, GRPX-07
**Success Criteria** (what must be TRUE):
  1. Each group member starts every phase with a token balance and can earn more by completing parallel group-side activities during the groom's challenge
  2. During an active minigame, the group shop shows only context-appropriate power-ups and sabotages; spending tokens deducts the balance immediately
  3. A deployed sabotage (e.g., timer reduction, scrambled options, distraction overlay) takes effect on the groom's screen within 500ms and is announced to all players with a visible notification — never silent
  4. A deployed power-up (e.g., timer extension) is visible to the groom and all group members simultaneously
  5. Group members can see each other's current token balances and a feed of recent actions from the group view
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Extend type contracts (GameState + 3 new fields, SPEND_TOKEN, EFFECT_ACTIVATED, updated SAVE_SETUP) in types.ts and server/state.ts
- [x] 04-02-PLAN.md — Server SPEND_TOKEN handler + UNLOCK_CHAPTER token init + admin setup startingTokens field
- [x] 04-03-PLAN.md — Client effects: lastEffect store, RadialCountdown $bindable, minigame distraction overlays, groom page announcement overlay
- [x] 04-04-PLAN.md — Party page group economy UI (earn button, shop, social waiting screen, announcement overlay)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-04-08 |
| 2. Admin & Game Structure | 3/4 | In Progress|  |
| 3. Groom Experience | 3/7 | In Progress|  |
| 4. Group Economy & Multiplayer | 4/4 | Complete   | 2026-04-09 |

---

## Milestone 2: Bachelor Party Game v1.1 — Deployment & Testing

## Phases

- [ ] **Phase 5: Railway Deploy & Smoke Test** - Deploy to Railway, configure ADMIN_TOKEN, confirm HTTPS and WebSocket 101 upgrade via DevTools
- [ ] **Phase 6: Three-Device Validation** - Admin + Groom + Party join simultaneously; chapter unlock, sensor minigame, real-time sync all pass on real hardware
- [ ] **Phase 7: Mobile Bug Fixes** - Android back button safety, server crash protection

## Phase Details

### Phase 5: Railway Deploy & Smoke Test
**Goal**: The app is live on a public Railway URL with ADMIN_TOKEN secured, and a single user can verify the WebSocket connection is healthy before any real-device testing begins.
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. Navigating to the Railway public URL in a browser loads the join page with no console errors
  2. `GET /health` returns HTTP 200; the Network tab shows a 101 Switching Protocols response for the WebSocket connection (not just 200 from the health check)
  3. Admin can reach `/admin` with the correct ADMIN_TOKEN and is rejected with 401 when the token is wrong or missing — confirmed in Railway production (not just local)
  4. Railway logs show `Admin token: ***` (masked, not `(not set)`) immediately after first deploy — confirming the env var was set without trailing whitespace
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Server hardening (uncaughtException handler, railway.toml healthcheckTimeout + drainingSeconds) + git push to main
- [ ] 05-02-PLAN.md — Railway project setup: GitHub connect, ADMIN_TOKEN via Raw Editor, domain generation
- [ ] 05-03-PLAN.md — Smoke test: health check, WebSocket 101 in DevTools, admin gate verified in production

### Phase 6: Three-Device Validation
**Goal**: All three party roles (admin, groom, party member) connect simultaneously from real devices and the full game flow — chapter unlock, minigames, sensor permission — works end-to-end.
**Depends on**: Phase 5
**Requirements**: VALID-01, VALID-02, VALID-03
**Success Criteria** (what must be TRUE):
  1. Admin on PC, groom on Android phone, and a party member on a second device all join the same session simultaneously; each sees the correct role view with no console errors
  2. Admin unlocks a chapter and all three devices display the chapter transition card within 2 seconds — verified by watching screens side by side
  3. Groom taps the sensor minigame "Enable Sensor" button on real Android; tilt meter responds to physical movement (iOS permission dialog deferred to Phase 7)
  4. Groom locks Android phone for 15 seconds mid-challenge, unlocks it, and the game view restores automatically without a manual page reload
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 06-01-PLAN.md — Admin session setup: configure 1 sensor chapter, confirm dashboard shows session code and Unlock Chapter is enabled
- [ ] 06-02-PLAN.md — VALID-01 (all 3 devices join) + VALID-02 (chapter unlock recap card on all screens within 2s)
- [ ] 06-03-PLAN.md — Android sensor tilt test (non-blocking) + lock-screen reconnect test (non-blocking); failures logged to Phase 7

### Phase 7: Mobile Bug Fixes
**Goal**: The two known mobile bugs that can break or corrupt a live session are fixed and verified on real hardware.
**Depends on**: Phase 6
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Pressing the Android hardware back button during an active session does not navigate away from the game — the session stays on screen
  2. A server-side unhandled error (simulated in testing) is logged to Railway logs and the server process keeps running — existing sessions are not wiped
  3. After the fix, a fresh three-device join confirms no regressions from either change
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — FIX-01: back button guard on groom & party pages (beforeNavigate + history.pushState)
- [ ] 07-02-PLAN.md — FIX-02: unhandledRejection server handler + /test-crash verification route

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Railway Deploy & Smoke Test | 1/3 | In Progress|  |
| 6. Three-Device Validation | 0/3 | Not started | - |
| 7. Mobile Bug Fixes | 1/2 | In Progress|  |
