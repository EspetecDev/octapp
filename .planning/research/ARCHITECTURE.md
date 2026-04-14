# Architecture Research

**Domain:** JSON config import/export in a SvelteKit 5 + Bun WebSocket app
**Researched:** 2026-04-13
**Confidence:** HIGH — analysis is fully grounded in the existing codebase; no external library decisions needed

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│  Browser (Admin)  /admin/setup page                               │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  Setup Form State ($state runes)                          │    │
│  │  chapters: Chapter[]  powerUpCatalog: PowerUp[]           │    │
│  │  startingTokens: number                                   │    │
│  └───────────────┬───────────────────────────────────────────┘    │
│                  │                                                 │
│        ┌─────────┴──────────┐                                     │
│        │                    │                                     │
│  ┌─────▼──────┐    ┌────────▼────────┐                            │
│  │  EXPORT    │    │  IMPORT         │                            │
│  │  (button)  │    │  (file input)   │                            │
│  │            │    │                 │                            │
│  │  serialize │    │  parse JSON     │                            │
│  │  form →    │    │  → validate     │                            │
│  │  download  │    │  → populate     │                            │
│  │  .json     │    │    form state   │                            │
│  └────────────┘    └────────┬────────┘                            │
│   (no server)               │  admin reviews, clicks Save         │
│                             │  sendMessage(SAVE_SETUP) (reused)   │
└─────────────────────────────┼───────────────────────────────────── ┘
                              │ WebSocket /ws
┌─────────────────────────────▼─────────────────────────────────────┐
│  Bun WebSocket Server  server/handlers.ts                          │
│                                                                    │
│  handleMessage → SAVE_SETUP handler (unchanged)                    │
│    setState({ chapters, powerUpCatalog, startingTokens })          │
│    broadcastState(server) → STATE_SYNC to all clients              │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Export button | Serialize current form state to JSON and trigger browser download | Pure browser — `URL.createObjectURL` on a `Blob`; no server involvement |
| Import file input | Accept a `.json` file, parse and validate it, populate form state | Pure browser — `file.text()`; validates against known shape before populating |
| `sendMessage(SAVE_SETUP)` | Push imported config to server after admin confirms | Reuses existing wire message; no new message type needed |
| `handleMessage` in `handlers.ts` | Merge incoming setup into `gameState` and broadcast | Unchanged — existing SAVE_SETUP handler already accepts `chapters + powerUpCatalog + startingTokens` |

---

## Export: Browser-Only (Recommended)

**Verdict:** Export must be client-side only. No server round-trip is needed or appropriate.

**Why:** The admin setup page holds full live form state in Svelte 5 `$state` variables (`chapters`, `powerUpCatalog`, `startingTokens`). These are the canonical source for what the admin intends to save. They are populated from `$gameState` on first sync (see `restoredFromState` guard in the existing page), then diverge as the admin edits. A server export would serialize the last-saved server state, missing any unsaved edits in the form.

**Export shape:**

```typescript
type GameConfig = {
  version: 1;                  // forward-compatibility sentinel
  chapters: Chapter[];         // stripped of runtime fields (see below)
  powerUpCatalog: PowerUp[];
  startingTokens: number;
};
```

**Runtime fields to strip on export:** `Chapter` includes three server-only runtime fields — `servedQuestionIndex`, `minigameDone`, `scavengerDone`. These are meaningless in a saved config file; they will be reset by `UNLOCK_CHAPTER` anyway. Strip them before serializing so the exported JSON is clean and portable.

**Data flow — Export:**

```
Admin clicks "Export Config"
  → serializeConfig(chapters, powerUpCatalog, startingTokens)
      strips runtime fields from each Chapter
      wraps in { version: 1, chapters, powerUpCatalog, startingTokens }
  → JSON.stringify(payload, null, 2)
  → new Blob([json], { type: "application/json" })
  → URL.createObjectURL(blob)
  → programmatic <a download="game-config.json"> click
  → browser saves file
  → URL.revokeObjectURL(url)          ← always clean up to avoid memory leaks
```

No server call. No WebSocket message. Entirely synchronous after the button click.

---

## Import: Client-Side Parse + Reuse SAVE_SETUP (Recommended)

