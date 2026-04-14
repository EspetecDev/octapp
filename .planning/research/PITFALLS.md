# Domain Pitfalls: JSON Import/Export on SvelteKit 5 + Bun WebSocket

**Domain:** Adding JSON config import/export to an existing SvelteKit 5 admin UI backed by a Bun WebSocket server with in-memory game state
**Researched:** 2026-04-13
**Confidence:** HIGH for iOS/Android file picker behaviour (confirmed via WebKit bug tracker and MDN); HIGH for state overwrite/sync issues (from direct code inspection of handlers.ts and state.ts); MEDIUM for Svelte 5 runes edge cases (from official Svelte docs + community reports)

---

## Critical Pitfalls

Mistakes that cause silent data loss, corrupt game state, or a broken admin UI on mobile.

---

### Pitfall 1: iOS Safari Ignores `<a download>` on Blob URLs — Export Silently Opens Instead of Downloading

**What goes wrong:**
The standard export pattern — `URL.createObjectURL(blob)`, create a hidden `<a download="game.json">`, programmatically `.click()` it — works on desktop Chrome and Firefox. On iOS Safari (all versions before Safari 26), the browser silently navigates to the blob URL and displays the JSON as raw text instead of triggering a file download. The admin sees a wall of JSON in the browser, the page navigates away, and there is no file saved.

**Why it happens:**
iOS Safari has never fully supported the `download` attribute on anchor elements for blob URLs. WebKit bug #216918 (open since 2021) explicitly tracks this: "WKWebView does not support `blob:` URLs as `href` value in anchors with `download` attribute." The restriction applies to Safari on iOS regardless of iOS version (confirmed still present in 2025).

**How to avoid:**
Do not rely on the standard `<a download>` + blob pattern alone. Use one of these approaches:

Option A — Open in a new tab (simplest, works on all mobile browsers):
```typescript
const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
window.open(url, "_blank");
// User manually saves from the browser's share sheet
URL.revokeObjectURL(url);
```

Option B — Detect iOS and show instructions ("Tap the share icon > Save to Files"):
```typescript
const isIOS = /iP(hone|ad)/.test(navigator.userAgent);
if (isIOS) {
  // show modal with instructions to use share sheet
} else {
  // standard anchor click download
}
```

Option C — Use a server-side download endpoint (`/api/admin/export-config?token=...`) that responds with `Content-Disposition: attachment; filename="game.json"`. HTTP download headers work on iOS Safari where blob URLs do not.

For this project, Option A (open in new tab with a "long-press to save" instruction) or Option C (server endpoint) are both viable. Option C requires implementing a GET endpoint on the server, but reliably works on all platforms.

**Warning signs:**
- Testing export only on desktop Chrome during development and not on an iPhone
- No "file saved" feedback — the export appears to work but nothing lands in Files on iOS

**Phase to address:** Export implementation phase. Must test on a real iPhone before marking the phase complete.

---

### Pitfall 2: Importing a JSON File During an Active Game Overwrites Live State

**What goes wrong:**
The admin imports a config JSON while a game is in progress (`phase === "active"`). The import sends a `SAVE_SETUP` WebSocket message. The server handler already guards this: if `state.phase !== "lobby"`, it returns an error. However, if the frontend does not check phase before calling import, or if the UI does not show a visible warning, the admin may click Import expecting it to work, see nothing happen (silent error), and be confused.

The deeper risk: if the guard were ever relaxed (e.g., "allow re-import to fix a typo mid-game"), replacing `state.chapters` while `activeChapterIndex` is set would cause `state.chapters[activeChapterIndex]` to point to a chapter from the new config that the groom is not playing. Scores, `minigameDone`, `scavengerDone`, and `servedQuestionIndex` — all runtime state — would be silently reset or misaligned with what players see on screen.

**Why it happens:**
The export/import UI is on `/admin/setup`, which is the pre-event setup page. Admins visiting that page mid-game to look at config may accidentally trigger an import. The page gives no visual indication of whether the game is currently active.

