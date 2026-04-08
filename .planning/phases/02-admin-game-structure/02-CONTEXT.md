# Phase 2: Admin & Game Structure - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers two things: (1) an in-app pre-event setup flow where the admin configures all game content (chapters, trivia questions, scavenger clues, rewards, power-up catalog), and (2) a live-night admin dashboard with chapter unlock control, connected player list, and score overview. After this phase, the admin can configure a full game night before the event and drive the pace by unlocking chapters from their phone. Players see a "new chapter" recap card when each chapter opens. No challenge content is visible until the admin unlocks it.

</domain>

<decisions>
## Implementation Decisions

### Content Setup Flow
- **D-01:** Pre-event setup lives at `/admin/setup` — a separate route from `/admin`. The admin dashboard (`/admin`) is for live-night control; setup is a different job done before the event.
- **D-02:** Setup form is one scrollable page with all chapters stacked as accordion/sections. Admin sees everything at once. Works well for 1–5 chapters.
- **D-03:** Entry to setup: a "Configure Game" button appears on `/admin` during lobby state and links to `/admin/setup`. The button disappears (or disables) once the first chapter is unlocked — setup is pre-event only.

### Phase Data Model
- **D-04:** Admin configures 1–5 chapters at setup time. Chapter count is variable — stored as an ordered array in game state. Each chapter has: `name` (string), `minigameType` ("trivia"|"sensor"|"memory"), `triviaPool` (array of question objects), `scavengerClue` (text + optional hint), `reward` (text description).
- **D-05:** Trivia is a pool per chapter — admin enters multiple questions (e.g., 3), server picks one at random when the chapter activates. Server must track which question was served to avoid re-drawing.
- **D-06:** Admin picks the minigame type per chapter at setup time (trivia, sensor challenge, or memory match). No auto-cycling — admin controls variety.
- **D-07:** Scores scaffolded in `GameState` now as `scores: Record<playerId, number>`, initialized to 0 for all players. Display zeros on the dashboard. Phase 3 populates actual values via minigame completion.

### Admin Live Dashboard Layout
- **D-08:** Vertical zone layout on `/admin` during the event:
  1. Session code (top, existing)
  2. "Configure Game" button → `/admin/setup` (lobby only)
  3. Chapter control: "Chapter X of N — active" + "Unlock Chapter N+1" button
  4. Players: connected player list with roles
  5. Scores: player name → current score
- **D-09:** Unlock is instant, one tap, no confirmation dialog. The button only appears after the previous chapter is complete (or during lobby for Chapter 1), so accidental taps are already guarded by context.

### "New Chapter" Recap Card
- **D-10:** Recap card content: chapter name + number only (e.g., "Chapter 2: The Bar"). No spoilers about the minigame type — builds anticipation.
- **D-11:** Auto-dismiss after 3 seconds. Everyone advances together automatically — no individual dismissal needed.

### Claude's Discretion
- Exact accordion/expand behavior for the setup form (open all by default, or collapsed with expand-on-tap)
- Visual treatment of the recap card (full-screen overlay vs. card modal)
- Power-up catalog setup form layout (ADMN-04) — list of entries with name, description, token cost, effect type
- WebSocket message type names for new server events (e.g., `CHAPTER_UNLOCKED`, `SETUP_SAVED`)
- Exact error handling for setup form validation (required fields, min/max lengths)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Admin Setup Flow (ADMN-01–05) — trivia questions, scavenger clues, rewards, power-up catalog, server-memory persistence
- `.planning/REQUIREMENTS.md` §Game Structure & Phases (GAME-01–06) — phase state machine, lobby, unlock flow, chapter recap, admin dashboard
- `.planning/REQUIREMENTS.md` §Real-Time Sync (SYNC-01–04) — 500ms broadcast SLA, full state on reconnect (all new messages must follow this protocol)

### Project
- `.planning/PROJECT.md` — Constraints: mobile web only, Railway, ≤10 players, one-time event (no persistence beyond server memory)

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (monorepo structure), D-03 (custom WS wrapper), D-04 (full state broadcast), D-09/D-10 (Tailwind CSS, dark/nightlife theme)

No external specs or ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/socket.ts` — `gameState` writable store, `connectionStatus` store, `sendMessage()` — all Phase 2 components read from `gameState` and send via `sendMessage()`
- `src/lib/types.ts` — shared `GameState` and `Player` types; must be extended in Phase 2 to add chapters, scores, activeChapterIndex
- `src/routes/admin/+page.svelte` — existing Zone 1 (session code) + Zone 2 (player list) layout; Phase 2 adds Zone 3 (chapter control) and Zone 4 (scores) below
- `server/state.ts` — `GameState` definition, `getState()`, `setState()`, `broadcastState()` — Phase 2 extends the GameState type and follows the same mutation pattern
- `server/handlers.ts` — message handler switch; new admin messages (unlock chapter, save setup) follow the same pattern as JOIN/REJOIN

### Established Patterns
- Full state broadcast on every mutation (`broadcastState(server)`) — new admin actions follow this pattern
- `setState(updater)` functional update pattern in server/state.ts — all new mutations use this
- Admin auth via `?token=` query param + `/api/admin/session` endpoint — `/admin/setup` must use the same gate
- Svelte `$derived` for computed values from `$gameState` — new UI components follow this
- 100dvh viewports, dark bg (`#0d0d0d`), Tailwind CSS utilities — all new views inherit Phase 1 theme

### Integration Points
- `GameState` in `server/state.ts` and `src/lib/types.ts` must be extended in sync (both files)
- New WebSocket message types must be added to `ServerMessage` and `ClientMessage` unions in `src/lib/types.ts`
- `/admin/setup` needs the same token-auth pattern as `/admin` — share the `/api/admin/session` check
- All connected clients receive `STATE_SYNC` on any game state change — chapter unlock and setup save trigger this

</code_context>

<specifics>
## Specific Ideas

- Chapter name examples from the night arc: "Chapter 1: The Dinner", "Chapter 2: The Bar", "Chapter 3: The Club" — but admin names them freely
- Recap card should feel theatrical: full-screen dark background, large chapter number, chapter name in the accent color
- "Configure Game" button styling: use `accent-admin` color (established in Phase 1), prominent but not alarming
- The setup form should allow adding/removing trivia questions within a chapter pool (add more / remove individual questions)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-admin-game-structure*
*Context gathered: 2026-04-08*