**Verdict:** Import parses the file in the browser, populates form state, then the admin's existing "Save Setup" button sends the data to the server via the existing `SAVE_SETUP` message. A new `LOAD_CONFIG` WebSocket message is not needed and would add complexity with no benefit.

**Why not a new LOAD_CONFIG message?**
- The server's `SAVE_SETUP` handler already does exactly what's needed: validates phase (lobby only), merges chapters/powerUpCatalog/startingTokens into `gameState`, broadcasts.
- Adding `LOAD_CONFIG` would duplicate handler logic, adding a new union member to `IncomingMessage` in `handlers.ts` and `ClientMessage` in `types.ts` — for no behavioral gain.
- Keeping one "write setup" message preserves the invariant that the admin reviews the loaded config in the form before it goes live on the server.

**Data flow — Import:**

```
Admin taps "Import Config" → <input type="file" accept=".json">
  → file.text()
  → JSON.parse(rawText)
  → validateConfig(parsed)
      checks: version === 1
      checks: chapters is array, powerUpCatalog is array, startingTokens is number
      checks: each Chapter has required string fields
      returns { ok: true, config } | { ok: false, error: string }
  → if valid:
      chapters = config.chapters.map(ch => ({
        ...ch,
        servedQuestionIndex: null,     ← always reset
        minigameDone: false,           ← always reset
        scavengerDone: false,          ← always reset
      }));
      powerUpCatalog = config.powerUpCatalog;
      startingTokens = config.startingTokens;
      restoredFromState = true;        ← CRITICAL: prevents $gameState effect from overwriting
      show import success flash
  → admin reviews populated form, clicks "Save Setup"
      → sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog, startingTokens })
      → server merges, broadcasts STATE_SYNC
  → if invalid:
      show inline error: "Invalid config file"
```

**Two-step review model:** The loaded config populates the form but does not auto-send to the server. The admin can inspect and edit before saving. This matches how SAVE_SETUP already works (fill form, press Save). It also means accidental wrong-file imports are recoverable — the admin can just re-import or edit before committing.

---

## Recommended Project Structure Changes

```
src/
├── lib/
│   ├── configSerializer.ts   ← NEW: serializeConfig(), validateConfig(), GameConfig type
│   ├── types.ts              ← MODIFIED: re-export GameConfig from configSerializer
│   └── socket.ts             ← unchanged
└── routes/
    └── admin/
        └── setup/
            └── +page.svelte  ← MODIFIED: export button, import file input, flash states
server/
├── handlers.ts               ← unchanged
└── state.ts                  ← unchanged
```

**Why a separate `configSerializer.ts`?**

Serialization and validation are pure-function territory (no DOM, no WebSocket). Isolating them makes independent unit testing possible and keeps `+page.svelte` focused on UI concerns. The `GameConfig` type lives here as the single definition.

---

## Architectural Patterns

### Pattern 1: Client-Side File Download

**What:** Serialize data to a `Blob`, generate an object URL, trigger a synthetic anchor click, revoke the URL.
**When to use:** Any time the user needs to download a file generated from in-browser state with no server involvement required.
**Trade-offs:** Works on all modern browsers including iOS Safari. Object URL must be revoked to avoid memory leaks. Zero fetch, zero backend route.

```typescript
function downloadJson(payload: unknown, filename: string): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Pattern 2: File Input + file.text()

**What:** An `<input type="file" accept=".json">` that reads the selected file as text via `file.text()` (Promise-based, supported in all modern browsers including iOS Safari 14.1+).
**When to use:** Any time the user needs to load a local file into browser state without a server upload.
**Trade-offs:** `accept=".json"` filters the picker but is advisory — always validate the parsed content regardless.

```typescript
async function handleFileInput(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const result = validateConfig(JSON.parse(text));
  // populate form or show error
}
```

### Pattern 3: Reuse SAVE_SETUP Rather Than Add a New Message

**What:** After import populates form state, the existing `saveSetup()` function (which calls `sendMessage({ type: "SAVE_SETUP", ... })`) handles the server write. No new message type or handler.
**When to use:** Any time new client functionality maps cleanly onto an existing server message — no new handler needed.
**Trade-offs:** Simpler server (no new handler, no new union member). The two-step model (import → review → save) is safer than auto-sending on import.

---

## Data Flow

### Export Flow

```
Admin clicks "Export Config"
    ↓
