# Phase 4: Group Economy & Multiplayer - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the group's active participation layer: each group member has a token balance (admin-configured starting amount, earned via tap mechanic during challenges), can spend tokens on power-ups or sabotages from a context-filtered shop, and all activations are announced to every player with a full-screen overlay. Effects land on the groom's screen immediately (timer change, scrambled options, distraction emoji storm). Group members see each other's balances and a live feed of recent actions. No new minigame types — this phase adds the economy layer on top of what Phase 3 built.

</domain>

<decisions>
## Implementation Decisions

### Token Economy Model
- **D-01:** Starting balance is admin-configurable — admin sets a per-chapter starting token amount in the pre-event setup form (ADMN-04 adds this field to the power-up catalog section). All group members start each chapter at this value.
- **D-02:** Earning mechanic: tap-to-earn button. Each tap = 1 token. Cap: max 5 tokens earneable per group member per challenge (not per chapter total — resets each minigame). The cap and button state are tracked client-side; server validates spend attempts but doesn't track tap counts.
- **D-03:** Token balances stored as `tokenBalances: Record<playerId, number>` on `GameState` (parallel to existing `scores`). Server initializes all group members to the admin-configured starting value on `UNLOCK_CHAPTER`. Reinitialization happens on each new chapter unlock.
- **D-04:** Spending a token sends a new WS message `SPEND_TOKEN` with `{ type: "SPEND_TOKEN", powerUpIndex: number }`. Server validates: player has sufficient balance, chapter is active, powerUp at that index exists. Server deducts balance, records the action, and broadcasts `STATE_SYNC` + a new `EFFECT_ACTIVATED` message.

### Group View Layout
- **D-05:** Single-screen layout during an active challenge:
  - Top: small groom progress indicator (shows the countdown timer value synced from `gameState.chapters[activeChapterIndex]` — timer value must be tracked in `GameState`)
  - Middle: large tap-to-earn button ("TAP TO EARN" or similar), with earned-this-challenge counter (e.g., "3 / 5 earned")
  - Bottom: scrollable shop list — context-filtered power-ups/sabotages from `powerUpCatalog`, each showing name, description, token cost, and a "Spend" button (disabled if balance insufficient)
  - Token balance shown prominently (e.g., "💰 7 tokens") near the earn button
- **D-06:** Between challenges (lobby or scavenger/reward phase): social waiting screen showing:
  - Each group member's name + current token balance
  - Scrollable recent actions feed: "Alice used Timer Scramble" entries, newest first, last 10 actions
  - The recap card and reward overlays continue to appear on top of this screen (no change to existing overlay behavior)

### Announcement Overlay (GRPX-06)
- **D-07:** Full-screen overlay, same pattern as recap card (CSS `.visible` class toggle, `opacity: 0 → 1`, `transition: opacity 200ms`). Auto-dismisses after 2 seconds. Appears on ALL connected clients (groom, group, admin) simultaneously.
- **D-08:** Content: activating player's name (large) + power-up name (large). E.g., "ALICE" on one line, "TIMER SCRAMBLE" below. No flavor text.
- **D-09:** Visual distinction by effect type:
  - Sabotages (timer_reduce, scramble_options, distraction): red background tint (`#ef4444` at 85% opacity), ⚡ prefix on power-up name
  - Power-ups (timer_add): green tint or groom gold (`#f59e0b` at 85% opacity), ✨ prefix
  - The `PowerUp.effectType` field determines the styling bucket.

### Groom-Side Effects
- **D-10:** `timer_add` / `timer_reduce`: Server sends `EFFECT_ACTIVATED` with `{ effectType, delta }`. Groom client adjusts its local countdown timer by `delta` seconds on receipt (add or subtract). A "+5s" or "-5s" flash shows on the timer display for 1 second.
- **D-11:** `scramble_options`: Server sends `EFFECT_ACTIVATED`. Groom client re-randomizes the order of the 4 trivia options in `$derived` state (shuffles the display array). Only relevant during trivia minigame — server should not broadcast scramble for non-trivia chapters.
- **D-12:** `distraction`: Server sends `EFFECT_ACTIVATED`. Groom client renders an emoji storm overlay for 3–5 seconds (CSS animation — emojis float up from the bottom in random positions, semi-transparent). Emoji set: 🍻👑💀🥳💍🎶 (bachelor party themed, same as memory cards). The overlay sits above the minigame UI (high z-index) but does NOT block critical interactive elements (answer buttons remain tappable under the emojis — use `pointer-events: none` on the emoji layer).

### New WebSocket Messages
- **D-13:** `SPEND_TOKEN` (client → server): `{ type: "SPEND_TOKEN", powerUpIndex: number }`. Server handles: validate balance, deduct, push action to `recentActions` log on `GameState`, broadcast `STATE_SYNC` + `EFFECT_ACTIVATED`.
- **D-14:** `EFFECT_ACTIVATED` (server → all clients): `{ type: "EFFECT_ACTIVATED", activatedBy: playerId, powerUpName: string, effectType: string, delta?: number }`. Triggers announcement overlay on all clients. Triggers effect handler on groom client.
- **D-15:** Recent actions log: `recentActions: Array<{ playerName: string; powerUpName: string; timestamp: number }>` on `GameState`. Server prepends on each activation, trims to last 20 entries. Clients display newest first.

