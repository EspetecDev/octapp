# Phase 2: Admin & Game Structure - Research

**Researched:** 2026-04-08
**Domain:** SvelteKit 5 (Svelte 5 runes), Bun WebSocket server, in-memory game state extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pre-event setup lives at `/admin/setup` — separate from `/admin`. Setup = before the event; `/admin` = live-night control.
- **D-02:** Setup form is one scrollable page with all chapters stacked as accordion/sections (everything visible at once, 1–5 chapters).
- **D-03:** "Configure Game" button on `/admin` during lobby state, links to `/admin/setup`. Button disappears/disables once the first chapter is unlocked.
- **D-04:** 1–5 chapters, each with `name` (string), `minigameType` ("trivia"|"sensor"|"memory"), `triviaPool` (array of question objects), `scavengerClue` (text + optional hint), `reward` (text description).
- **D-05:** Trivia is a pool per chapter — server picks one at random when the chapter activates; server tracks which question was served.
- **D-06:** Admin picks minigame type per chapter at setup. No auto-cycling.
- **D-07:** `scores: Record<playerId, number>` scaffolded in `GameState`, initialized to 0 for all players. Phase 3 populates actual values.
- **D-08:** Vertical zone layout on `/admin` during event: (1) session code, (2) "Configure Game" button (lobby only), (3) chapter control + unlock button, (4) connected player list with roles, (5) scores.
- **D-09:** Unlock is instant, one tap, no confirmation dialog. Button only appears when appropriate (previous chapter complete / lobby for Chapter 1).
- **D-10:** Recap card shows chapter name + number only (e.g., "Chapter 2: The Bar"). No minigame type spoilers.
- **D-11:** Recap card auto-dismisses after 3 seconds. Everyone advances together automatically.

### Claude's Discretion

- Exact accordion/expand behavior for the setup form (open all by default, or collapsed with expand-on-tap)
- Visual treatment of the recap card (full-screen overlay vs. card modal)
- Power-up catalog setup form layout (ADMN-04) — list of entries with name, description, token cost, effect type
- WebSocket message type names for new server events (e.g., `CHAPTER_UNLOCKED`, `SETUP_SAVED`)
- Exact error handling for setup form validation (required fields, min/max lengths)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 2 scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMN-01 | Admin configures trivia questions (question text + answer + wrong options) via in-app setup form | Data model design, Svelte 5 reactive form pattern |
| ADMN-02 | Admin configures scavenger hunt steps (riddle/clue text + optional hint) per chapter | Same setup form, same data model |
| ADMN-03 | Admin configures rewards per chapter (text description) | Same setup form |
| ADMN-04 | Admin defines power-up/sabotage catalog (name, description, token cost, effect type) | Separate catalog section in setup form |
| ADMN-05 | Setup content persists in server memory and survives admin reconnects within the same session | Full-state broadcast pattern already handles this — `GameState` extension is sufficient |
| GAME-01 | Admin can pre-configure chapters before the event | `/admin/setup` route + `SAVE_SETUP` message |
| GAME-02 | Game starts in lobby state; no challenges visible until admin unlocks Chapter 1 | Phase state machine extension; client rendering gated on `activeChapterIndex` |
| GAME-03 | Admin can unlock the next chapter from the dashboard | `UNLOCK_CHAPTER` message handler + server validation |
| GAME-04 | Each chapter is self-contained: minigame → scavenger → reward | Data model (D-04) covers this; Phase 3 implements it |
| GAME-05 | Phase transition shows "new chapter" recap card to all players | `CHAPTER_UNLOCKED` broadcast + client-side 3-second auto-dismiss overlay |
| GAME-06 | Admin sees current session state at all times: connected players, active chapter, scores | `/admin` dashboard Zones 3 + 4 driven by `$gameState` derived values |

</phase_requirements>

---

## Summary

Phase 2 builds on a fully working Phase 1 foundation. The server has `GameState` in memory, broadcasts it on every mutation, and reconnecting clients receive a full snapshot. Phase 2 extends that pattern in two directions: (1) a new server-side data model for chapters/setup content, and (2) new WebSocket message handlers for `SAVE_SETUP` and `UNLOCK_CHAPTER`. The client side gets a new `/admin/setup` route and an expanded `/admin` dashboard.

