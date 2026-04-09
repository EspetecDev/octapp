# Phase 3: Groom Experience - Research

**Researched:** 2026-04-09
**Domain:** SvelteKit 5 UI patterns, DeviceMotion API, CSS animation, WebSocket message extension
**Confidence:** HIGH

## Summary

Phase 3 is a pure UI and server-logic extension phase. No new libraries are needed. Every tool required — Svelte 5 reactive state, Tailwind CSS v4, WebSocket message passing, DeviceMotion normalization, Wake Lock — is already installed and working. The codebase scaffolded deliberate extension points for exactly this work (sensors.ts, wakeLock.ts, overlay pattern, `setState`/`broadcastState`).

The work divides cleanly into: (a) extending types on both client and server, (b) adding three server message handlers, (c) building four conditional screens inside `src/routes/groom/+page.svelte`, and (d) adding reward-reveal overlays to party and admin pages. The most nuanced sub-problem is the DeviceMotion iOS permission gate — iOS 13+ requires `DeviceMotionEvent.requestPermission()` called inside a user-gesture handler, not in `onMount`.

**Primary recommendation:** Expand the single groom page using the existing `$derived` + conditional block pattern already present. All server mutations follow the existing `setState` + `broadcastState` recipe. No new dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Single-page conditional rendering — `src/routes/groom/+page.svelte` reads `$gameState` and derives which screen to show. No sub-routes. Screens: Waiting (lobby), Minigame, Scavenger, Reward. No back-button navigation risk on mobile.

**D-02:** Screen selection logic:
- `phase === "lobby"` → Waiting screen
- `activeChapterIndex != null` + `!chapter.minigameDone` → Minigame screen
- `activeChapterIndex != null` + `chapter.minigameDone` + `!chapter.scavengerDone` → Scavenger screen
- `activeChapterIndex != null` + `chapter.minigameDone` + `chapter.scavengerDone` → Reward screen

**D-03:** Chapter progress tracked via two new boolean fields on the `Chapter` type: `minigameDone` and `scavengerDone`. Server is the source of truth — progress survives reconnects.

**D-04:** After reward reveal, groom stays on the reward screen until admin unlocks the next chapter.

**D-05:** `MINIGAME_COMPLETE` — payload `{ type: "MINIGAME_COMPLETE", result: "win" | "loss" }`. Server flips `chapter.minigameDone = true`, updates score (+50 win / -20 loss), broadcasts STATE_SYNC.

**D-06:** `SCAVENGER_DONE` — no payload beyond type. Server flips `chapter.scavengerDone = true`, broadcasts STATE_SYNC.

**D-07:** `HINT_REQUEST` — server deducts 10 points, broadcasts STATE_SYNC. Hint text is already in `chapter.scavengerHint`.

**D-08:** Tilt meter mechanic — tilt RIGHT fills bar (positive x from `normalizeSensorData()`). Goal: reach ≥80%.

**D-09:** Win condition: meter ≥80% at any point (win immediately) OR timer expires below 80% (loss).

**D-10:** Uses `normalizeSensorData()` and `detectPlatform()` from `src/lib/sensors.ts`.

**D-11:** iOS permission gate: tap-to-enable button before DeviceMotion is requested. Must appear before any sensor access.

**D-12:** Question drawn from `chapter.triviaPool[chapter.servedQuestionIndex]`.

**D-13:** Radial countdown — SVG circle `stroke-dashoffset` animation. Green → yellow → red. Number in center. 15 seconds.

**D-14:** Answer selection determined client-side against `correctAnswer`.

**D-15:** 4×3 grid, 6 emoji pairs (12 cards). Fixed set: 🍻 👑 💀 🥳 💍 🎶

**D-16:** Memory timer: 30 seconds. Same radial countdown component as trivia.

**D-17:** Win: all pairs matched within time. Loss: timer expires with unmatched pairs.

**D-18:** Win overlay: accent color flash (`#f59e0b`), "CORRECT!" / "NAILED IT!" text, "+50 pts", haptic buzz. Loss overlay: red tint (`#ef4444`), "WRONG!" / "TIME'S UP!", "-20 pts", double haptic. Auto-advance after 2 seconds.