**How to avoid:**
- On the Import button: read `$gameState.phase` before opening the file picker. If `phase === "active"`, show a confirmation modal: "A game is in progress. Importing will reset all setup. Players will not be affected until the next game. Continue?" Do not silently block — the admin needs to know.
- Never send a `SAVE_SETUP` message if `phase === "active"` without explicit confirmation.
- Keep the server-side guard (`phase !== "lobby"` → reject) as a backstop regardless of UI checks.
- After a confirmed import during active phase, do not call `SAVE_SETUP` at all — queue the new config to take effect on the next `RESET_GAME` instead.

**Warning signs:**
- Import button visible and enabled on `/admin/setup` with no phase awareness
- No confirmation step before replacing setup

**Phase to address:** Import implementation phase. The phase-awareness check must be part of the import flow, not an afterthought.

---

### Pitfall 3: No Runtime Schema Validation — Malformed JSON Corrupts Server State Silently

**What goes wrong:**
The admin imports a JSON file that was manually edited, exported from an older version of the app, or just truncated/corrupted. `JSON.parse()` succeeds (the file is valid JSON), but fields are missing, wrong types, or have unexpected shapes. The `SAVE_SETUP` message is sent to the server. The server accepts `msg.chapters` as-is with no runtime validation — it does a direct spread into `setState`. From that point, `state.chapters` contains malformed data. The next `UNLOCK_CHAPTER` accesses `chapters[nextIndex].triviaPool`, which may be `undefined`, causing a runtime exception in the handler.

Looking at `handlers.ts` line 145–153: the `SAVE_SETUP` handler does:
```typescript
setState((s) => ({
  ...s,
  chapters: msg.chapters,
  powerUpCatalog: msg.powerUpCatalog,
  startingTokens: msg.startingTokens ?? 0,
}));
```

There is zero validation of `msg.chapters` shape. A chapter missing `triviaPool` will crash `UNLOCK_CHAPTER` at `ch.triviaPool.length === 0`.

**Why it happens:**
TypeScript's type system only runs at compile time. The WebSocket message is cast as `IncomingMessage` at line 43 of `handlers.ts` using `as IncomingMessage` — this cast tells TypeScript to trust the shape but does nothing at runtime. Any JSON that parses without error passes silently.

**How to avoid:**
Add a lightweight runtime validation step on the frontend before sending `SAVE_SETUP`:

```typescript
function validateImportedConfig(raw: unknown): { chapters: Chapter[]; powerUpCatalog: PowerUp[]; startingTokens: number } {
  if (!raw || typeof raw !== "object") throw new Error("Invalid config: not an object");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.chapters)) throw new Error("Invalid config: chapters must be an array");
  if (r.chapters.length === 0) throw new Error("Invalid config: at least one chapter required");
  for (const ch of r.chapters as unknown[]) {
    if (typeof (ch as Chapter).name !== "string") throw new Error("Invalid chapter: missing name");
    if (!["trivia", "memory"].includes((ch as Chapter).minigameType)) throw new Error("Invalid chapter: bad minigameType");
    if (!Array.isArray((ch as Chapter).triviaPool)) throw new Error("Invalid chapter: triviaPool must be array");
    if (typeof (ch as Chapter).scavengerClue !== "string") throw new Error("Invalid chapter: missing scavengerClue");
    if (typeof (ch as Chapter).reward !== "string") throw new Error("Invalid chapter: missing reward");
    // validate each TriviaQuestion in triviaPool...
  }
  if (!Array.isArray(r.powerUpCatalog)) throw new Error("Invalid config: powerUpCatalog must be an array");
  if (typeof r.startingTokens !== "number") throw new Error("Invalid config: startingTokens must be a number");
  return raw as { chapters: Chapter[]; powerUpCatalog: PowerUp[]; startingTokens: number };
}
```

Call this in the FileReader `onload` handler. Show the validation error message to the admin instead of silently sending bad data. Do NOT add Zod for this — it is not worth the dependency for a handful of field checks.

Additionally, the server-side `SAVE_SETUP` handler should do a basic sanity check (at minimum: `Array.isArray(msg.chapters)` and `msg.chapters.length > 0`) before accepting the payload.

**Warning signs:**
- Import works silently with no validation feedback
- Trying to unlock a chapter after an import causes a server-side crash or 500

