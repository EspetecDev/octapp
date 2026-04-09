# Phase 4: Group Economy & Multiplayer - Research

**Researched:** 2026-04-09
**Domain:** Svelte 5 reactive state, WebSocket broadcast protocol extension, CSS animation, mobile haptics
**Confidence:** HIGH — all findings grounded in the existing codebase which is fully readable; no third-party libraries are introduced

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Token Economy Model**
- D-01: Starting balance is admin-configurable — admin sets a per-chapter starting token amount in the pre-event setup form (ADMN-04 adds this field to the power-up catalog section). All group members start each chapter at this value.
- D-02: Earning mechanic: tap-to-earn button. Each tap = 1 token. Cap: max 5 tokens earnable per group member per challenge (not per chapter total — resets each minigame). The cap and button state are tracked client-side; server validates spend attempts but doesn't track tap counts.
- D-03: Token balances stored as `tokenBalances: Record<playerId, number>` on `GameState` (parallel to existing `scores`). Server initializes all group members to the admin-configured starting value on `UNLOCK_CHAPTER`. Reinitialization happens on each new chapter unlock.
- D-04: Spending a token sends a new WS message `SPEND_TOKEN` with `{ type: "SPEND_TOKEN", powerUpIndex: number }`. Server validates: player has sufficient balance, chapter is active, powerUp at that index exists. Server deducts balance, records the action, and broadcasts `STATE_SYNC` + a new `EFFECT_ACTIVATED` message.

**Group View Layout**
- D-05: Single-screen layout during an active challenge — top: groom progress indicator (timer value from `gameState.chapters[activeChapterIndex]`); middle: large tap-to-earn button with earned-this-challenge counter; bottom: scrollable shop list context-filtered from `powerUpCatalog`. Token balance shown prominently near earn button.
- D-06: Between challenges: social waiting screen showing each group member's name + current token balance; scrollable recent actions feed (newest first, last 10 entries); recap and reward overlays continue to appear on top.

**Announcement Overlay (GRPX-06)**
- D-07: Full-screen overlay, same pattern as recap card (CSS `.visible` class toggle, `opacity: 0 → 1`, `transition: opacity 200ms`). Auto-dismisses after 2 seconds. Appears on ALL connected clients simultaneously.
- D-08: Content: activating player's name (large) + power-up name (large). No flavor text.
- D-09: Sabotages (timer_reduce, scramble_options, distraction): red background tint (`#ef4444` at 85% opacity), ⚡ prefix. Power-ups (timer_add): gold tint (`#f59e0b` at 85% opacity), ✨ prefix. Determined by `PowerUp.effectType`.

**Groom-Side Effects**
- D-10: `timer_add` / `timer_reduce`: Groom client adjusts its local countdown timer by `delta` seconds on receipt. A "+5s" or "-5s" flash shows on the timer display for 1 second.
- D-11: `scramble_options`: Groom client re-randomizes the order of the 4 trivia options in `$derived` state. Server should not broadcast scramble for non-trivia chapters.
- D-12: `distraction`: Groom client renders an emoji storm overlay for 3–5 seconds. Emoji set: 🍻👑💀🥳💍🎶. Overlay has `pointer-events: none`; answer buttons remain tappable.

**New WebSocket Messages**
- D-13: `SPEND_TOKEN` (client → server): `{ type: "SPEND_TOKEN", powerUpIndex: number }`.
- D-14: `EFFECT_ACTIVATED` (server → all clients): `{ type: "EFFECT_ACTIVATED", activatedBy: playerId, powerUpName: string, effectType: string, delta?: number }`.
- D-15: Recent actions log: `recentActions: Array<{ playerName: string; powerUpName: string; timestamp: number }>` on `GameState`. Server prepends on each activation, trims to last 20 entries.

**Context-Filtered Shop (GRPX-03)**
- D-16: During trivia: all three effect types available.
- D-17: During sensor and memory: `scramble_options` hidden. Only `timer_add`, `timer_reduce`, and `distraction` shown.
- D-18: Context filtering is client-side. Server still validates on `SPEND_TOKEN`.