**D-19:** Scoring: +50 win, -20 loss.

**D-20:** After result auto-dismiss, client sends `MINIGAME_COMPLETE`.

**D-21:** Groom self-reports via "I found it!". Admin can also tap "Confirm found" on dashboard.

**D-22:** Hint costs -10 points. Shows `chapter.scavengerHint` after next STATE_SYNC.

**D-23:** Hint button visible only if `chapter.scavengerHint` is non-empty.

**D-24:** Reward reveal is full-screen on both groom page and party page when `chapter.scavengerDone` flips true.

**D-25:** Past rewards: accordion/collapsible section below current reward on groom's reward screen. No separate `/groom/history` route.

### Claude's Discretion
- Exact confetti/particle implementation for the win celebration (CSS animation vs. canvas)
- Card flip animation style for memory matching (CSS 3D transform)
- Emoji set selection for memory cards (suggested: 🍻 👑 💀 🥳 💍 🎶)
- How to handle the edge case where `scavengerHint` is absent (hide button entirely vs. show disabled)
- Exact easing curves for meter fill animation on sensor challenge
- Whether to show a small score +/- indicator on the waiting screen after a chapter completes (nice-to-have)

### Deferred Ideas (OUT OF SCOPE)
- Admin-configurable emoji sets for memory cards — v2 scope
- Configurable scoring values per chapter — v2 scope
- Past rewards via dedicated `/groom/history` route — user chose accordion on reward screen

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MINI-01 | Trivia minigame — question + 4 options + 15–20s timer | D-12/D-13: question from `chapter.triviaPool[servedQuestionIndex]`, 15s radial SVG countdown |
| MINI-02 | Phone sensor minigame — tilt to fill meter, DeviceMotion API | D-08/D-09/D-10: `normalizeSensorData()` already scaffolded; tilt-right fills bar to ≥80% |
| MINI-03 | Memory/matching minigame — 4×3 grid, 6 emoji pairs, 30s timer | D-15/D-16/D-17: fixed emoji set, 30s radial countdown, same component as trivia |
| MINI-04 | Radial countdown timer visible in all minigames | D-13/D-16: shared SVG `stroke-dashoffset` component, reused by trivia and memory |
| MINI-05 | Completing earns points; failing costs points | D-19: +50 win / -20 loss; sent via MINIGAME_COMPLETE; server applies to `scores` |
| MINI-06 | Full-screen win/loss result with haptic feedback | D-18: overlay pattern from existing recap card; `navigator.vibrate()` for haptic |
| MINI-07 | Tap-to-enable iOS permission gate before DeviceMotion | D-11: `DeviceMotionEvent.requestPermission()` must be called in a user-gesture handler |
| HUNT-01 | Groom receives scavenger clue after minigame | D-02/D-21: Scavenger screen shown when `minigameDone && !scavengerDone`; clue from `chapter.scavengerClue` |
| HUNT-02 | Groom can request a hint (costs 10 pts) | D-22/D-23: HINT_REQUEST message; server deducts 10pts; hint text shown after STATE_SYNC |
| HUNT-03 | Groom marks complete; admin can also confirm | D-21: both send SCAVENGER_DONE; same server handler |
| HUNT-04 | Completing scavenger step unlocks reward | D-02: Reward screen shown when `minigameDone && scavengerDone` |
| RWRD-01 | Full-screen reward reveal visible to all players | D-24: overlay added to party/+page.svelte triggered by `scavengerDone` state change |
| RWRD-02 | Reward is admin-configured text | `chapter.reward` already in the Chapter type from Phase 2 |
| RWRD-03 | Past rewards viewable by groom | D-25: accordion section on groom reward screen listing all completed chapter rewards |

</phase_requirements>

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit 5 | already in repo | Page routing, reactive state | Established in Phase 1 |
| Svelte 5 runes (`$state`, `$derived`, `$effect`) | already in repo | Reactive UI | Already used throughout codebase |
| Tailwind CSS v4 | already in repo | Styling, dark theme tokens | Established in Phase 1, CSS-first `@theme` block |
| Bun WebSocket server | already in repo | Real-time state sync | Established in Phase 1/2 |

