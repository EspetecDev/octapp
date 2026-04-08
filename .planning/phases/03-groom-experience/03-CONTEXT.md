# Phase 3: Groom Experience - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the groom's complete in-game experience: playing through all three minigame types (trivia, sensor, memory), completing scavenger hunt steps, and unlocking rewards — the full arc of a single chapter. After this phase, the groom can progress through every chapter the admin has configured, with each chapter following the arc: minigame → scavenger clue → reward reveal. No group economy (power-ups/sabotages) yet — that is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Groom Page Architecture
- **D-01:** Single-page conditional rendering — `src/routes/groom/+page.svelte` reads `$gameState` and derives which screen to show. No sub-routes. Screens: Waiting (lobby), Minigame, Scavenger, Reward. No back-button navigation risk on mobile.
- **D-02:** Screen selection logic:
  - `phase === "lobby"` → Waiting screen
  - `activeChapterIndex != null` + `!chapter.minigameDone` → Minigame screen
  - `activeChapterIndex != null` + `chapter.minigameDone` + `!chapter.scavengerDone` → Scavenger screen
  - `activeChapterIndex != null` + `chapter.minigameDone` + `chapter.scavengerDone` → Reward screen
- **D-03:** Chapter progress tracked via two new boolean fields on the `Chapter` type: `minigameDone` and `scavengerDone`. Server is the source of truth — progress survives reconnects and is visible to admin/group.
- **D-04:** After reward reveal, groom stays on the reward screen until the admin unlocks the next chapter (which triggers the recap card and advances `activeChapterIndex`).

### New WebSocket Messages (Client → Server)
- **D-05:** `MINIGAME_COMPLETE` — sent by groom's client when a minigame resolves. Payload: `{ type: "MINIGAME_COMPLETE", result: "win" | "loss" }`. Server flips `chapter.minigameDone = true`, updates score (+50 win / -20 loss), broadcasts `STATE_SYNC`.
- **D-06:** `SCAVENGER_DONE` — sent by groom tapping "I found it!" (primary path) OR admin from their dashboard (fallback). No payload beyond type. Server flips `chapter.scavengerDone = true`, broadcasts `STATE_SYNC`.
- **D-07:** `HINT_REQUEST` — sent by groom tapping "Request Hint". Server deducts 10 points from groom's score, broadcasts `STATE_SYNC`. The hint text is already in `chapter.scavengerHint` — client shows it after this message is acknowledged via state broadcast.

### Sensor Challenge (MINI-02, MINI-07)
- **D-08:** Tilt meter mechanic — groom tilts their phone right (positive `x` from `normalizeSensorData()` in `src/lib/sensors.ts`) to fill a vertical progress bar. Tilt left to let it fall. Goal: fill to 80% or more within the countdown.
- **D-09:** Win condition: meter reaches ≥80% at any point during the countdown (win immediately) or timer expires (if below 80% → loss).
- **D-10:** Uses `normalizeSensorData()` from `src/lib/sensors.ts` (already scaffolded). Platform detection via `detectPlatform()` in same file.
- **D-11:** iOS permission gate (MINI-07): tap-to-enable button before DeviceMotion is requested. Gate must appear before any sensor access — iOS 13+ requires a user gesture.

### Trivia Minigame (MINI-01, MINI-04)
- **D-12:** Question drawn from `chapter.triviaPool[chapter.servedQuestionIndex]` — index already set by the server on `UNLOCK_CHAPTER` (Phase 2 decision). Client reads from state.
- **D-13:** Radial countdown — SVG circle using `stroke-dashoffset` animation. Color shifts green → yellow → red as time runs out. Number in center shows remaining seconds. Timer duration: 15 seconds.
- **D-14:** Answer selection: groom taps one of 4 options. Correct/incorrect determined client-side (compare to `correctAnswer` in type) — no server round-trip needed for result.

### Memory Matching Minigame (MINI-03, MINI-04)
- **D-15:** 4×3 grid, 6 emoji pairs (12 cards total). Fixed emoji set — not admin-configurable (that is v2).
- **D-16:** Timer: 30 seconds (REQUIREMENTS.md specifies 30–45s). Uses same radial countdown component as trivia.
- **D-17:** Win: all pairs matched within time. Loss: timer expires with unmatched pairs remaining.

### Minigame Win/Loss Presentation (MINI-05, MINI-06)
- **D-18:** Full theatrical result screens — full-screen overlays, auto-advance after 2 seconds.
  - Win: accent color flash (groom gold `#f59e0b`), large "CORRECT!" / "NAILED IT!" text, "+50 pts" below, haptic buzz (Vibration API if available)
  - Loss: red tint (`#ef4444`), "WRONG!" / "TIME'S UP!" text, "-20 pts" below, double haptic buzz
- **D-19:** Scoring: +50 points for win, -20 points for loss. Fixed values for all minigame types.
- **D-20:** After result auto-dismiss (2s), client sends `MINIGAME_COMPLETE` with the result. Server updates state and advances to scavenger screen.

### Scavenger Hunt (HUNT-01, HUNT-02, HUNT-03, HUNT-04)
- **D-21:** Groom self-reports completion by tapping "I found it!" → sends `SCAVENGER_DONE`. Admin can also tap "Confirm found" on their dashboard as a fallback (both trigger the same server handler).
- **D-22:** Hint costs -10 points. Groom taps "Request Hint" → sends `HINT_REQUEST`. Server deducts points and broadcasts. Client shows `chapter.scavengerHint` text after next STATE_SYNC.
- **D-23:** Hint button shows only if `chapter.scavengerHint` is non-empty (admin may not have configured one).