### Context-Filtered Shop (GRPX-03)
- **D-16:** During a trivia minigame: all three effect types are available (timer_add, timer_reduce, scramble_options, distraction).
- **D-17:** During sensor and memory minigames: `scramble_options` is hidden (not applicable). Only `timer_add`, `timer_reduce`, and `distraction` are shown.
- **D-18:** Context filtering is client-side — client reads `chapter.minigameType` and hides inapplicable items. Server still validates on `SPEND_TOKEN` to prevent spoofed messages.

### Claude's Discretion
- Exact CSS animation for the emoji storm (keyframe float-up vs. randomized scatter)
- How to handle simultaneous sabotages (e.g., two distraction activations back-to-back) — can stack or restart the timer
- Exact layout dimensions and spacing of the earn button and shop list on mobile
- How to visually represent "0 tokens" state in the shop (greyed-out items with "Not enough tokens" vs. hidden)
- Whether to show a small "chapters" counter or phase name above the earn area during a challenge
- Exact wording for the earn button ("TAP TO EARN", "CHEER!", etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Group Participation & Economy (GRPX-01–07) — token balance, earning mechanic, shop, power-up examples, sabotage examples, announcements, social feed
- `.planning/REQUIREMENTS.md` §Real-Time Sync (SYNC-01–04) — 500ms broadcast SLA, full state on reconnect (all new WS messages must comply)
- `.planning/REQUIREMENTS.md` §Mobile UX (MOBX-01–05) — 100dvh, 44px tap targets, Wake Lock, SSR disabled

### Project
- `.planning/PROJECT.md` — Constraints: mobile web only, ≤10 players, one-time event, no persistence beyond server memory

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-03 (WS wrapper), D-04 (full state broadcast), D-09/D-10 (dark theme, Tailwind CSS)
- `.planning/phases/02-admin-game-structure/02-CONTEXT.md` — D-04 (Chapter type, powerUpCatalog field), D-07 (scores Record pattern — tokenBalances follows same pattern)
- `.planning/phases/03-groom-experience/03-CONTEXT.md` — D-05 (MINIGAME_COMPLETE, countdown timer), D-18 (full-screen result overlays), D-19 (scoring values)

### Existing Code (agents must read)
- `src/lib/types.ts` — Current `GameState`, `PowerUp`, `Chapter` types. Phase 4 extends `GameState` with `tokenBalances`, `recentActions`, and adds `SPEND_TOKEN`/`EFFECT_ACTIVATED` to message unions
- `src/routes/party/+page.svelte` — Current group waiting page. Phase 4 replaces the static waiting content with the full group economy UI (earn button, shop, social feed). Recap and reward overlays stay.
- `server/state.ts` — `GameState` definition, `setState()`, `broadcastState()`. Phase 4 extends state and adds SPEND_TOKEN handler
- `server/handlers.ts` — Existing message handler switch. Phase 4 adds `SPEND_TOKEN` case
- `src/routes/groom/+page.svelte` — Phase 4 adds `EFFECT_ACTIVATED` handling: timer delta, option scramble, emoji distraction overlay

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/socket.ts` — `gameState` writable store, `sendMessage()` — all group economy UI reads from `$gameState` and sends via `sendMessage()`
- Recap/reward overlay pattern in `src/routes/party/+page.svelte` — `.recap-overlay` + `.visible` CSS class toggle pattern; announcement overlay reuses this exact structure
- `PowerUp` type already fully defined in `src/lib/types.ts` with `tokenCost` and `effectType`
- `scores: Record<string, number>` pattern in `GameState` — `tokenBalances: Record<string, number>` follows identical structure

### Established Patterns
- `$derived` from `$gameState` for computed values — shop filtering, balance display all follow this
- Full state broadcast on every mutation (`broadcastState(server)`) — `SPEND_TOKEN` handler follows this
- `setState(updater)` functional update in `server/state.ts` — token deductions use this
- Dark bg `#0d0d0d`, group accent `#ef4444`, Tailwind CSS utilities — group economy UI inherits this theme

### Integration Points
- `GameState` in `server/state.ts` AND `src/lib/types.ts` must be extended in sync: add `tokenBalances`, `recentActions`, and optionally `startingTokens` (admin-configured)
- `ClientMessage` union gains: `SPEND_TOKEN`
- `ServerMessage` union gains: `EFFECT_ACTIVATED`
- `server/handlers.ts` gains: `SPEND_TOKEN` case
- `UNLOCK_CHAPTER` handler must initialize `tokenBalances` for all current group players to `startingTokens` value
- `src/routes/groom/+page.svelte` gains: `EFFECT_ACTIVATED` listener for timer delta, scramble, and distraction overlay
- Admin setup form (`src/routes/admin/setup/+page.svelte`) gains: `startingTokens` field in the power-up catalog section

</code_context>

<specifics>
## Specific Ideas

- Token balance display: "💰 7 tokens" or similar — use the currency emoji for quick visual recognition at a glance
- Earn button should feel satisfying to tap — haptic feedback (Vibration API, same as minigame win) on each tap
- Announcement overlay: "ALICE" big at top, "⚡ TIMER SCRAMBLE" below in red, auto-dismisses 2s
- The groom's timer delta flash: "+5s" or "-5s" text briefly overlaid on the radial countdown, same accent colors as win/loss
- Emoji storm: emojis float up from the bottom of the screen over 3-5 seconds, each on a random x position, random delay, `pointer-events: none` so groom can still tap answer buttons through the storm

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 04-group-economy-multiplayer*
*Context gathered: 2026-04-09*