The most important design constraint is that all data flows through the existing `STATE_SYNC` / `broadcastState` pattern. There are no secondary APIs, no polling, and no additional persistence layer. Setup data saved by the admin is just fields added to `GameState`; when any client reconnects, they get the full current state including setup content (ADMN-05 is free).

The most complex implementation task is the chapter data model: it must support variable chapter counts (1–5), a trivia question pool per chapter (array of objects), and server-side tracking of which question was served. This needs careful TypeScript type design in both `server/state.ts` and `src/lib/types.ts`, which must be kept in sync.

**Primary recommendation:** Extend `GameState` with `chapters`, `activeChapterIndex`, and `scores` fields; add `SAVE_SETUP` and `UNLOCK_CHAPTER` to the message unions; build `/admin/setup` with the same token-auth gate already used by `/admin`.

---

## Standard Stack

### Core (already installed, no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit 5 / Svelte 5 | Already in project | `/admin/setup` route, admin dashboard updates | Established in Phase 1 |
| Tailwind CSS v4 | Already in project | All new UI components | Established in Phase 1; `@theme` tokens already defined |
| Bun WebSocket server | Already in project | New message handlers | Established in Phase 1 |
| TypeScript | Already in project | Type-safe `GameState` extension | Established in Phase 1 |

### No New Dependencies Required

Phase 2 is purely extending existing infrastructure. All UI, WebSocket, and state management is already in place. No new npm packages are needed.

**Key insight:** The entire Phase 2 feature set is achievable by:
1. Extending `GameState` type (both `server/state.ts` and `src/lib/types.ts`)
2. Adding two new ClientMessage types (`SAVE_SETUP`, `UNLOCK_CHAPTER`)
3. Adding two new handlers in `server/handlers.ts`
4. Adding one new route `src/routes/admin/setup/+page.svelte`
5. Expanding `src/routes/admin/+page.svelte` with Zones 3 + 4

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── routes/
│   ├── admin/
│   │   ├── +page.svelte        # EXPAND: add Zone 3 (chapter control) + Zone 4 (scores)
│   │   └── setup/
│   │       └── +page.svelte    # NEW: pre-event setup form
server/
├── state.ts                    # EXTEND: GameState type + initState defaults
├── handlers.ts                 # EXTEND: SAVE_SETUP + UNLOCK_CHAPTER handlers
src/lib/
├── types.ts                    # EXTEND: GameState, ServerMessage, ClientMessage unions
```

### Pattern 1: GameState Extension

**What:** Add `chapters`, `activeChapterIndex`, and `scores` to the existing `GameState` type.
**When to use:** Every new field in game state follows this pattern — single source of truth, broadcast on every mutation.

```typescript
// Both server/state.ts AND src/lib/types.ts must be updated in sync

export type TriviaQuestion = {
  question: string;
  correctAnswer: string;
  wrongOptions: [string, string, string]; // exactly 3 wrong options
};

export type Chapter = {
  name: string;
  minigameType: "trivia" | "sensor" | "memory";
  triviaPool: TriviaQuestion[];
  scavengerClue: string;
  scavengerHint?: string;
  reward: string;
};

export type PowerUp = {
  name: string;
  description: string;
  tokenCost: number;
  effectType: string; // e.g., "timer_add", "scramble_options", "distraction"
};

export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
  // Phase 2 additions:
  chapters: Chapter[];
  activeChapterIndex: number | null;  // null = lobby (no chapter active)
  servedQuestionIndex: number | null; // tracks which trivia question was served (D-05)
  scores: Record<string, number>;     // playerId → score (D-07)
  powerUpCatalog: PowerUp[];
};
```

**Backward compatibility:** `initState` must initialize all new fields with safe defaults:
```typescript
// server/state.ts — initState
activeState = {
  sessionCode,
  phase: "lobby",
  players: [],
  groomPlayerId: null,
  chapters: [],
  activeChapterIndex: null,
  servedQuestionIndex: null,
  scores: {},
  powerUpCatalog: [],
};
```

### Pattern 2: New Message Handlers (following existing switch pattern in handlers.ts)

**What:** Two new ClientMessage types added to the union; two new branches in `handleMessage`.
**When to use:** Every admin action that mutates server state.

```typescript
// src/lib/types.ts — additions to ClientMessage union
| { type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[] }
| { type: "UNLOCK_CHAPTER" }