### Reward Reveal (RWRD-01, RWRD-02, RWRD-03)
- **D-24:** Reward reveal is full-screen on both the groom page and the party page (RWRD-01 requires all players). When `chapter.scavengerDone` flips true, both pages show the reward text.
- **D-25:** Past rewards history: accordion/collapsible section below the current reward on the groom's reward screen. Lists all previously completed chapter rewards. No separate `/groom/history` route (RWRD-03).

### Claude's Discretion
- Exact confetti/particle implementation for the win celebration (CSS animation vs. canvas)
- Card flip animation style for memory matching (CSS 3D transform)
- Emoji set selection for memory cards (suggested: 🍻 👑 💀 🥳 💍 🎶)
- How to handle the edge case where `scavengerHint` is absent (hide button entirely vs. show disabled)
- Exact easing curves for meter fill animation on sensor challenge
- Whether to show a small score +/- indicator on the waiting screen after a chapter completes (nice-to-have)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Minigames — Groom (MINI-01–07) — trivia mechanic, sensor DeviceMotion, memory matching, countdown timer, scoring, win/loss feedback, iOS permission gate
- `.planning/REQUIREMENTS.md` §Scavenger Hunt (HUNT-01–04) — clue display, hint cost, completion marking, reward unlock
- `.planning/REQUIREMENTS.md` §Rewards (RWRD-01–03) — full-screen reveal to all players, reward text, groom history
- `.planning/REQUIREMENTS.md` §Mobile UX (MOBX-01–05) — 100dvh, touch targets, Wake Lock, SSR disabled

### Project
- `.planning/PROJECT.md` — Constraints: mobile web only, ≤10 players, one-time event, no persistence beyond server memory

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-09/D-10 (dark/nightlife theme, Tailwind CSS), D-03 (custom WS wrapper), overlay pattern (CSS .visible class toggle)
- `.planning/phases/02-admin-game-structure/02-CONTEXT.md` — D-04 (Chapter type with servedQuestionIndex, minigameType), D-07 (scores Record<string,number>), D-10/D-11 (recap card pattern)

### Existing Code (agents must read)
- `src/lib/types.ts` — Current GameState, Chapter, TriviaQuestion types; agents extend Chapter with `minigameDone` and `scavengerDone`; add new ClientMessage variants
- `src/lib/sensors.ts` — `normalizeSensorData()` and `detectPlatform()` — Phase 3 implements sensor challenge using these
- `src/routes/groom/+page.svelte` — Current groom waiting screen; Phase 3 expands this file with all minigame/scavenger/reward screens
- `server/handlers.ts` — Existing message handlers; Phase 3 adds MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST
- `server/state.ts` — GameState definition; Phase 3 extends Chapter type and adds handler logic

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/sensors.ts` — `normalizeSensorData(event, platform)` and `detectPlatform()` already scaffolded with correct iOS/Android polarity handling. Phase 3 adds the event listener and tilt meter UI on top.
- `src/lib/socket.ts` — `gameState` writable store, `sendMessage()` — all groom screens read from `$gameState` and send messages via `sendMessage()`
- `src/lib/wakeLock.ts` — Wake Lock utilities for keeping screen on during active minigames (MOBX-03)
- Overlay pattern from groom/+page.svelte — `.recap-overlay` + `.visible` CSS class toggle with `transition: opacity 200ms` — reuse for result screens, reward reveal

### Established Patterns
- `$derived` from `$gameState` for computed values — all screen selection logic follows this
- Full state broadcast on every mutation (`broadcastState(server)`) — MINIGAME_COMPLETE, SCAVENGER_DONE, HINT_REQUEST all follow this
- `setState(updater)` functional update in `server/state.ts` — all new server mutations use this
- 100dvh viewports, dark bg (`#0d0d0d`), groom accent `#f59e0b`, Tailwind utilities — all groom screens inherit

### Integration Points
- `Chapter` type in `src/lib/types.ts` AND `server/state.ts` must be extended in sync — add `minigameDone: boolean` and `scavengerDone: boolean` to both
- `ClientMessage` union in `src/lib/types.ts` gains: `MINIGAME_COMPLETE`, `SCAVENGER_DONE`, `HINT_REQUEST`
- `server/handlers.ts` switch gains three new cases for the above messages
- `src/routes/party/+page.svelte` needs reward reveal overlay (when `chapter.scavengerDone` flips true) — same overlay pattern as recap card
- Admin dashboard (`src/routes/admin/+page.svelte`) Zone 3 needs a "Confirm found" button that sends `SCAVENGER_DONE`
- `initState()` in `server/state.ts` must default new Chapter fields: `minigameDone: false`, `scavengerDone: false`

</code_context>

<specifics>
## Specific Ideas

- Sensor meter direction: tilt RIGHT fills the bar (positive x from normalizeSensorData). Keep it simple and consistent.
- Emoji set for memory cards: 🍻 👑 💀 🥳 💍 🎶 (bachelor party themed)
- Win text options: "CORRECT!", "NAILED IT!", "YES!" — use "CORRECT!" for trivia, "NAILED IT!" for sensor/memory
- The reward reveal should feel like a "drop the mic" moment — large text, groom accent color, maybe a subtle glow effect
- Scavenger clue screen should show the clue prominently (large readable text), with hint and "I found it!" well separated so they're not accidentally tapped

</specifics>

<deferred>
## Deferred Ideas

- Admin-configurable emoji sets for memory cards — belongs in v2 (ADMN-V2 scope)
- Configurable scoring values per chapter — belongs in v2 (ADMN-V2 scope)
- Past rewards accessible via dedicated `/groom/history` route — user chose accordion on reward screen; separate route is deferred

</deferred>

---

*Phase: 03-groom-experience*
*Context gathered: 2026-04-08*