**Phase to address:** Import implementation phase, before the `SAVE_SETUP` message is sent.

---

### Pitfall 4: Runtime State Fields Included in Export Break Re-Import

**What goes wrong:**
The admin exports the current game config. The export naively serializes the entire `gameState.chapters` array, which includes runtime-only fields: `servedQuestionIndex`, `minigameDone`, and `scavengerDone`. When this file is imported into a fresh game, these runtime fields are already set — `minigameDone: true` and `scavengerDone: true` on chapters that were played, `servedQuestionIndex: 2` pointing to a specific trivia question. The first chapter unlocked shows the groom the trivia question but the server thinks the minigame is already done and skips it. Reward reveals may fire immediately.

Looking at `types.ts` lines 19–27: `Chapter` includes `servedQuestionIndex: number | null`, `minigameDone: boolean`, and `scavengerDone: boolean` as required fields. These are runtime progression markers, not config.

**Why it happens:**
The easiest export implementation serializes `$gameState.chapters` directly. Developers assume "export the state = export the config", not realising that `Chapter` is a hybrid of config and runtime state.

**How to avoid:**
When building the export payload, strip all runtime-only fields from each chapter:

```typescript
function buildExportPayload(state: GameState) {
  return {
    chapters: state.chapters.map(({ name, minigameType, triviaPool, scavengerClue, scavengerHint, reward }) => ({
      name, minigameType, triviaPool, scavengerClue, scavengerHint, reward,
      // explicitly omit: servedQuestionIndex, minigameDone, scavengerDone
    })),
    powerUpCatalog: state.powerUpCatalog,
    startingTokens: state.startingTokens,
  };
}
```

Conversely, when importing, always normalize the imported data by setting runtime fields to their safe defaults:

```typescript
const normalizedChapters = imported.chapters.map((ch) => ({
  ...ch,
  servedQuestionIndex: null,
  minigameDone: false,
  scavengerDone: false,
}));
```

This normalization should happen both in the frontend before sending `SAVE_SETUP` and conceptually should mirror what `RESET_GAME` already does.

**Warning signs:**
- Export file contains fields named `minigameDone`, `scavengerDone`, `servedQuestionIndex` with non-default values
- First chapter after import is skipped or immediately marked complete

**Phase to address:** Export implementation phase. The payload builder is the right place to establish the chapter data contract.

---

### Pitfall 5: Svelte 5 — Assigning Imported JSON Directly to `$state` Without `structuredClone` Causes Proxy Leakage

**What goes wrong:**
The FileReader delivers a parsed object. The developer does:
```typescript
chapters = JSON.parse(event.target.result);
```
This works initially, but the object is a plain JavaScript object, not a Svelte-aware proxy. When the admin then edits chapters in the form (e.g., types in a chapter name), Svelte 5's rune-based reactivity may not track mutations on nested arrays correctly because the references are not proxied through `$state`'s deep reactive proxy. Changes appear to save locally but `$derived(isValid)` may not recompute, or the Save button stays disabled.

The inverse is also true: `$state.snapshot` should be used when passing reactive state out of Svelte (to `JSON.stringify`), not raw `$state` which returns a Proxy. If `JSON.stringify` is called on a Proxy, it works, but subtle proxy-trapping behaviour can cause unexpected serialization of computed getters.

**Why it happens:**
The existing setup form already handles this correctly for server state restoration (line 25 of `setup/+page.svelte`):
```typescript
chapters = structuredClone(gs.chapters);
```
But a new import handler written by someone unfamiliar with this pattern might skip the `structuredClone`.

**How to avoid:**
Always structuredClone imported data before assigning to `$state`:
```typescript
chapters = structuredClone(parsedConfig.chapters);
powerUpCatalog = structuredClone(parsedConfig.powerUpCatalog);
startingTokens = parsedConfig.startingTokens;
```
For export: `JSON.stringify` on a `$state` variable works fine in Svelte 5 (proxies are transparent to JSON serialization), but using `$state.snapshot(chapters)` is the idiomatic and safer approach if there is any doubt.