serializeConfig(chapters, powerUpCatalog, startingTokens)
    ↓ strips runtime fields (servedQuestionIndex, minigameDone, scavengerDone)
    ↓ adds { version: 1 }
downloadJson(config, "game-config.json")
    ↓ Blob → object URL → synthetic <a> click → revoke
Browser saves file to disk
    ↓
[End — no server involvement]
```

### Import Flow

```
Admin selects .json file via <input type="file">
    ↓
file.text() → JSON.parse()
    ↓
validateConfig(parsed)
    ├── invalid → show error flash, abort
    └── valid →
         populate chapters, powerUpCatalog, startingTokens ($state runes)
         reset runtime fields on each Chapter
         set restoredFromState = true             ← prevents $effect overwrite
         show import success flash
              ↓
Admin reviews form, clicks "Save Setup"
    ↓
sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog, startingTokens })
    ↓ WebSocket
server handleMessage → SAVE_SETUP handler (unchanged)
    ↓
setState({ chapters, powerUpCatalog, startingTokens }) → broadcastState
    ↓
STATE_SYNC to all clients
```

---

## Integration Points

### With SAVE_SETUP (existing — unchanged)

| Aspect | Detail |
|--------|--------|
| What SAVE_SETUP expects | `{ type: "SAVE_SETUP", chapters: Chapter[], powerUpCatalog: PowerUp[], startingTokens: number }` |
| What import must produce | Same shape. Runtime fields are stripped on the client before populating form state; they are re-initialized by `UNLOCK_CHAPTER` on the server and never appear in SAVE_SETUP payloads. |
| Phase guard already in place | Server rejects SAVE_SETUP when `state.phase !== "lobby"`. Import inherits this protection for free — no guard logic needed on the client. |

### With `restoredFromState` guard (existing — critical interaction)

The setup page has a `restoredFromState` flag (line 19, `+page.svelte`) that prevents `$gameState` from overwriting form state after first sync. The `$effect` watching `$gameState` only populates form fields when `!restoredFromState && gs.chapters.length > 0`.

After import, this flag **must** be set to `true`. If it is not:
- The admin saves the imported config (SAVE_SETUP fires)
- Server merges and broadcasts STATE_SYNC
- The incoming STATE_SYNC triggers the `$effect`
- Because `restoredFromState` is still `false`, the effect overwrites the just-imported form values with what was previously on the server

This is a silent correctness bug. Setting `restoredFromState = true` immediately after populating form state from an import prevents it.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `configSerializer.ts` ↔ `+page.svelte` | Direct import (pure functions) | No reactive stores needed; serializer is stateless |
| `+page.svelte` ↔ server | `sendMessage(SAVE_SETUP)` via `socket.ts` | Unchanged from current save flow |
| `types.ts` ↔ `configSerializer.ts` | `GameConfig` type defined in `configSerializer.ts`, re-exported via `types.ts` | One definition; consistent with existing pattern of `types.ts` as the shared type surface |

---

## New vs Modified Components

| Component | Status | Change |
|-----------|--------|--------|
| `src/lib/configSerializer.ts` | New | `serializeConfig()`, `validateConfig()`, `GameConfig` type |
| `src/lib/types.ts` | Modified | Re-export `GameConfig` from `configSerializer.ts` |
| `src/routes/admin/setup/+page.svelte` | Modified | Export button + handler, import file input + async handler, import flash state, `restoredFromState` interaction |
| `server/handlers.ts` | Unchanged | SAVE_SETUP handler covers import without modification |
| `server/state.ts` | Unchanged | `GameState` shape unchanged |
| `src/lib/types.ts` → `ClientMessage` | Unchanged | No new WebSocket message type needed |

---

## Build Order

1. **`src/lib/configSerializer.ts` (new)** — Define `GameConfig` type, implement `serializeConfig()` and `validateConfig()`. These are pure functions with no UI dependency; can be written and unit-tested in isolation before touching any UI.
2. **`src/lib/types.ts` update** — Re-export `GameConfig`. One-line change.
3. **Export button in `+page.svelte`** — Wire up `serializeConfig` and `downloadJson`. Additive change only; does not touch any existing logic or state.
4. **Import file input in `+page.svelte`** — Add `<input type="file">`, async parse handler, form state population, `restoredFromState` flag set, import flash state. This is the only step that requires care around the `restoredFromState` interaction.
5. **End-to-end test** — Export a live config, reload the page, import the file, verify form populates correctly, save, verify server state matches via a second browser tab.

Steps 1–2 are independent of the app running. Step 3 can be verified before step 4 is written.

---

## Anti-Patterns

### Anti-Pattern 1: Adding a LOAD_CONFIG WebSocket Message

**What people do:** Create a new `LOAD_CONFIG` server message that directly loads a JSON payload into `gameState`, bypassing the form review step.
**Why it's wrong:** Duplicates the SAVE_SETUP handler. Removes the admin review step (silent overwrites of a running game become possible). Adds a new union member to `IncomingMessage`, `ClientMessage`, and `ServerMessage` — all for zero behavioral gain.
**Do this instead:** Parse and validate in the browser, populate form state, send existing SAVE_SETUP.

### Anti-Pattern 2: Round-Tripping Export Through the Server

**What people do:** Add a server route (`GET /api/admin/config`) that serializes `gameState` and returns it as JSON.
**Why it's wrong:** The form state is the authoritative export source — unsaved edits live in the browser, not in `gameState`. Exporting from the server would silently export the last saved state, not the current form. Also adds a server route, an auth check, and a fetch call for no benefit.
**Do this instead:** Serialize directly from `$state` variables in the browser.

### Anti-Pattern 3: Auto-Sending to Server on Import Without Review

**What people do:** After parsing the file, immediately call `sendMessage(SAVE_SETUP)` without letting the admin review the populated form.
**Why it's wrong:** Overwrites server state without confirmation. Imports the wrong file by accident — there is no undo; the game state is already replaced on the server.
**Do this instead:** Populate form state, show the result, let the admin click "Save Setup" to commit.

### Anti-Pattern 4: Forgetting `restoredFromState = true` After Import

**What people do:** Populate `chapters`, `powerUpCatalog`, `startingTokens` from the imported file but omit setting `restoredFromState = true`.
**Why it's wrong:** The next `STATE_SYNC` broadcast — which arrives within milliseconds of the admin saving — triggers the `$effect` that restores form state from `$gameState`. This silently overwrites the imported values with what was previously on the server.
**Do this instead:** Always set `restoredFromState = true` immediately after populating form state from an import.

### Anti-Pattern 5: Sending Runtime Fields in the Exported JSON

**What people do:** Serialize `chapters` as-is, including `servedQuestionIndex`, `minigameDone`, `scavengerDone`.
**Why it's wrong:** These fields are meaningless in a saved config file. They pollute the export, and if `minigameDone: true` or `scavengerDone: true` is imported and not reset, chapters could be treated as already-complete when the game starts.
**Do this instead:** Always strip runtime fields in `serializeConfig()` before writing the JSON, and always reset them in the import handler before populating form state.

---

## Scaling Considerations

This is a one-time event app for 5-10 players. Scaling is not a concern for this feature. Import/export is a pure client-side file operation for export and a single WebSocket message for import — both have no meaningful overhead at any scale.

---

## Sources

- `server/handlers.ts` lines 135–153 — SAVE_SETUP handler; confirms exact expected message shape and lobby-only phase guard
- `server/state.ts` — `Chapter` and `GameState` type definitions; runtime-only fields (`servedQuestionIndex`, `minigameDone`, `scavengerDone`) identified
- `src/routes/admin/setup/+page.svelte` lines 18–30 — `restoredFromState` guard; the critical existing state interaction for import
- `src/lib/types.ts` — `ClientMessage` union; confirms `SAVE_SETUP` accepts `chapters + powerUpCatalog + startingTokens`
- `src/lib/socket.ts` — `sendMessage` helper; how the setup page communicates with the server

---

*Architecture research for: JSON import/export (octapp v1.2 milestone)*
*Researched: 2026-04-13*