// server/handlers.ts — new handler branches
if (msg.type === "SAVE_SETUP") {
  // Validate: only allowed in lobby state
  // Apply: setState with chapters + powerUpCatalog
  // Broadcast: broadcastState(server)
  return;
}

if (msg.type === "UNLOCK_CHAPTER") {
  // Validate: only admin connection may send this (check ws.data or token)
  // Validate: next chapter exists
  // Apply: increment activeChapterIndex, set phase to "active", pick trivia question (D-05)
  // Broadcast: broadcastState(server) — recap card driven by state change on client
  return;
}
```

### Pattern 3: Admin Auth Guard for `/admin/setup`

**What:** `/admin/setup` reuses the exact same token-auth pattern as `/admin`.
**When to use:** Any new admin route.

```svelte
<!-- src/routes/admin/setup/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  let authorized = $state<boolean | null>(null);
  let token = $state<string>("");

  onMount(async () => {
    const t = $page.url.searchParams.get("token") ?? "";
    token = t; // Preserve token for SAVE_SETUP message and for back-navigation links
    if (!t) { authorized = false; return; }
    const res = await fetch(`/api/admin/session?token=${encodeURIComponent(t)}`);
    authorized = res.ok;
  });
</script>
```

**Critical:** The token must be preserved in the component so it can be appended to the "Back to Dashboard" link (`/admin?token=...`). The user should never lose access by navigating between admin routes.

### Pattern 4: Recap Card — Svelte 5 Reactive Overlay (client-side)

**What:** Client derives a `showRecapCard` boolean from `$gameState.activeChapterIndex`. When it changes (chapter unlocks), show the recap overlay, then auto-dismiss after 3 seconds.

```svelte
<!-- In groom/+page.svelte and party/+page.svelte -->
<script lang="ts">
  import { gameState } from "$lib/socket.ts";

  let showRecap = $state(false);
  let recapChapterIndex = $state<number | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // Watch for activeChapterIndex changes
  $effect(() => {
    const idx = $gameState?.activeChapterIndex;
    if (idx !== null && idx !== undefined && idx !== recapChapterIndex) {
      recapChapterIndex = idx;
      showRecap = true;
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => { showRecap = false; }, 3000);
    }
  });
</script>