**Warning signs:**
- Form fields show imported data but isValid stays false
- Editing an imported chapter does not enable the Save button
- Save saves stale values (the original imported values, not the edited ones)

**Phase to address:** Import implementation phase. The structuredClone call should be part of the import handler template.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Export all of `GameState` (not just setup fields) | No extraction logic needed | Imports include session code, scores, player IDs — importing creates confusing state | Never — always extract setup fields only |
| Skip runtime field normalization on import | Fewer lines of code | Imported "used" configs break the first chapter unlock | Never — normalize always |
| Skip client-side schema validation, rely only on server guard | Less code | Silent failures: server rejects the import but admin sees no error message | Acceptable only if the server error is surfaced to the admin via the ERROR WebSocket message |
| Use `<input type="file" accept=".json,application/json">` | Documents intent | On iOS Safari, `accept` is partially ignored — the file picker may still show all file types | Acceptable — use both MIME and extension, but do not depend on filtering working |
| Programmatic `<a>` click for export | Works on desktop | Silently fails on iOS Safari — file opens inline instead of downloading | Never for production — must handle iOS |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FileReader API | Forgetting FileReader is async and trying to use the result synchronously | Use `reader.onload = (e) => { ... }` callback or wrap in a Promise; the result is never available synchronously |
| FileReader API | Not handling `reader.onerror` | Always add an `onerror` handler — on Android, selecting a file from a cloud provider (Google Drive) can silently fail |
| `URL.createObjectURL` | Leaking blob URLs — never calling `URL.revokeObjectURL` | Call `revokeObjectURL` in a `setTimeout(() => URL.revokeObjectURL(url), 100)` after triggering the download |
| iOS Safari export | Using `<a download>` with blob URL | Use `window.open(url, "_blank")` or a server-side download endpoint with `Content-Disposition` header |
| Android file picker | `accept="application/json"` with complex MIME strings | Use `accept=".json"` (extension) — Android file pickers honour extensions more reliably than MIME types |
| WebSocket SAVE_SETUP | Sending the message before the WebSocket is `OPEN` | Check `ws.readyState === WebSocket.OPEN` before calling `sendMessage`; the setup page already has a WebSocket connection but check for the edge case where import happens before first STATE_SYNC |

---

## Performance Traps

Performance is not a concern for this project at its scale (1 admin, 5-10 players, one game session). The only relevant trap is:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parsing a very large JSON file synchronously in the FileReader onload callback | Brief UI freeze on low-end Android phones | Keep config small (5 chapters × N questions); the schema naturally limits size | Not a real concern for this use case — a fully populated 5-chapter game is <50KB |
| Deep-proxying a large imported array via $state | Minor rendering lag when assigning to chapters | Use structuredClone before assignment, which creates a plain object that Svelte wraps cleanly | Only an issue if triviaPool had hundreds of questions — not the case here |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting the imported JSON file's `sessionCode` field | An attacker crafts a config with a specific sessionCode to match an ongoing session | Always ignore `sessionCode` from imported files — the server never accepts it via `SAVE_SETUP` anyway, but the frontend should not show it or pass it |
| No file size check before parsing | A 50MB JSON file freezes the browser | Add `if (file.size > 500_000) { show error; return; }` before calling FileReader |
| Trusting `file.type === "application/json"` as a security check | iOS Safari may report incorrect MIME types for files picked from Files app | Always validate the parsed content, never rely on `file.type` alone |
| Serving the export via a server endpoint without auth | Anyone who knows the URL can download the full game config | Any server export endpoint must require the `ADMIN_TOKEN` via query param, same as existing admin API pattern |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback after successful import | Admin not sure if it worked — may import twice | Show a success state (e.g., form fills with imported data visually + a brief "Loaded!" flash matching the existing saveFlash pattern) |
| Export button that silently opens JSON in a new tab on iOS with no explanation | Admin confused, thinks export is broken | Add "On iPhone/iPad: long-press the JSON > Save to Files" instruction text when the export triggers |
| Import button always enabled even during active game | Admin accidentally imports mid-game, gets a silent error | Disable or add a warning indicator on the Import button when `$gameState.phase === "active"` |
| No indication of what config is currently loaded | Admin not sure if they're editing fresh config or a previously saved config | Show chapter count and a timestamp or name derived from the file in the import confirmation |
| FileReader errors (e.g., selecting a folder by mistake on Android) | Blank import, no error shown | Catch all FileReader errors and display a human-readable message ("Could not read file — try a different file") |

