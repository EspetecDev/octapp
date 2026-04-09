# Requirements: Bachelor Party Game

**Defined:** 2026-04-07
**Core Value:** The groom has a memorable, personalized gauntlet to run through his own bachelor party — driven by his friends, full of surprises.

## v1 Requirements

### Session & Joining

- [x] **SESS-01**: Admin can create a new game session and receive a 6-character join code
- [x] **SESS-02**: Players join by navigating to the app URL and entering the join code
- [x] **SESS-03**: On joining, player selects their role (groom or group member) and enters a display name
- [x] **SESS-04**: Only one player can claim the groom role per session; others auto-join as group
- [x] **SESS-05**: Admin authenticates via a secret token (env var) — no account needed
- [x] **SESS-06**: Disconnected players automatically reconnect with exponential backoff and rejoin their session with full current state restored

### Game Structure & Phases

- [x] **GAME-01**: Admin can pre-configure phases before the event (each phase has a name, minigame set, scavenger step, and reward)
- [x] **GAME-02**: Game starts in a lobby state; no challenges until admin unlocks the first phase
- [x] **GAME-03**: Admin can unlock the next phase from the admin dashboard at any time
- [x] **GAME-04**: Each phase is a self-contained chapter: groom completes minigame(s) → scavenger clue → reward reveal
- [x] **GAME-05**: Phase transition shows a "new chapter" recap card to all players before the next phase begins
- [x] **GAME-06**: Admin can see current session state at all times (who's connected, current phase, scores)

### Admin Setup Flow

- [x] **ADMN-01**: Admin can configure trivia questions (question text + answer + wrong options) via in-app setup form before the event
- [x] **ADMN-02**: Admin can configure scavenger hunt steps (riddle/clue text + optional hint) per phase via setup form
- [x] **ADMN-03**: Admin can configure rewards per phase (text description of what is unlocked)
- [x] **ADMN-04**: Admin can define the power-up and sabotage catalog (name + description + token cost + effect type)
- [x] **ADMN-05**: Setup content is persisted in server memory and survives admin reconnects within the same session

### Minigames — Groom

- [ ] **MINI-01**: Trivia minigame — groom sees a question and 4 answer options, has 15–20 seconds to answer; questions drawn from admin-configured set
- [x] **MINI-02**: Phone sensor minigame — groom tilts/moves their phone to complete a challenge (e.g., keep a ball balanced, tilt to fill a meter); uses DeviceMotion/DeviceOrientation APIs with iOS permission gate
- [x] **MINI-03**: Memory/matching minigame — groom matches pairs of cards within a time limit (30–45 seconds)
- [x] **MINI-04**: Each minigame shows a radial countdown timer visible at a glance
- [x] **MINI-05**: Completing a minigame earns the groom points; failing costs points or triggers a penalty
- [x] **MINI-06**: Minigame result shows full-screen celebration (win) or brief dismissal (loss) with haptic feedback
- [x] **MINI-07**: Sensor minigame includes a tap-to-enable permission gate before DeviceMotion is accessed (iOS requirement)

### Scavenger Hunt

- [ ] **HUNT-01**: After completing the minigame, the groom receives a riddle/clue directing him to find something in the real world
- [ ] **HUNT-02**: Groom can request a hint (costs points or tokens) if stuck
- [ ] **HUNT-03**: Groom marks the scavenger step as complete once found; admin can also confirm it from the admin view
- [ ] **HUNT-04**: Completing the scavenger step unlocks the phase reward

### Rewards

- [x] **RWRD-01**: Completing a phase (minigame + scavenger) reveals the reward to all players with a full-screen unlock moment
- [ ] **RWRD-02**: Reward is the admin-configured text for that phase (e.g., dare, item location, embarrassing content description)
- [ ] **RWRD-03**: Past rewards are viewable in a groom-only history screen

### Group Participation & Economy

- [ ] **GRPX-01**: Group members each have their own token balance, starting at a configured amount at the beginning of each phase
- [ ] **GRPX-02**: Group members earn tokens by completing group-side activities (e.g., answering a parallel trivia question, tapping a reaction during the groom's challenge)
- [ ] **GRPX-03**: During a groom minigame, group members can spend tokens on power-ups or sabotages from a context-filtered list
- [ ] **GRPX-04**: Power-up example: add 5 seconds to the groom's timer
- [ ] **GRPX-05**: Sabotage example: reduce the groom's timer, scramble his answer options, or add a distraction overlay
- [ ] **GRPX-06**: Activated sabotages and power-ups are announced to all players with a visible notification (never silent)
- [ ] **GRPX-07**: Group members can see each other's token balances and recent actions

### Real-Time Sync

- [x] **SYNC-01**: All game state changes (phase unlock, minigame start/end, sabotage activation, score updates) broadcast to all connected clients within 500ms
- [x] **SYNC-02**: Server sends full state snapshot to any client that reconnects
- [x] **SYNC-03**: Server sends heartbeat ping every 30 seconds to prevent Railway idle timeout from dropping connections
- [x] **SYNC-04**: Clients display a "Reconnecting..." overlay when connection is lost; auto-dismiss when restored

### Mobile UX

- [x] **MOBX-01**: All views use `height: 100dvh` and are designed for portrait mobile (no fullscreen API dependency)
- [x] **MOBX-02**: All interactive elements are touch-friendly (min 44px tap targets)
- [x] **MOBX-03**: Wake Lock is acquired during active minigames and re-acquired on `visibilitychange`
- [x] **MOBX-04**: Screen shows a landscape-detection overlay prompting portrait orientation if rotated
- [x] **MOBX-05**: SvelteKit SSR is disabled on all game routes; no server-side rendering of browser-API-dependent code

### Tech Foundation

- [x] **TECH-01**: Frontend: SvelteKit 5 with file-based routes (`/`, `/admin`, `/groom`, `/party`)
- [x] **TECH-02**: Backend: Bun WebSocket server with in-memory game state (no database)
- [x] **TECH-03**: Deployed to Railway with HTTPS; a single URL is shareable
- [x] **TECH-04**: WebSocket client uses auto-reconnect wrapper (Socket.IO or custom with exponential backoff)
- [x] **TECH-05**: Sensor events normalized across iOS and Android before use in minigames

## v2 Requirements

### Enhanced Minigames

- **MINI-V2-01**: Speed-tap challenge — tap as many times as possible in 10 seconds
- **MINI-V2-02**: Voice/audio challenge — speak a phrase, typed transcription scored (uses Web Speech API)
- **MINI-V2-03**: Drawing challenge — draw something on a canvas, group votes on quality

### PWA & Notifications

- **PWA-01**: PWA manifest + service worker so players can add to home screen
- **PWA-02**: Push notification when admin unlocks a new phase (requires user opt-in)

### Content Management

- **ADMN-V2-01**: Save/load game configurations as presets for reuse
- **ADMN-V2-02**: Import trivia questions from a spreadsheet/CSV

### Analytics

- **ANLT-01**: Post-game summary screen showing highlight moments, top sabotages, groom score timeline

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Web browser is sufficient; no install friction is the goal |
| User accounts / profiles | One-time event; no persistent identity needed |
| Video recording/upload challenges | Adds storage/backend complexity for marginal party value |
| Large-scale multiplayer (20+ players) | Designed for 5-10; over-engineering real-time infra for this is waste |
| GPS/location-based scavenger hunt | Adds platform permission complexity; riddles + manual confirm is simpler and more social |
| Shared physical screen / TV mode | Phones-only confirmed; no shared display to design for |
| Persistent game history across sessions | One-time event; no need for cross-session data |
| Vercel / serverless deployment | Architecturally incompatible with persistent WebSocket game server |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TECH-01–05 | Phase 1 | Pending |
| SESS-01–06 | Phase 1 | Pending |
| SYNC-01–04 | Phase 1 | Pending |
| MOBX-01–05 | Phase 1 | Pending |
| ADMN-01–05 | Phase 2 | Pending |
| GAME-01–06 | Phase 2 | Pending |
| MINI-01–07 | Phase 3 | Pending |
| HUNT-01–04 | Phase 3 | Pending |
| RWRD-01–03 | Phase 3 | Pending |
| GRPX-01–07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after initial definition*