{#if showRecap && $gameState && recapChapterIndex !== null}
  <!-- Full-screen recap overlay -->
{/if}
```

**Pitfall:** `$effect` runs on every reactive access. Only track `activeChapterIndex` — do not subscribe to the whole `$gameState` object or the effect will fire on every state update (player connect/disconnect, score changes).

### Pattern 5: Svelte 5 Reactive Form (setup form)

**What:** Chapter array managed as `$state<Chapter[]>([])`. Add/remove chapters and questions reactively.
**When to use:** Any dynamic list form in Svelte 5.

```svelte
<script lang="ts">
  import type { Chapter, TriviaQuestion } from "$lib/types.ts";

  let chapters = $state<Chapter[]>([]);

  function addChapter() {
    chapters = [...chapters, {
      name: "",
      minigameType: "trivia",
      triviaPool: [{ question: "", correctAnswer: "", wrongOptions: ["", "", ""] }],
      scavengerClue: "",
      scavengerHint: "",
      reward: "",
    }];
  }

  function removeChapter(i: number) {
    chapters = chapters.filter((_, idx) => idx !== i);
  }

  function addQuestion(chapterIndex: number) {
    chapters = chapters.map((c, i) =>
      i === chapterIndex
        ? { ...c, triviaPool: [...c.triviaPool, { question: "", correctAnswer: "", wrongOptions: ["", "", ""] }] }
        : c
    );
  }
</script>
```

**Note:** Svelte 5 `$state` with array mutation requires creating a new array reference (spread or `.map()`) — mutating the array in-place does not trigger reactivity for nested objects.

### Anti-Patterns to Avoid

- **Mutating `$state` arrays in-place:** `chapters.push(...)` won't trigger Svelte 5 reactivity. Always use `chapters = [...chapters, newItem]`.
- **Watching the whole `$gameState` in `$effect` for chapter transitions:** This fires on every broadcast (connect/disconnect events, etc.). Watch `$gameState?.activeChapterIndex` specifically.
- **Admin-only token validation on client only:** Token auth happens server-side via `/api/admin/session`. The client auth check is a UX gate, not a security gate — the server must also validate admin actions (UNLOCK_CHAPTER handler should verify state preconditions before accepting).
- **Sending `SAVE_SETUP` from non-lobby state:** The handler must reject setup saves after the first chapter is unlocked. Client disables the form; server enforces it.
- **Duplicating GameState type:** `server/state.ts` and `src/lib/types.ts` define the same shape. Both must be updated together. The server imports from its own `state.ts`; the client imports from `$lib/types.ts`. These are kept in manual sync — a divergence causes silent type errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Setup data persistence across admin refresh | Custom API endpoint + localStorage sync | Extend `GameState` — it's already broadcast to reconnecting clients via `SYNC-02` | `handleOpen` already sends full state snapshot; reconnecting admin gets chapters back for free |
| Admin-only message authorization | Per-message token headers | Server validates preconditions (phase === "lobby" for SAVE_SETUP, chapter exists for UNLOCK_CHAPTER) — admin is the only one who knows to send these messages | Simplified auth model appropriate for one-time event with ≤10 players |
| Chapter transition animation timer | Custom Intersection Observer or CSS animation callbacks | `setTimeout(3000)` + Svelte `$state` flag | D-11 specifies exactly 3 seconds auto-dismiss; no complex animation orchestration needed |
| Form state persistence on page unload | beforeunload, IndexedDB, or service worker | `SAVE_SETUP` message sent to server; state lives in server memory | Server is single source of truth; admin can re-open `/admin/setup` and see current chapters |

**Key insight:** The "persist setup across refresh" requirement (ADMN-05) is solved entirely by the existing full-state broadcast pattern. When the admin refreshes `/admin/setup`, the WS reconnects, `handleOpen` sends `STATE_SYNC`, and `$gameState.chapters` populates the form. No custom persistence layer needed.

---

## Common Pitfalls

### Pitfall 1: `activeChapterIndex` vs. `phase` field collision

**What goes wrong:** Phase 1 uses `phase: "lobby" | "active" | "ended"` as a simple string. Phase 2 adds `activeChapterIndex`. If the plan tries to use the existing `phase` field to represent chapter advancement, the state machine becomes ambiguous.

**Why it happens:** `phase: "active"` already exists and it's tempting to overload it.

**How to avoid:** Keep `phase` as the macro-state ("lobby" | "active" | "ended"). Use `activeChapterIndex: number | null` for micro-state (which chapter is active). `phase` transitions to `"active"` when the first chapter is unlocked; `activeChapterIndex` increments on subsequent unlocks. These are orthogonal fields.

**Warning signs:** Logic like `if (phase === "active" && chapterNumber === 2)` — means the phase field is being overloaded.

### Pitfall 2: Form binding with array of objects in Svelte 5

**What goes wrong:** Binding `<input bind:value={chapters[i].name}>` can cause subtle issues in Svelte 5 when the array reference is replaced (e.g., after `removeChapter`). Svelte 5's fine-grained reactivity handles this correctly IF the state is declared with `$state`, but only at the top-level object — nested mutations on non-`$state` arrays do not propagate.

**Why it happens:** Svelte 5 runes reactivity is different from Svelte 4 stores; array mutations in `$state` objects require reassignment to the root `$state` variable, not just mutation of nested items.

**How to avoid:** Always reassign the chapters array at the root: `chapters = chapters.map(...)` or `chapters = [...chapters]`. Never `chapters[i].name = value` without a subsequent `chapters = chapters` reassignment.

**Warning signs:** Form inputs showing stale values after add/remove operations.

### Pitfall 3: Token lost during admin navigation between /admin and /admin/setup

**What goes wrong:** Admin navigates from `/admin?token=XYZ` to `/admin/setup` without passing the token. The setup page fails auth and shows "Access denied."

**Why it happens:** SvelteKit client-side navigation strips query params unless explicitly included in the `href`.

**How to avoid:** All navigation links between admin routes must include the token: `<a href="/admin/setup?token={token}">Configure Game</a>` and `<a href="/admin?token={token}">Back to Dashboard</a>`. The token must be stored in a `$state` variable during `onMount` and reused for all links.

**Warning signs:** Admin reaches `/admin/setup` and sees "Access denied." with no token in URL.

### Pitfall 4: Recap card showing on initial connect (not just on chapter unlock)

**What goes wrong:** A player joins after Chapter 1 has already been unlocked. Their `STATE_SYNC` snapshot has `activeChapterIndex: 0`. The `$effect` fires because it changed from `null` → `0`, showing a recap card for a chapter that opened before they joined.

**Why it happens:** The `$effect` pattern watches for any change to `activeChapterIndex`, including the initial population from null.

**How to avoid:** On first `STATE_SYNC` after connecting, set `recapChapterIndex` to the current `activeChapterIndex` without showing the recap. Only show the recap when the index changes after the initial sync. Track `initialSyncDone = $state(false)`.

```svelte
$effect(() => {
  const idx = $gameState?.activeChapterIndex ?? null;
  if (!initialSyncDone) {
    // First sync — set baseline, don't show recap
    recapChapterIndex = idx;
    initialSyncDone = true;
    return;
  }
  if (idx !== null && idx !== recapChapterIndex) {
    recapChapterIndex = idx;
    showRecap = true;
    // ... timer
  }
});
```

### Pitfall 5: servedQuestionIndex not reset between chapters

**What goes wrong:** Server tracks `servedQuestionIndex` to avoid re-drawing the same trivia question (D-05). If this is not reset when a new chapter activates, the index bleeds across chapters.

**Why it happens:** `servedQuestionIndex` is a single field on `GameState`, not per-chapter.

**How to avoid:** Make `servedQuestionIndex` per-chapter, or reset it to `null` in the `UNLOCK_CHAPTER` handler when `activeChapterIndex` increments. Recommended: store it per-chapter as a field on `Chapter` type (`servedQuestionIndex: number | null`), initialized to `null` in setup, populated when the chapter activates.

---

## Code Examples

### Extending initState with Phase 2 fields

```typescript
// server/state.ts
export function initState(sessionCode: string): GameState {
  activeState = {
    sessionCode,
    phase: "lobby",
    players: [],
    groomPlayerId: null,
    chapters: [],
    activeChapterIndex: null,
    scores: {},
    powerUpCatalog: [],
  };
  return activeState;
}
```

### UNLOCK_CHAPTER handler

```typescript
// server/handlers.ts — new branch
if (msg.type === "UNLOCK_CHAPTER") {
  const state = getState();
  if (!state) return;

  const nextIndex = state.activeChapterIndex === null ? 0 : state.activeChapterIndex + 1;

  if (nextIndex >= state.chapters.length) {
    ws.send(JSON.stringify({ type: "ERROR", code: "UNKNOWN", message: "No more chapters." }));
    return;
  }

  setState((s) => {
    // Initialize scores for all current players on first unlock
    const scores: Record<string, number> = { ...s.scores };
    if (s.activeChapterIndex === null) {
      s.players.forEach((p) => { if (!(p.id in scores)) scores[p.id] = 0; });
    }

    return {
      ...s,
      phase: "active",
      activeChapterIndex: nextIndex,
      scores,
      // servedQuestionIndex reset happens here if stored per-chapter (see Pitfall 5)
    };
  });

  broadcastState(server);
  return;
}
```

### SAVE_SETUP handler

```typescript
// server/handlers.ts — new branch
if (msg.type === "SAVE_SETUP") {
  const state = getState();
  if (!state || state.phase !== "lobby") {
    ws.send(JSON.stringify({ type: "ERROR", code: "UNKNOWN", message: "Setup locked after game starts." }));
    return;
  }

  setState((s) => ({
    ...s,
    chapters: msg.chapters,
    powerUpCatalog: msg.powerUpCatalog,
  }));

  broadcastState(server);
  return;
}
```

### Admin dashboard "Unlock Chapter" button (Svelte 5)

```svelte
<!-- src/routes/admin/+page.svelte -->
<script lang="ts">
  import { gameState, sendMessage } from "$lib/socket.ts";

  let activeChapterIndex = $derived($gameState?.activeChapterIndex ?? null);
  let chapterCount = $derived($gameState?.chapters.length ?? 0);
  let canUnlock = $derived(
    chapterCount > 0 &&
    (activeChapterIndex === null || activeChapterIndex < chapterCount - 1)
  );

  function unlockNextChapter() {
    sendMessage({ type: "UNLOCK_CHAPTER" });
  }
</script>

{#if canUnlock}
  <button onclick={unlockNextChapter} class="...">
    {activeChapterIndex === null ? "Unlock Chapter 1" : `Unlock Chapter ${(activeChapterIndex ?? -1) + 2}`}
  </button>
{/if}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 reactive `$:` statements | Svelte 5 `$derived` and `$effect` runes | Svelte 5 release | `$derived` replaces `$:` for computed values; `$effect` replaces `$:` for side effects. Both are already used in Phase 1. |
| Svelte 4 `bind:this` + `onMount` timers | Svelte 5 `$effect` cleanup | Svelte 5 release | `$effect` returns a cleanup function; use it for `setTimeout`/`clearTimeout` in recap card timer. |

**Deprecated/outdated patterns in this project:**
- Svelte 4 `<script>` reactive declarations (`$:`) — not used in Phase 1 code; all new code should use `$derived`/`$effect`.
- `writable()` stores for local component state — Phase 1 uses `$state` rune for local state and `writable()` only for cross-component stores (`gameState`, `connectionStatus`). Continue this pattern.

---

## Open Questions

1. **Admin identity on the server side for UNLOCK_CHAPTER / SAVE_SETUP**
   - What we know: The `/api/admin/session` endpoint validates the token. The WS connection does not carry any identity (no token in the WS URL or headers in Phase 1). Any client that knows the message format could send `UNLOCK_CHAPTER`.
   - What's unclear: For the scope (one-time event, ≤10 known players), this is acceptable — obscurity is sufficient. But should the server enforce admin-only messages?
   - Recommendation: Minimal enforcement — server validates preconditions (phase, chapter index bounds) rather than client identity. This is consistent with Phase 1 patterns. If desired, admin token can be sent as part of `SAVE_SETUP`/`UNLOCK_CHAPTER` message payload for server-side validation.

2. **scores initialization timing**
   - What we know: D-07 says scores initialized to 0 for all players. But players can join after game start (late joiners).
   - What's unclear: Should scores be initialized at `UNLOCK_CHAPTER` (first chapter unlock, known player set) or lazily (when a score is first written in Phase 3)?
   - Recommendation: Initialize to 0 for all current players on first `UNLOCK_CHAPTER`. For late joiners in Phase 3, initialize lazily in the score-update handler. Document this decision in `server/state.ts` comments.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is pure code extension of existing monorepo stack, same Bun + SvelteKit environment confirmed working in Phase 1).

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `server/state.ts`, `server/handlers.ts`, `server/index.ts`, `src/lib/socket.ts`, `src/lib/types.ts`, `src/routes/admin/+page.svelte`, `src/app.css` — all patterns confirmed from Phase 1 implementation
- `src/routes/+layout.ts` — SSR disabled globally; confirmed
- `.planning/REQUIREMENTS.md` — all ADMN and GAME requirements read directly

### Secondary (MEDIUM confidence)
- Svelte 5 runes reactivity model (`$state`, `$derived`, `$effect`) — consistent with patterns already used in Phase 1 codebase
- Svelte 5 array mutation reactivity behavior (requires root reassignment) — widely documented in Svelte 5 migration guides

### Tertiary (LOW confidence)
- None — all research findings based on verified codebase inspection and confirmed Phase 1 patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — patterns lifted directly from working Phase 1 code
- Pitfalls: HIGH — derived from direct codebase inspection (Pitfall 2 from Svelte 5 known behavior; Pitfalls 3–5 from Phase 1 architectural analysis)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack — no fast-moving dependencies)