---

## "Looks Done But Isn't" Checklist

- [ ] **Export on iOS:** Tested on a real iPhone/iPad, not just desktop Chrome — the file actually saves, not just opens inline
- [ ] **Import validation:** Importing a JSON file with a missing required field (`scavengerClue`, `reward`, `triviaPool`) shows an error, not a silent save
- [ ] **Runtime field normalization:** An exported config from a completed game round-trips cleanly — importing it and unlocking Chapter 1 starts the chapter fresh, not skipping to complete
- [ ] **Phase guard:** Attempting to import while `phase === "active"` shows a confirmation or is blocked — it does not silently fail
- [ ] **Blob URL leak:** `URL.revokeObjectURL` is called after every export — confirmed in DevTools Memory tab or by code review
- [ ] **WebSocket connection timing:** Import can be triggered before the first STATE_SYNC — tested by importing immediately on page load before the server state is received
- [ ] **Large file rejection:** A 1MB JSON file triggers the file size guard, not a browser freeze
- [ ] **structuredClone:** After importing, editing a chapter name and hitting Save actually sends the edited value — not the original imported value

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bad import corrupts server state (missing fields crash UNLOCK_CHAPTER) | LOW | Call `RESET_GAME` to return to lobby, then re-import a valid config or re-enter manually; server state is fully replaced |
| Export opens as inline text on iOS instead of downloading | LOW | Copy the text from the browser, paste into a Notes/Files app manually; or use a desktop browser for the export step |
| Import during active game is silently rejected | LOW | The server guard prevents state corruption; admin needs to `RESET_GAME` first, then import, then `UNLOCK_CHAPTER` to restart |
| Imported config has wrong trivia pool structure causing chapter unlock failure | MEDIUM | `RESET_GAME`, fix the JSON file on a desktop, re-import |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| iOS Safari `<a download>` not working (Pitfall 1) | Export implementation | Test export on real iPhone; confirm file lands in Files app |
| Import during active game (Pitfall 2) | Import implementation | Set phase to active, attempt import — confirm confirmation dialog or block |
| No runtime schema validation (Pitfall 3) | Import implementation | Import a JSON with one field removed — confirm error message appears |
| Runtime fields in export break re-import (Pitfall 4) | Export implementation | Export after playing a round, re-import, unlock Chapter 1 — confirm it starts fresh |
| Svelte 5 structuredClone missing (Pitfall 5) | Import implementation | Import a config, edit a chapter name, hit Save — confirm edited value is saved |

---

## Sources

- iOS Safari `<a download>` + blob URL bug: [WebKit bug #216918](https://bugs.webkit.org/show_bug.cgi?id=216918)
- iOS Safari `download` attribute history: [WebKit bug #167341](https://bugs.webkit.org/show_bug.cgi?id=167341)
- FileSaver.js iOS problems: [eligrey/FileSaver.js issue #12](https://github.com/eligrey/FileSaver.js/issues/12)
- iOS Safari file download workarounds: [Simon Neutert — Force iOS Safari to download](https://www.simon-neutert.de/2025/js-safari-media-download/)
- Android Chrome `accept` attribute limitations: [MDN — input type=file](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file)
- Android multiple MIME types in accept: [apache/cordova-android issue #874](https://github.com/apache/cordova-android/issues/874)
- Svelte 5 `$state` and structuredClone: [Svelte docs — $state](https://svelte.dev/docs/svelte/$state)
- Runtime validation vs TypeScript type system: [LogRocket — Schema validation with Zod](https://blog.logrocket.com/schema-validation-typescript-zod/)
- Blob URL memory leak: [LogRocket — Programmatically downloading files](https://blog.logrocket.com/programmatically-downloading-files-browser/)

---
*Pitfalls research for: JSON import/export, SvelteKit 5 admin UI, Bun WebSocket backend*
*Researched: 2026-04-13*