### No New Dependencies Required

All capabilities needed for Phase 3 are available via:
- **DeviceMotion API** — built-in browser API, no library needed
- **Vibration API** — `navigator.vibrate()`, no library needed
- **SVG radial timer** — raw SVG `circle` with `stroke-dashoffset`, no library needed
- **Card flip animation** — CSS 3D transform (`rotateY`), no library needed
- **Wake Lock API** — already abstracted in `src/lib/wakeLock.ts`
- **CSS confetti** — either CSS keyframe animation or a lightweight canvas approach; no external library needed (Claude's Discretion area)

**Installation:** None required.

---

## Architecture Patterns

### Groom Page Screen Router (D-01, D-02)

The groom page uses a single `$derived` value to select which screen to render. This is the core structural pattern for the entire page.

```typescript
// Inside src/routes/groom/+page.svelte <script>
let activeChapter = $derived(
  $gameState?.activeChapterIndex != null
    ? $gameState.chapters[$gameState.activeChapterIndex]
    : null
);

let screen = $derived<"waiting" | "minigame" | "scavenger" | "reward">(() => {
  if (!$gameState || $gameState.phase === "lobby" || activeChapter === null) return "waiting";
  if (!activeChapter.minigameDone) return "minigame";
  if (!activeChapter.scavengerDone) return "scavenger";
  return "reward";
});
```

Template structure:
```svelte
{#if screen === "waiting"}
  <!-- existing waiting screen content -->
{:else if screen === "minigame"}
  <!-- conditional on activeChapter.minigameType -->
  {#if activeChapter.minigameType === "trivia"}
    <!-- TriviaMinigame -->
  {:else if activeChapter.minigameType === "sensor"}
    <!-- SensorMinigame -->
  {:else if activeChapter.minigameType === "memory"}
    <!-- MemoryMinigame -->
  {/if}
{:else if screen === "scavenger"}
  <!-- ScavengerScreen -->
{:else if screen === "reward"}
  <!-- RewardScreen -->
{/if}
```

### Shared Radial Countdown Component (MINI-04)

Both trivia (15s) and memory (30s) use the same SVG component. It accepts a `duration` prop and emits an event when it expires.

```svelte
<!-- RadialCountdown.svelte -->
<script lang="ts">
  let { duration, onExpire }: { duration: number; onExpire: () => void } = $props();
  let remaining = $state(duration);
  // ...interval that counts down and calls onExpire()
</script>

<svg viewBox="0 0 100 100" class="w-24 h-24">
  <!-- Track circle -->
  <circle cx="50" cy="50" r="45" fill="none" stroke="#2d2d2f" stroke-width="8"/>
  <!-- Progress circle — stroke-dashoffset animated -->
  <circle
    cx="50" cy="50" r="45"
    fill="none"
    stroke={remaining > duration * 0.5 ? "#22c55e" : remaining > duration * 0.25 ? "#f59e0b" : "#ef4444"}
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray={2 * Math.PI * 45}
    stroke-dashoffset={2 * Math.PI * 45 * (1 - remaining / duration)}
    style="transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 1s linear, stroke 300ms;"
  />
  <!-- Center seconds text -->
  <text x="50" y="56" text-anchor="middle" fill="#f9fafb" font-size="24" font-weight="700">{remaining}</text>
</svg>
```

### Win/Loss Result Overlay Pattern (MINI-05, MINI-06)

Reuses the established `.recap-overlay` + `.visible` CSS pattern from groom and party pages. The overlay is always in the DOM; `.visible` toggles opacity and `pointer-events`.

```svelte
<!-- Result overlay state -->
let resultState = $state<null | "win" | "loss">(null);

function handleMinigameResult(outcome: "win" | "loss") {
  resultState = outcome;
  // Haptic feedback (MINI-06)
  if ("vibrate" in navigator) {
    navigator.vibrate(outcome === "win" ? 200 : [100, 50, 100]);
  }
  // Auto-advance after 2s (D-18, D-20)
  setTimeout(() => {
    resultState = null;
    sendMessage({ type: "MINIGAME_COMPLETE", result: outcome });
  }, 2000);
}
```

```svelte
<div class="result-overlay" class:visible={resultState !== null}
     style="background: {resultState === 'win' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};">
  <p class="result-text">{resultState === 'win' ? 'NAILED IT!' : "TIME'S UP!"}</p>
  <p class="result-points">{resultState === 'win' ? '+50 pts' : '-20 pts'}</p>
</div>
```

### iOS DeviceMotion Permission Gate (MINI-07, D-11)

This is the most platform-specific pattern. iOS 13+ requires `DeviceMotionEvent.requestPermission()` to be called from within a direct user-gesture handler (e.g., a click/touchend callback). Calling it in `onMount` or a `$effect` will be rejected silently.

```typescript
// Correct iOS permission gate pattern
let sensorPermission = $state<"pending" | "granted" | "denied" | "not-required">("pending");

async function requestSensorPermission() {
  // This function MUST be called from a direct button click handler
  const DeviceMotionEventAny = DeviceMotionEvent as any;
  if (typeof DeviceMotionEventAny.requestPermission === "function") {
    try {
      const result = await DeviceMotionEventAny.requestPermission();
      sensorPermission = result === "granted" ? "granted" : "denied";
    } catch {
      sensorPermission = "denied";
    }
  } else {
    // Android / desktop — no permission required
    sensorPermission = "not-required";
  }
}

// Permission gate UI: show tap-to-enable button when sensorPermission === "pending"
// Only start the event listener AFTER permission is "granted" or "not-required"
```

### Server Handler Pattern (D-05, D-06, D-07)

All three new messages follow the existing `setState` + `broadcastState` recipe in `server/handlers.ts`:

```typescript
// In handleMessage() switch — MINIGAME_COMPLETE
if (msg.type === "MINIGAME_COMPLETE") {
  const state = getState();
  if (!state || state.activeChapterIndex === null) return;
  const groomId = state.groomPlayerId;
  setState((s) => {
    const delta = msg.result === "win" ? 50 : -20;
    const updatedChapters = s.chapters.map((ch, i) =>
      i === s.activeChapterIndex ? { ...ch, minigameDone: true } : ch
    );
    return {
      ...s,
      chapters: updatedChapters,
      scores: groomId
        ? { ...s.scores, [groomId]: (s.scores[groomId] ?? 0) + delta }
        : s.scores,
    };
  });
  broadcastState(server);
  return;
}
```

### Memory Matching Game Logic

The 4×3 grid with pair matching has a predictable state machine:

```typescript
// State for memory minigame
let cards = $state(shuffleCards(EMOJI_SET)); // 12 cards: [{id, emoji, flipped, matched}]
let flippedIndices = $state<number[]>([]);
let lockBoard = $state(false);

function flipCard(index: number) {
  if (lockBoard || cards[index].flipped || cards[index].matched) return;
  cards[index].flipped = true;
  flippedIndices = [...flippedIndices, index];

  if (flippedIndices.length === 2) {
    lockBoard = true;
    const [a, b] = flippedIndices;
    if (cards[a].emoji === cards[b].emoji) {
      // Match
      cards[a].matched = true;
      cards[b].matched = true;
      flippedIndices = [];
      lockBoard = false;
      if (cards.every(c => c.matched)) handleMinigameResult("win");
    } else {
      // No match — flip back after 800ms
      setTimeout(() => {
        cards[a].flipped = false;
        cards[b].flipped = false;
        flippedIndices = [];
        lockBoard = false;
      }, 800);
    }
  }
}
```

### Reward Reveal on Party Page (RWRD-01, D-24)

The party page needs a new `$effect` that watches `chapter.scavengerDone`. Same pattern as the existing recap card effect — detect the boolean flip, show overlay, let it persist (not auto-dismiss; stays until next chapter unlock).

```typescript
// party/+page.svelte
let showRewardReveal = $state(false);
let revealedChapterIndex = $state<number | null>(null);

$effect(() => {
  const idx = $gameState?.activeChapterIndex ?? null;
  const chapter = idx !== null ? $gameState?.chapters[idx] : null;
  if (!initialSyncDone) { /* baseline */ return; }
  if (chapter?.scavengerDone && idx !== revealedChapterIndex) {
    revealedChapterIndex = idx;
    showRewardReveal = true;
  }
  // Dismiss when chapter advances (idx changes)
  if (idx !== revealedChapterIndex && showRewardReveal) {
    showRewardReveal = false;
  }
});
```

### Type Extension Pattern (D-03)

Both `src/lib/types.ts` and `server/state.ts` must be extended in sync — they define the `Chapter` type independently. New fields must be added to both and defaulted in `initState()`.

**src/lib/types.ts — Chapter additions:**
```typescript
export type Chapter = {
  // ... existing fields ...
  minigameDone: boolean;      // Phase 3: tracks minigame completion per chapter
  scavengerDone: boolean;     // Phase 3: tracks scavenger completion per chapter
};
```

**server/state.ts — Chapter additions:** same two fields.

**UNLOCK_CHAPTER handler** must reset these to `false` on the newly activated chapter (they default false but should be explicitly reset to support edge cases where state is mutated).

**initState()** — Chapter objects created by SAVE_SETUP will not have these fields yet. The server must handle missing fields gracefully. The canonical fix is to add defaults in `initState()` and to reset/populate in the UNLOCK_CHAPTER handler where the chapter is activated.

### ClientMessage Extension (D-05, D-06, D-07)

Add to `ClientMessage` union in `src/lib/types.ts`:
```typescript
| { type: "MINIGAME_COMPLETE"; result: "win" | "loss" }
| { type: "SCAVENGER_DONE" }
| { type: "HINT_REQUEST" }
```

Also add to the `IncomingMessage` type in `server/handlers.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG radial timer | Custom `requestAnimationFrame` loop | CSS `transition` on `stroke-dashoffset` | Simpler, GPU-composited, handles tab backgrounding gracefully |
| Card shuffle | Custom shuffle algorithm | Fisher-Yates (one function, ~5 lines) | Well-known, proven — just write it inline, don't reach for a library |
| Haptic feedback | Third-party library | `navigator.vibrate()` directly | Already available in Android Chrome; iOS Safari does not support Vibration API and fails silently — calling it directly is the correct approach |
| iOS permission checking | Try-catch on event listener | `typeof DeviceMotionEvent.requestPermission === "function"` guard | Standard feature-detect pattern; iOS 12 and earlier don't have this method |
| Overlay fade animation | JS-driven opacity changes | CSS `.visible` class toggle + `transition: opacity 200ms` | Already established project pattern; avoids JS-driven layout thrash |
| Score arithmetic | Separate scoring service | Inline in the `MINIGAME_COMPLETE` handler with `setState` | Scores are simple integers; adding a service layer is over-engineering |

---

## Common Pitfalls

### Pitfall 1: iOS DeviceMotion Permission in `onMount` or `$effect`
**What goes wrong:** `DeviceMotionEvent.requestPermission()` called outside a direct user gesture (e.g., in `onMount`) returns a rejected promise or "denied" silently on iOS 13+. The sensor never activates and the minigame appears broken.
**Why it happens:** iOS enforces that permission APIs must be called synchronously inside a user-interaction handler.
**How to avoid:** The permission call must live in the `onclick` handler of the tap-to-enable button (D-11). Never call it in reactive code paths.
**Warning signs:** `requestPermission()` returns "denied" immediately, no system permission dialog shown.

### Pitfall 2: Memory Cards Mutating Svelte 5 `$state` Arrays
**What goes wrong:** Directly assigning `cards[i].flipped = true` may not trigger reactivity in Svelte 5 if `cards` is a plain array — mutation of nested properties requires the array itself to be reassigned or the object at index to be replaced.
**Why it happens:** Svelte 5 runes track object identity, not deep mutations by default.
**How to avoid:** Replace the card at the mutated index: `cards = cards.map((c, i) => i === idx ? { ...c, flipped: true } : c)`. Or use a flat reactive approach. Do NOT mutate the array in-place.
**Warning signs:** Card flips in state but UI does not update.

### Pitfall 3: `chapter.minigameDone` / `chapter.scavengerDone` Missing on Late-Joined Players
**What goes wrong:** A player who joins after a chapter has been activated receives STATE_SYNC with a Chapter object that may not have `minigameDone`/`scavengerDone` fields if those defaults weren't set in `initState()`.
**Why it happens:** SAVE_SETUP creates Chapter objects without the new fields; the server sends them as-is.
**How to avoid:** In the UNLOCK_CHAPTER handler, always explicitly set `minigameDone: false, scavengerDone: false` on the chapter being activated (reset, not just default). This ensures every active chapter has these fields.

### Pitfall 4: Reward Reveal Re-Triggering on Reconnect (Party Page)
**What goes wrong:** Party page shows reward overlay again every time a player reconnects during a chapter where `scavengerDone` is already `true`.
**Why it happens:** The `$effect` baseline guard (`initialSyncDone`) correctly handles the recap card (chapter index change), but the reward reveal logic needs its own baseline check against the current `revealedChapterIndex`.
**How to avoid:** On first STATE_SYNC (`!initialSyncDone`), set `revealedChapterIndex = idx` AND check if `chapter.scavengerDone` is already true — if so, set `showRewardReveal = true` immediately (they joined mid-reward) OR skip showing it (depends on desired UX). The `initialSyncDone` guard approach from the recap card pattern handles the reconnect case correctly.

### Pitfall 5: Sensor Event Listener Not Cleaned Up
**What goes wrong:** If the groom navigates away from the sensor minigame screen (e.g., server state advances to scavenger before they finish), the `devicemotion` event listener remains attached and continues consuming battery and potentially calling stale callbacks.
**Why it happens:** Event listeners added in `$effect` must be explicitly removed in the cleanup function.
**How to avoid:** Always return a cleanup from `$effect` that calls `window.removeEventListener("devicemotion", handler)`. Also call `releaseWakeLock()` in the same cleanup.
**Warning signs:** Console log showing sensor events after screen transition.

### Pitfall 6: Timer Interval Not Cleared on Early Win
**What goes wrong:** Memory card timer continues to tick down and fires `onExpire` even after all pairs are matched (win condition met first).
**Why it happens:** The interval is set once and runs independently of game state.
**How to avoid:** Store the interval reference and `clearInterval()` when win/loss is determined, before calling `handleMinigameResult`.

### Pitfall 7: `MINIGAME_COMPLETE` Sent Multiple Times
**What goes wrong:** If the groom has a brief UI glitch or tap registers twice, two `MINIGAME_COMPLETE` messages arrive — doubling the score delta.
**Why it happens:** No server-side guard against processing the same message twice.
**How to avoid:** In the server handler, check `if (chapter.minigameDone) return;` before processing. The message is idempotent if we guard against it.

### Pitfall 8: `lockBoard` State Race in Memory Matching
**What goes wrong:** Rapid taps on two different cards and then a third card before the 800ms flip-back timeout fires — the third tap registers while `lockBoard` is being set.
**Why it happens:** JS single-threaded but `setTimeout` callbacks are queued; if the lock state isn't set before the next tap event, it processes before the lock is active.
**How to avoid:** Set `lockBoard = true` synchronously in `flipCard()` as soon as the second card is flipped, before the `setTimeout`.

---

## Code Examples

### Vibration API Haptic Feedback
```typescript
// Win — single long buzz
if ("vibrate" in navigator) navigator.vibrate(200);
// Loss — double short buzz (double-buzz pattern from D-18)
if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
```
Note: iOS Safari does not support the Vibration API. The `"vibrate" in navigator` guard ensures silent fallback. Confidence: HIGH (MDN Web Docs).

### SVG Radial Progress Circle
```svelte
<script lang="ts">
  let { duration, onExpire }: { duration: number; onExpire: () => void } = $props();
  let remaining = $state(duration);
  const RADIUS = 45;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  $effect(() => {
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  let strokeColor = $derived(
    remaining > duration * 0.5 ? "#22c55e"
    : remaining > duration * 0.25 ? "#f59e0b"
    : "#ef4444"
  );
  let dashOffset = $derived(CIRCUMFERENCE * (1 - remaining / duration));
</script>

<svg viewBox="0 0 100 100" class="w-24 h-24" role="timer" aria-label="{remaining} seconds remaining">
  <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#2d2d2f" stroke-width="8"/>
  <circle
    cx="50" cy="50" r={RADIUS}
    fill="none" stroke={strokeColor} stroke-width="8" stroke-linecap="round"
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={dashOffset}
    style="transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 1s linear, stroke 300ms;"
  />
  <text x="50" y="56" text-anchor="middle" fill="#f9fafb" font-size="24" font-weight="700">{remaining}</text>
</svg>
```

### DeviceMotion Sensor Challenge (Core Loop)
```typescript
// Inside SensorMinigame component
let platform = $state<"ios" | "android" | "unknown">("unknown");
let meterFill = $state(0); // 0–1
let sensorPermission = $state<"pending" | "granted" | "denied" | "not-required">("pending");

onMount(() => {
  platform = detectPlatform();
  if (platform !== "ios") {
    sensorPermission = "not-required";
  }
  // iOS: wait for user gesture to call requestPermission
});

async function handleEnableTap() {
  // Must be called from a direct button onclick handler
  const DevMot = DeviceMotionEvent as any;
  if (typeof DevMot.requestPermission === "function") {
    const result = await DevMot.requestPermission();
    sensorPermission = result === "granted" ? "granted" : "denied";
  } else {
    sensorPermission = "not-required";
  }
}

// Start sensor loop once permission obtained
$effect(() => {
  if (sensorPermission !== "granted" && sensorPermission !== "not-required") return;
  const handler = (event: DeviceMotionEvent) => {
    const reading = normalizeSensorData(event, platform);
    // Normalize x from roughly -9.8 to +9.8 → clamp to 0–1 for tilt-right fill
    const normalized = Math.max(0, Math.min(1, (reading.x + 9.8) / 9.8));
    meterFill = normalized;
    if (normalized >= 0.8) {
      window.removeEventListener("devicemotion", handler);
      handleMinigameResult("win");
    }
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
});
```

### Fisher-Yates Card Shuffle
```typescript
const EMOJI_SET = ["🍻", "👑", "💀", "🥳", "💍", "🎶"];

function shuffleCards() {
  const deck = [...EMOJI_SET, ...EMOJI_SET].map((emoji, id) => ({
    id,
    emoji,
    flipped: false,
    matched: false,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
```

### CSS Card Flip (3D Transform)
```css
.card {
  perspective: 600px;
}
.card-inner {
  transform-style: preserve-3d;
  transition: transform 300ms ease;
  position: relative;
}
.card-inner.flipped {
  transform: rotateY(180deg);
}
.card-front,
.card-back {
  backface-visibility: hidden;
  position: absolute;
  inset: 0;
}
.card-back {
  transform: rotateY(180deg);
}
```

### Admin "Confirm Found" Button (HUNT-03, D-21)
Add to admin/+page.svelte Zone 3, visible when `activeChapter?.minigameDone && !activeChapter?.scavengerDone`:
```svelte
{#if activeChapter?.minigameDone && !activeChapter?.scavengerDone}
  <button
    onclick={() => sendMessage({ type: "SCAVENGER_DONE" })}
    class="w-full min-h-[48px] bg-surface border border-border text-text-primary font-bold rounded-xl"
  >
    Confirm Found (admin override)
  </button>
{/if}
```

---

## Integration Points Checklist

All of these must be touched in Phase 3:

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `minigameDone: boolean`, `scavengerDone: boolean` to `Chapter`; add `MINIGAME_COMPLETE`, `SCAVENGER_DONE`, `HINT_REQUEST` to `ClientMessage` union |
| `server/state.ts` | Add `minigameDone: boolean`, `scavengerDone: boolean` to server `Chapter` type |
| `server/handlers.ts` | Add handlers for `MINIGAME_COMPLETE`, `SCAVENGER_DONE`, `HINT_REQUEST`; extend `IncomingMessage` union; reset `minigameDone`/`scavengerDone` to `false` in UNLOCK_CHAPTER for the newly activated chapter |
| `src/routes/groom/+page.svelte` | Add screen router logic + all four screens (Waiting already exists, add Minigame, Scavenger, Reward); add Wake Lock acquire/release |
| `src/routes/party/+page.svelte` | Add reward reveal overlay triggered by `chapter.scavengerDone` flip |
| `src/routes/admin/+page.svelte` | Add "Confirm found" button in Zone 3 |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely frontend UI + server handler extensions. All external dependencies (Node/Bun runtime, DeviceMotion API, Vibration API) are either already running or are browser built-ins that require no installation.

---

## Open Questions

1. **Wake Lock scope for minigames**
   - What we know: `acquireWakeLock()` is ready in `src/lib/wakeLock.ts`. The `visibilitychange` re-acquire is already wired globally.
   - What's unclear: Should Wake Lock be acquired when the minigame screen appears and released when the result overlay dismisses? Or when entering `activeChapterIndex != null` broadly?
   - Recommendation: Acquire on transition to the minigame screen (`screen === "minigame"`), release when `MINIGAME_COMPLETE` is sent. This is the most targeted scope (MOBX-03 says "during active minigames").

2. **Confetti implementation (Claude's Discretion)**
   - What we know: CONTEXT.md leaves this to Claude's discretion.
   - Recommendation: Use a CSS keyframe approach — 20–30 absolutely positioned `<div>` elements with varied `animation-delay`, `animation-duration`, random start positions via inline CSS custom properties. No canvas needed at this scale. This avoids a new dependency.

3. **`scavengerDone` → reward reveal persistence**
   - What we know: D-24 says reward reveals to all players. D-04 says groom stays on reward screen until admin unlocks next chapter.
   - What's unclear: Should the party page reward overlay auto-dismiss (like recap) or persist?
   - Recommendation: Persist (no auto-dismiss) on party page. It should stay visible until the next UNLOCK_CHAPTER event (which changes `activeChapterIndex`). This maximizes the theatrical moment and matches the "drop the mic" intent from CONTEXT.md specifics.

4. **Score going negative**
   - What we know: -20 for a loss, -10 for a hint request.
   - What's unclear: Should scores be clamped at 0 or allowed to go negative?
   - Recommendation: Allow negative scores — they add drama and the requirements don't specify a floor. Clamping is a v2 consideration.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — DeviceMotionEvent.requestPermission() (iOS permission gate pattern)
- MDN Web Docs — Vibration API (`navigator.vibrate()`, iOS not supported)
- MDN Web Docs — Screen Wake Lock API
- MDN Web Docs — SVG `stroke-dashoffset` and `stroke-dasharray`
- Existing codebase: `src/lib/sensors.ts`, `src/lib/wakeLock.ts`, `src/lib/socket.ts`, `src/lib/types.ts`, `server/handlers.ts`, `server/state.ts` — direct source reading

### Secondary (MEDIUM confidence)
- Svelte 5 runes reactivity model for arrays — mutation-vs-reassignment behavior verified by reading existing codebase patterns and Svelte 5 documentation conventions
- CSS 3D card flip pattern — well-established CSS technique, no library verification needed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in codebase, verified by direct file reading
- Architecture patterns: HIGH — derived directly from existing codebase patterns (overlay, $derived, setState/broadcastState) and locked decisions in CONTEXT.md
- Pitfalls: HIGH for iOS DeviceMotion (platform-specific, widely documented); HIGH for Svelte 5 mutation (read from existing code style); MEDIUM for timeout/interval edge cases (logic-derived)
- Integration points: HIGH — read directly from source files

**Research date:** 2026-04-09
**Valid until:** 2026-07-09 (stable browser APIs, stable library versions)