### Claude's Discretion
- Exact CSS animation for the emoji storm (keyframe float-up vs. randomized scatter)
- How to handle simultaneous sabotages (e.g., two distraction activations back-to-back) — can stack or restart the timer
- Exact layout dimensions and spacing of the earn button and shop list on mobile
- How to visually represent "0 tokens" state in the shop (greyed-out items vs. hidden)
- Whether to show a small "chapters" counter or phase name above the earn area during a challenge
- Exact wording for the earn button ("TAP TO EARN", "CHEER!", etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 4 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRPX-01 | Group members each have their own token balance, starting at a configured amount at the beginning of each phase | D-01, D-03: `tokenBalances: Record<playerId, number>` on `GameState`; initialized in `UNLOCK_CHAPTER` handler |
| GRPX-02 | Group members earn tokens by completing group-side activities (tap-to-earn during groom's challenge) | D-02: client-side tap counter (cap 5/minigame), sent via `SPEND_TOKEN` flow; haptic feedback via Vibration API |
| GRPX-03 | During a groom minigame, group members can spend tokens on power-ups or sabotages from a context-filtered list | D-16–D-18: client-side filter on `chapter.minigameType`; server validates on `SPEND_TOKEN` |
| GRPX-04 | Power-up example: add 5 seconds to the groom's timer | D-10, D-14: `EFFECT_ACTIVATED` with `effectType: "timer_add"` and `delta`; RadialCountdown needs adjustable `remaining` |
| GRPX-05 | Sabotage example: reduce timer, scramble options, distraction overlay | D-10–D-12: timer delta, re-derive shuffledOptions, emoji storm CSS animation |
| GRPX-06 | Activated sabotages and power-ups announced to all players visibly — never silent | D-07–D-09: `EFFECT_ACTIVATED` triggers full-screen overlay on all clients simultaneously |
| GRPX-07 | Group members can see each other's token balances and recent actions | D-06, D-15: social waiting screen reads `tokenBalances` and `recentActions` from `$gameState` |
</phase_requirements>

---

## Summary

Phase 4 adds the group economy layer on top of the existing WS infrastructure established in Phases 1–3. No new third-party libraries are required. The work is purely additive: two new WS message types, three new fields on `GameState`, a full replacement of the party page's content during active challenges, and effect handlers on the groom page.

The hardest integration point is the `EFFECT_ACTIVATED` message. The existing `socket.ts` `onmessage` handler routes messages to Svelte stores; `EFFECT_ACTIVATED` is inherently imperative (it triggers a transient visual effect, not a persistent state update). The cleanest pattern for this codebase is a Svelte writable store of the last-received effect, which components subscribe to and act on reactively — mirroring how `STATE_SYNC` drives `gameState`. This avoids adding callback plumbing to the singleton socket class.

The second challenge is the `RadialCountdown` component: it is fully self-contained with `remaining` as internal `$state`. Timer delta effects require the parent (TriviaMinigame) to communicate a delta inward. The cleanest approach — avoiding a refactor that breaks existing behavior — is to promote `remaining` out of RadialCountdown and pass it as a writable prop (Svelte 5 bindable prop via `$bindable()`), so TriviaMinigame can adjust it directly.

**Primary recommendation:** Implement in dependency order — types first, then server state and handlers, then socket layer, then groom effects, then party page economy UI. Stub the party page group economy screen early (same stub-then-fill strategy as Phase 3) so plans can run in parallel.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit 5 | already installed | Party page + groom page UI | Locked in Phase 1 |
| Bun WebSocket | already installed | `SPEND_TOKEN` handler, `EFFECT_ACTIVATED` broadcast | Locked in Phase 1 |
| Tailwind CSS v4 | already installed | Layout and utility classes | Locked in Phase 1 |

No new packages required. All Phase 4 features are implemented with existing stack.

### Supporting APIs (browser, no install)
| API | Purpose | Notes |
|-----|---------|-------|
| Vibration API (`navigator.vibrate`) | Haptic feedback on earn-tap | Already used in minigame win/loss; same pattern |
| CSS `@keyframes` animations | Emoji storm float-up | Self-contained; no library needed |
| `performance.now()` / `Date.now()` | Timestamp recent actions | Server stamps; client only displays |

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes

```
src/lib/
├── types.ts                      # Add tokenBalances, recentActions, startingTokens to GameState;
│                                 # Add SPEND_TOKEN to ClientMessage; add EFFECT_ACTIVATED to ServerMessage
├── socket.ts                     # Add lastEffect writable store; handle EFFECT_ACTIVATED in onmessage
└── components/
    ├── RadialCountdown.svelte    # Promote remaining to $bindable() prop so parent can adjust via delta
    └── TriviaMinigame.svelte     # Bind remaining; add EFFECT_ACTIVATED handler for timer delta + scramble + distraction

server/
├── state.ts                      # Add tokenBalances, recentActions, startingTokens to GameState type and initState()
└── handlers.ts                   # Add SPEND_TOKEN case; extend UNLOCK_CHAPTER to init tokenBalances

src/routes/
├── party/+page.svelte            # Replace static waiting content with full economy UI (earn, shop, feed)
│                                 # Add announcement overlay (same pattern as recap-overlay)
└── admin/setup/+page.svelte      # Add startingTokens number input in power-ups section
```

### Pattern 1: EFFECT_ACTIVATED as a Svelte Writable Store

**What:** `EFFECT_ACTIVATED` is not persistent state; it is a transient event. Route it through a writable store `lastEffect` so any component can react to it with `$effect`.

**When to use:** Any time a server push must trigger imperative UI behavior (animation, timer adjustment) rather than updating displayed data.

```typescript
// src/lib/socket.ts — add alongside gameState
export type EffectActivatedPayload = {
  activatedBy: string;
  powerUpName: string;
  effectType: string;
  delta?: number;
};
export const lastEffect = writable<EffectActivatedPayload | null>(null);

// Inside onmessage handler — add after existing STATE_SYNC branch:
} else if (msg.type === "EFFECT_ACTIVATED") {
  lastEffect.set(msg);
}
```

```svelte
<!-- In TriviaMinigame.svelte — react to lastEffect -->
<script>
  import { lastEffect } from "$lib/socket.ts";

  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;
    if (effect.effectType === "timer_add" || effect.effectType === "timer_reduce") {
      remaining = Math.max(0, remaining + (effect.delta ?? 0));
      showTimerFlash = effect.delta;
      setTimeout(() => { showTimerFlash = null; }, 1000);
    }
    if (effect.effectType === "scramble_options") {
      // re-derive shuffledOptions by triggering a reactive re-run
      shuffleSeed = Math.random();
    }
    if (effect.effectType === "distraction") {
      showDistraction = true;
      setTimeout(() => { showDistraction = false; }, 4000);
    }
  });
</script>
```

### Pattern 2: RadialCountdown with $bindable() remaining

**What:** Promote `remaining` from internal `$state` to a `$bindable()` prop so the parent TriviaMinigame can adjust it.

**When to use:** Any time a child component has internal state that a parent needs write access to (Svelte 5 `$bindable` pattern).

```svelte
<!-- RadialCountdown.svelte — changed props declaration -->
<script lang="ts">
  let { duration, onExpire, remaining = $bindable(duration) }:
    { duration: number; onExpire: () => void; remaining?: number } = $props();
  // remaining is now owned by parent if bound; self-managed if not bound (backward compat)
</script>
```

```svelte
<!-- TriviaMinigame.svelte — bind remaining -->
<script lang="ts">
  let timerRemaining = $state<number>(15);
</script>
<RadialCountdown duration={15} bind:remaining={timerRemaining} onExpire={handleTimerExpire} />
```

**Backward compatibility:** When `remaining` is not bound by the parent (non-trivia minigames, groom waiting screen), `$bindable(duration)` falls back to the default = `duration`, behaving identically to before.

### Pattern 3: Token Balance Initialization in UNLOCK_CHAPTER

**What:** On each `UNLOCK_CHAPTER`, reinitialize `tokenBalances` for all group players to `startingTokens`.

**When to use:** Every chapter unlock — balances reset per chapter (D-03).

```typescript
// server/handlers.ts — inside UNLOCK_CHAPTER setState updater, alongside scores init
const tokenBalances: Record<string, number> = {};
const startingTokens = s.startingTokens ?? 0;
s.players
  .filter((p) => p.role === "group")
  .forEach((p) => { tokenBalances[p.id] = startingTokens; });

return {
  ...s,
  activeChapterIndex: nextIndex,
  scores,
  tokenBalances,
  recentActions: [],  // clear log on new chapter
  chapters: updatedChapters,
};
```

### Pattern 4: SPEND_TOKEN Handler with Validation

```typescript
// server/handlers.ts — new case
if (msg.type === "SPEND_TOKEN") {
  const state = getState();
  if (!state || state.activeChapterIndex === null) return;
  const spenderId = ws.data.playerId;
  if (!spenderId) return;

  const powerUp = state.powerUpCatalog[msg.powerUpIndex];
  if (!powerUp) return; // invalid index

  const balance = state.tokenBalances?.[spenderId] ?? 0;
  if (balance < powerUp.tokenCost) return; // insufficient balance

  const spenderPlayer = state.players.find((p) => p.id === spenderId);
  const playerName = spenderPlayer?.name ?? "Unknown";

  // Compute delta for timer effects
  const delta = powerUp.effectType === "timer_add"
    ? (powerUp.tokenCost * 5)   // or a fixed value — Claude's discretion
    : powerUp.effectType === "timer_reduce"
    ? -(powerUp.tokenCost * 5)
    : undefined;

  setState((s) => {
    const newBalances = { ...s.tokenBalances, [spenderId]: balance - powerUp.tokenCost };
    const newAction = { playerName, powerUpName: powerUp.name, timestamp: Date.now() };
    const newActions = [newAction, ...(s.recentActions ?? [])].slice(0, 20);
    return { ...s, tokenBalances: newBalances, recentActions: newActions };
  });

  // Broadcast STATE_SYNC (balances + feed updated) + EFFECT_ACTIVATED (triggers overlays/effects)
  broadcastState(server);
  server.publish("game", JSON.stringify({
    type: "EFFECT_ACTIVATED",
    activatedBy: spenderId,
    powerUpName: powerUp.name,
    effectType: powerUp.effectType,
    delta,
  }));
  return;
}
```

### Pattern 5: Announcement Overlay (all clients)

**What:** Reuse the exact same `.recap-overlay` + `.visible` CSS class toggle pattern. Add to `party/+page.svelte`, `groom/+page.svelte`, and optionally admin.

```svelte
<!-- Driven by $lastEffect store -->
<script lang="ts">
  import { lastEffect } from "$lib/socket.ts";
  let showAnnouncement = $state(false);
  let announcementEffect = $state<EffectActivatedPayload | null>(null);
  let announceDismissTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;
    announcementEffect = effect;
    showAnnouncement = true;
    if (announceDismissTimer) clearTimeout(announceDismissTimer);
    announceDismissTimer = setTimeout(() => { showAnnouncement = false; }, 2000);
  });
</script>

<div
  class="announce-overlay"
  class:visible={showAnnouncement}
  style="background: {isSabotage ? 'rgba(239,68,68,0.85)' : 'rgba(245,158,11,0.85)'};"
  role="status"
  aria-live="polite"
>
  <p class="announce-player">{activatingPlayerName}</p>
  <p class="announce-powerup">{prefix} {announcementEffect?.powerUpName}</p>
</div>
```

### Pattern 6: Emoji Storm Overlay (distraction effect)

**What:** CSS `@keyframes` animation; emojis float up from bottom with randomized x position, delay, and duration. `pointer-events: none` on the container so groom can still tap answer buttons.

```svelte
<!-- In TriviaMinigame.svelte (and SensorMinigame, MemoryMinigame) -->
{#if showDistraction}
  <div class="emoji-storm" aria-hidden="true">
    {#each BACHELOR_EMOJIS_SPREAD as item}
      <span
        class="emoji-float"
        style="left: {item.x}%; animation-delay: {item.delay}ms; animation-duration: {item.duration}ms;"
      >{item.emoji}</span>
    {/each}
  </div>
{/if}

<style>
  .emoji-storm {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60; /* above result overlay (z-50) but below announcement overlay (z-70) */
    overflow: hidden;
  }
  .emoji-float {
    position: absolute;
    bottom: -40px;
    font-size: 32px;
    animation: floatUp linear forwards;
  }
  @keyframes floatUp {
    from { transform: translateY(0); opacity: 0.9; }
    to   { transform: translateY(-110vh); opacity: 0; }
  }
</style>
```

**Emoji spread pre-calculation:** Generate the `BACHELOR_EMOJIS_SPREAD` array once with `Array.from({length: 20})` picking random emoji, x (0–90), delay (0–1000ms), duration (2000–4000ms). Store as a `$state` array, reset each time `showDistraction` becomes true.

### Pattern 7: Tap-to-Earn Button with Client-Side Cap

```svelte
<script lang="ts">
  const EARN_CAP = 5;
  let earnedThisChallenge = $state(0);
  let myBalance = $derived($gameState?.tokenBalances?.[myPlayerId ?? ""] ?? 0);

  function handleEarnTap() {
    if (earnedThisChallenge >= EARN_CAP) return;
    earnedThisChallenge += 1;
    // Haptic feedback (same as minigame win)
    if ("vibrate" in navigator) navigator.vibrate(50);
    // Server doesn't track earn taps; balance increase is manual local optimistic update
    // The server reflects balance via STATE_SYNC after SPEND_TOKEN, not earn taps
    // So balance shown is from $gameState unless we do optimistic local tracking
    // DECISION: optimistic local only — earned tokens are "available to spend" and must be
    // initialized properly. See Pitfall 3 below.
  }

  // Reset earn counter when chapter changes
  $effect(() => {
    const _idx = $gameState?.activeChapterIndex;
    earnedThisChallenge = 0;
  });
</script>
```

**Critical note on D-02 vs token balance:** D-02 states "server validates spend attempts but doesn't track tap counts." This means the server initializes balances at chapter start and decrements on spend. The tap-to-earn does NOT send a message to the server — it is a purely local client-side counter for UX gating only. The actual token balance that the group member can spend is the `tokenBalances[myPlayerId]` from `$gameState` — which reflects admin-configured starting amount. The tap-to-earn button gives players a sense of "earning" but the balance they started with is from the admin config. **Clarification for planner:** D-02 as written means the tap counter is a UX mechanic to prevent spam-buying at challenge start, not an actual earned increment that gets persisted. The balance shown = admin-configured starting tokens, decremented by spends. Confirm this reading is correct before implementing.

### Anti-Patterns to Avoid

- **Pushing EFFECT_ACTIVATED through STATE_SYNC:** `EFFECT_ACTIVATED` is an event, not state. If you embed it in `GameState`, late-joining players will re-trigger effects from the past. Keep it as a separate broadcast alongside `broadcastState`.
- **Tracking earn taps server-side:** D-02 explicitly says server doesn't track taps. Do not add a `tapsThisChallenge` counter to `GameState` — this would add unnecessary broadcast churn on every tap.
- **Mutating `shuffledOptions` array in place:** Svelte 5 requires object identity changes for array reactivity. Use a `shuffleSeed` reactive variable to force re-evaluation of the `$derived` block (Pitfall 2 pattern already in MemoryMinigame).
- **Using `{#if}` for overlays instead of `.visible` CSS class:** Existing pattern uses CSS class toggle to allow fade-out animation to complete. Keep this pattern for announcement overlay and emoji storm.
- **z-index conflicts:** Current layers: recap-overlay z-50, result-overlay z-50. Add emoji storm z-60, announcement overlay z-70. Document these to avoid future stacking bugs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket broadcast to all clients | Custom fanout loop | `server.publish("game", ...)` | Already established; Bun's publish targets the "game" channel all sockets subscribe to |
| Exponential backoff reconnect | Custom retry logic | Existing `ReconnectingWebSocket` in `socket.ts` | Already implemented with jitter |
| Reactive state propagation | Custom event bus | Svelte writable stores (`lastEffect`) | Established pattern; `gameState` already does this |
| Fisher-Yates shuffle | Custom shuffle | Already in `TriviaMinigame.svelte` | Re-use same pattern for scramble_options trigger |

---

## Common Pitfalls

### Pitfall 1: EFFECT_ACTIVATED Replayed on Reconnect

**What goes wrong:** If `EFFECT_ACTIVATED` were stored in `GameState` and sent on reconnect via `STATE_SYNC`, a reconnecting player would see an announcement overlay for a power-up activated minutes ago.

**Why it happens:** `handleOpen` sends full `STATE_SYNC` to any connecting client. Transient events must not be in persistent state.

**How to avoid:** Keep `EFFECT_ACTIVATED` as a pure server publish, separate from `broadcastState`. `recentActions` in `GameState` (which IS in STATE_SYNC) is the persistent record — the overlay is driven only by live `EFFECT_ACTIVATED` messages.

**Warning signs:** If the announcement overlay fires on page load/reconnect, you've accidentally stored trigger state in `GameState`.

### Pitfall 2: Timer Delta Applied to an Already-Expired Timer

**What goes wrong:** A `timer_reduce` effect arrives after the groom's timer has already hit 0. Applying a negative delta to a 0 value would go negative; the `onExpire` callback might fire twice.

**Why it happens:** Network latency window + race condition between timer expire and effect delivery.

**How to avoid:** In the groom client's effect handler: `remaining = Math.max(0, remaining + delta)`. If `remaining` is already 0 when the delta arrives, clamp to 0 and ignore (result is already determined). Idempotency guard in `MINIGAME_COMPLETE` handler already exists on the server.

**Warning signs:** Negative remaining time displayed on the timer, or `MINIGAME_COMPLETE` sent twice.

### Pitfall 3: Tap-to-Earn Counter Not Resetting Between Chapters

**What goes wrong:** `earnedThisChallenge` is `$state` in the party page component. If the `$effect` watching `activeChapterIndex` fires before the component is mounted (e.g., a late-joining group member), the reset never runs for the current chapter.

**Why it happens:** `initialSyncDone` guard pattern (already present for recap card) must be reused here. On first STATE_SYNC, set the earn counter to 0 without any side effect. On subsequent chapter changes, reset to 0.

**How to avoid:** Mirror the `initialSyncDone` guard used for the recap card. The earn counter reset `$effect` should be scoped inside the same guard.

**Warning signs:** Group member can earn more than 5 tokens in a chapter; disable state on earn button not working.

### Pitfall 4: Context Shop Showing scramble_options During Non-Trivia

**What goes wrong:** The shop shows `scramble_options` during a sensor or memory minigame. Group member spends tokens; server broadcasts `EFFECT_ACTIVATED` with `effectType: "scramble_options"`; groom client has no handler for it in sensor/memory context — silent effect.

**Why it happens:** Client-side filtering is missing or using wrong chapter state to determine minigameType.

**How to avoid:** `$derived` the filtered shop list from `activeChapter?.minigameType`. Server-side: in `SPEND_TOKEN` handler, validate that `scramble_options` is only valid when `chapters[activeChapterIndex].minigameType === "trivia"`. Return early (silently drop) if not.

**Warning signs:** Server broadcasts `scramble_options` when active chapter is sensor or memory.

### Pitfall 5: Announcement Overlay on Groom Page Triggered Twice

**What goes wrong:** If announcement overlay is driven by `$lastEffect` in both the parent page (`groom/+page.svelte`) and inside a minigame component (`TriviaMinigame.svelte`), the effect triggers twice — both the overlay AND the timer adjustment / scramble.

**Why it happens:** Both `$effect` subscriptions react to the same store change.

**How to avoid:** Keep announcement overlay only in the page-level component (`groom/+page.svelte`). Keep gameplay effect handlers only in minigame components. Do not double-subscribe to `$lastEffect` for the same concern.

**Warning signs:** Multiple overlays rendering simultaneously (z-index stacking visible), or timer adjusted twice.

### Pitfall 6: startingTokens Field Missing from SAVE_SETUP Message

**What goes wrong:** Admin adds a `startingTokens` input to the setup form but forgets to include it in the `SAVE_SETUP` message payload. Server never receives it; `GameState.startingTokens` stays `undefined`; all group members start at 0.

**Why it happens:** `SAVE_SETUP` currently sends `{ chapters, powerUpCatalog }`. Adding a third field requires updating both the client form submit function AND the `IncomingMessage` type in `handlers.ts`.

**How to avoid:** Update `IncomingMessage` in `handlers.ts` and `ClientMessage` in `types.ts` simultaneously. Add `startingTokens?: number` to `SAVE_SETUP` message type. Server defaults to 0 if absent.

**Warning signs:** Token balances always start at 0 regardless of admin configuration.

### Pitfall 7: Svelte 5 $derived for shuffledOptions Not Re-Running on Scramble

**What goes wrong:** `scramble_options` effect arrives; the scramble handler tries to re-shuffle `shuffledOptions` but since it is a `$derived` expression, it won't re-run unless its reactive dependencies change.

**Why it happens:** `$derived` tracks reactive reads — if the scramble is triggered by an imperative external event (WS message) and no reactive variable changed, the `$derived` does not re-evaluate.

**How to avoid:** Introduce a `shuffleSeed = $state(0)` variable. The `$derived` for `shuffledOptions` reads `shuffleSeed` (even if unused in computation). The `scramble_options` handler increments `shuffleSeed` by 1, forcing `$derived` to re-evaluate.

```typescript
let shuffleSeed = $state(0);
let shuffledOptions = $derived(() => {
  void shuffleSeed; // reactive dependency for forced re-evaluation
  if (!question) return [];
  // ... Fisher-Yates shuffle ...
});
// On scramble_options effect:
shuffleSeed += 1;
```

**Warning signs:** Scramble appears to do nothing on the groom's screen; options remain in original order.

---

## Code Examples

### GameState Extensions (types.ts and server/state.ts — must stay in sync)

```typescript
// Add to GameState in BOTH files:
export type GameState = {
  // ... existing fields ...
  startingTokens: number;                                          // admin-configured, default 0
  tokenBalances: Record<string, number>;                          // playerId → balance
  recentActions: Array<{ playerName: string; powerUpName: string; timestamp: number }>; // last 20
};

// initState() update — server/state.ts:
activeState = {
  // ... existing defaults ...
  startingTokens: 0,
  tokenBalances: {},
  recentActions: [],
};
```

### ServerMessage Union Extension (types.ts)

```typescript
export type ServerMessage =
  | { type: "STATE_SYNC"; state: GameState }
  | { type: "PING"; ts: number }
  | { type: "PLAYER_JOINED"; playerId: string }
  | { type: "ERROR"; code: "WRONG_CODE" | "GROOM_TAKEN" | "INVALID_NAME" | "UNKNOWN"; message: string }
  | { type: "EFFECT_ACTIVATED"; activatedBy: string; powerUpName: string; effectType: string; delta?: number };
```

### ClientMessage Union Extension (types.ts)

```typescript
export type ClientMessage =
  | // ... existing messages ...
  | { type: "SPEND_TOKEN"; powerUpIndex: number }
  | { type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[]; startingTokens: number };
```

### Admin Setup Form — startingTokens Field

Add in the Power-ups & Sabotages section header area:

```svelte
<div class="flex items-center gap-3 mb-4">
  <label class="text-[14px] text-text-secondary">Starting tokens per chapter</label>
  <input
    type="number"
    min="0"
    class="w-20 bg-bg border border-border rounded-lg px-2 py-2 text-base text-text-primary text-center min-h-[44px]"
    value={startingTokens}
    oninput={(e) => { startingTokens = Number((e.target as HTMLInputElement).value); }}
  />
</div>
```

And update `saveSetup()`:
```typescript
sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog, startingTokens });
```

And restore from `$gameState`:
```typescript
if (!restoredFromState && gs && gs.chapters.length > 0) {
  chapters = structuredClone(gs.chapters);
  powerUpCatalog = structuredClone(gs.powerUpCatalog);
  startingTokens = gs.startingTokens ?? 0;
  restoredFromState = true;
}
```

### Party Page — Derived Values for Group Economy UI

```svelte
<script lang="ts">
  // During active challenge
  let isChallengeLive = $derived(
    $gameState?.phase === "active" &&
    $gameState?.activeChapterIndex !== null &&
    activeChapter !== null &&
    !activeChapter.minigameDone
  );

  let myBalance = $derived($gameState?.tokenBalances?.[myPlayerId ?? ""] ?? 0);

  let activeChapter = $derived(
    $gameState?.activeChapterIndex != null
      ? ($gameState.chapters[$gameState.activeChapterIndex] ?? null)
      : null
  );

  let filteredShop = $derived(
    ($gameState?.powerUpCatalog ?? []).filter((p) => {
      if (p.effectType === "scramble_options" && activeChapter?.minigameType !== "trivia") return false;
      return true;
    })
  );

  // Social waiting screen
  let groupPlayers = $derived(
    ($gameState?.players ?? []).filter((p) => p.role === "group")
  );

  let recentActions = $derived(
    ($gameState?.recentActions ?? []).slice(0, 10) // display newest first, last 10
  );
</script>
```

---

## Integration Points — Complete Change List

This is the complete set of files requiring edits in Phase 4:

| File | Change Type | What |
|------|-------------|------|
| `src/lib/types.ts` | Extend | Add `startingTokens`, `tokenBalances`, `recentActions` to `GameState`; add `SPEND_TOKEN` to `ClientMessage`; add `EFFECT_ACTIVATED` to `ServerMessage`; extend `SAVE_SETUP` message type |
| `server/state.ts` | Extend | Same `GameState` type additions (must stay in sync); add defaults in `initState()` |
| `server/handlers.ts` | Extend | Add `SPEND_TOKEN` case; extend `UNLOCK_CHAPTER` to init `tokenBalances` and clear `recentActions`; extend `SAVE_SETUP` to accept `startingTokens` |
| `src/lib/socket.ts` | Extend | Add `lastEffect` writable store; add `EffectActivatedPayload` type; handle `EFFECT_ACTIVATED` in `onmessage` |
| `src/lib/components/RadialCountdown.svelte` | Refactor | Promote `remaining` to `$bindable()` prop (default = `duration` for backward compat) |
| `src/lib/components/TriviaMinigame.svelte` | Extend | Bind `remaining` from parent; add `$effect` for `$lastEffect` to handle timer delta, scramble (via `shuffleSeed`), and distraction overlay |
| `src/lib/components/SensorMinigame.svelte` | Extend | Add `$effect` for `$lastEffect` to handle distraction overlay only (no timer — sensor manages own; verify if RadialCountdown is used here) |
| `src/lib/components/MemoryMinigame.svelte` | Extend | Add `$effect` for `$lastEffect` to handle distraction overlay only |
| `src/routes/party/+page.svelte` | Major rewrite | Replace static waiting content with group economy UI (challenge screen + social waiting screen); add announcement overlay |
| `src/routes/groom/+page.svelte` | Extend | Add announcement overlay driven by `$lastEffect` |
| `src/routes/admin/setup/+page.svelte` | Extend | Add `startingTokens` number input; include in `saveSetup()` call; restore from `$gameState` |

---

## Open Questions

1. **Tap-to-earn balance mechanics (D-02 ambiguity)**
   - What we know: Each tap = 1 token; cap 5 per minigame; client-side tracking; server only validates spend attempts.
   - What's unclear: D-02 says "earning mechanic" but the server initializes balance from `startingTokens`. If earn taps don't increment the server-side balance, the group member's spendable balance is only the admin-configured starting amount — tapping earns nothing persistently. The cap serves only as a UX friction gate.
   - Recommendation: Planner should explicitly decide: (a) tapping sends a `EARN_TOKEN` message that increments server balance (simple), OR (b) tapping is purely cosmetic UX with no server impact (balance = startingTokens always). Option (b) matches the literal text of D-02 but makes the "earn" mechanic misleading. Option (a) requires one more WS message type. Flag for user confirmation before implementing.

2. **Timer_reduce effectType missing from PowerUp.effectType union**
   - What we know: `PowerUp.effectType` is typed as `"timer_add" | "scramble_options" | "distraction" | string`. The admin setup form only offers these three options.
   - What's unclear: D-10 references `timer_reduce` as a distinct effect type for the groom-side handler. The `powerUpCatalog` select in the setup form has no `timer_reduce` option.
   - Recommendation: Add `timer_reduce` as a fourth option in the admin form select dropdown. The server's delta computation distinguishes `timer_add` (positive delta) from `timer_reduce` (negative delta). Both should be selectable by the admin.

3. **Simultaneous distractions (Claude's discretion)**
   - What we know: Two distraction activations back-to-back are allowed.
   - Recommendation: Restart the timer on each new distraction — set `showDistraction = false` then immediately back to `true` (and reset the emoji spread array for visual freshness). Stacking creates confusion and does not improve gameplay.

4. **Announcement overlay on admin page**
   - What we know: D-07 says overlay appears on ALL connected clients (groom, group, admin) simultaneously.
   - What's unclear: Admin uses a separate dashboard with live game state. Adding `EFFECT_ACTIVATED` handling to admin page was not mentioned in CONTEXT.md.
   - Recommendation: Skip admin announcement overlay in this phase. Admin can see the `recentActions` feed from the state panel. Mark as out of scope unless the user specifically requests it.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely code changes on top of the existing stack. No new CLI tools, databases, services, or runtimes are required. All runtime dependencies (Bun, SvelteKit, Tailwind) are already installed and confirmed working from Phases 1–3.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/lib/types.ts`, `server/state.ts`, `server/handlers.ts`, `src/lib/socket.ts`, `src/lib/components/RadialCountdown.svelte`, `src/lib/components/TriviaMinigame.svelte`, `src/routes/party/+page.svelte`, `src/routes/groom/+page.svelte`, `src/routes/admin/setup/+page.svelte` — all read directly
- `.planning/phases/04-group-economy-multiplayer/04-CONTEXT.md` — all locked decisions
- `.planning/REQUIREMENTS.md` — GRPX-01–07, SYNC-01–04, MOBX-01–05
- Svelte 5 `$bindable()` docs — verified pattern for writable child props

### Secondary (MEDIUM confidence)
- Svelte 5 `$derived` reactivity behavior — verified by existing `shuffledOptions` pattern in `TriviaMinigame.svelte` using IIFE; `shuffleSeed` workaround is a known Svelte 5 pattern for forcing re-evaluation on external events
- Vibration API `navigator.vibrate()` — confirmed present in codebase (minigame win/loss); browser support is HIGH on Android, not supported on iOS Safari (graceful no-op)

### Tertiary (LOW confidence — no action required)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns exist in codebase
- Architecture: HIGH — every pattern is an extension of existing established patterns (recap overlay, $derived, setState, broadcastState)
- Pitfalls: HIGH — identified from direct code reading of existing patterns and their guards; not speculative

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack; no fast-moving dependencies)
