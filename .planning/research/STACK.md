# Stack Research: v1.2 JSON Import/Export

**Project:** octapp — Bachelor Party Game
**Milestone:** v1.2 — Load Preconfigured Games
**Researched:** 2026-04-13
**Confidence:** HIGH
**Scope:** New capabilities only — existing stack (SvelteKit 5, Bun WS, Tailwind v4, Railway) is validated and not re-examined here.

---

## Verdict: No New Libraries Required

JSON import/export for a browser-based admin page is fully covered by native browser APIs. Zero new `npm install` calls are needed. Every API involved has 96%+ global browser coverage and full support on iOS Safari 17+ and Android Chrome (the app's target platforms).

---

## Browser APIs to Use

### Export: JSON File Download

| API | Purpose | iOS Safari | Android Chrome | MDN |
|-----|---------|-----------|---------------|-----|
| `JSON.stringify` | Serialize game config to string | ✅ All versions | ✅ All versions | Built-in |
| `new Blob([str], { type: 'application/json' })` | Wrap string as typed binary blob | ✅ iOS 10+ | ✅ All versions | [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) |
| `URL.createObjectURL(blob)` | Create temporary in-memory URL | ✅ iOS 10+ | ✅ All versions | [createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL) |
| `a.download` attribute + `a.click()` | Trigger file save dialog | ✅ iOS 13+ (reliable iOS 17+) | ✅ All versions | [download](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download) |
| `URL.revokeObjectURL(url)` | Release blob memory after click | ✅ iOS 10+ | ✅ All versions | [revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL) |

**Pattern:**
```typescript
function exportConfig(gameState: GameState): void {
  const payload = {
    chapters: gameState.chapters,
    powerUpCatalog: gameState.powerUpCatalog,
    startingTokens: gameState.startingTokens,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'game-config.json';
  a.click();
  URL.revokeObjectURL(url); // must be called immediately after click — frees memory
}
```

**iOS Safari note:** The `download` attribute is fully respected in iOS Safari 17+ (iOS 17 released Sept 2023). In iOS 13–16 the browser may open the JSON in a new tab rather than saving it. For a 2026 bachelor party app targeting current iPhones, iOS 17+ is a safe assumption. No fallback needed.

**Memory note:** `URL.revokeObjectURL` must always be called. Omitting it leaks the blob in the browser's memory for the lifetime of the page.

---

### Import: JSON File Read

| API | Purpose | iOS Safari | Android Chrome | Notes |
|-----|---------|-----------|---------------|-------|
| `<input type="file" accept=".json">` | Trigger OS file picker | ✅ Partial (accept hint, not enforced) | ✅ Partial | Browser may show all files; `.json` filters by extension as a hint |
| `input.files[0]` (`File` object) | Reference selected file | ✅ iOS 10+ | ✅ All | Part of the File API (96.72% global coverage) |
| `file.text()` | Read file contents as string (Promise) | ✅ iOS 14+ | ✅ All | Modern alternative to FileReader; cleaner async/await usage |
| `JSON.parse(str)` | Deserialize string to object | ✅ All | ✅ All | Built-in |

**Pattern:**
```typescript
async function importConfig(file: File): Promise<void> {
  const text = await file.text();
  const raw = JSON.parse(text);
  // validate shape before sending — see PITFALLS.md
  sendMessage({ type: 'SAVE_SETUP', chapters: raw.chapters, powerUpCatalog: raw.powerUpCatalog, startingTokens: raw.startingTokens });
}
```

**`file.text()` vs `FileReader`:** `file.text()` is a Promise-based method on the `File` object, available in iOS Safari 14+ and all modern browsers. It is strictly simpler than the older `FileReader` callback API. No reason to use `FileReader` for this use case.

**`accept` attribute:** Use `accept=".json,application/json"` — the `.json` extension filter is the more reliably respected form across iOS Safari. The MIME type `application/json` is included as a fallback hint. Either way the user can bypass the filter in the OS picker; the filter is cosmetic UX, not a security boundary.

---

## Integration with Existing WebSocket Flow

### Export: No Server Involvement

Export reads directly from the `$gameState` Svelte store on the client. The data is already present — it was synced via the existing `STATE_SYNC` broadcast. No new WebSocket message, no server change, no HTTP endpoint needed.

```
$gameState (client store) → JSON.stringify → Blob → download
```

### Import: Reuse SAVE_SETUP — No New Message Type

After parsing and validating the JSON file, send the existing `SAVE_SETUP` message with the file's content as the payload. The server handler at `server/handlers.ts:135` already:
- Validates the game is in `"lobby"` phase before accepting
- Replaces `chapters`, `powerUpCatalog`, and `startingTokens` in server state
- Broadcasts `STATE_SYNC` to all connected clients

```
File picker → file.text() → JSON.parse → validate → sendMessage({ type: 'SAVE_SETUP', ... })
```

This means the imported config immediately populates both the server state and the admin's form (via the existing `$effect` that restores form from `$gameState` on sync, line 23–29 in `+page.svelte`).

**No new WebSocket message type is required.** Do not add `LOAD_CONFIG` — it would duplicate `SAVE_SETUP` with identical semantics.

### Export Data Shape

The exported JSON must match the `SAVE_SETUP` payload exactly:

```typescript
type ExportedConfig = {
  chapters: Chapter[];         // from src/lib/types.ts
  powerUpCatalog: PowerUp[];   // from src/lib/types.ts
  startingTokens: number;
};
```

Fields like `servedQuestionIndex`, `minigameDone`, `scavengerDone` are runtime-only state on `Chapter`. They should be stripped on export (or preserved and ignored by the server — `SAVE_SETUP` accepts them if present since they are valid `Chapter` fields). Stripping them is cleaner.

---

## What NOT to Add

| Avoid | Why |
|-------|-----|
| FileSaver.js | Zero-dependency alternative exists with native browser APIs; FileSaver only adds value for IE10 compatibility which is irrelevant here |
| file-saver npm package | Same reason — pure browser API is sufficient |
| `FileReader` (callback API) | `file.text()` is simpler and available in all target browsers (iOS 14+) |
| `window.open(URL.createObjectURL(blob))` | Opens blob in new tab, does not trigger download; wrong pattern |
| New HTTP endpoint for export | No server-side serialization needed — data is already in `$gameState` on the client |
| New `LOAD_CONFIG` WebSocket message type | Exact duplicate of existing `SAVE_SETUP`; adds protocol surface area with no benefit |
| Zod / JSON schema validation library | Inline shape validation with `Array.isArray` + field presence checks is sufficient for a one-file config; no need for a dependency |
| File System Access API (`showSaveFilePicker`) | Not supported in iOS Safari; only works in Chromium-based desktop browsers |

---

## Installation

None. No new packages required.

---

## Version Compatibility

| API | Min iOS Safari | Min Android Chrome | Notes |
|-----|---------------|-------------------|-------|
| `Blob` | iOS 10 | 26 | Widely supported |
| `URL.createObjectURL` | iOS 10 | 26 | Widely supported |
| `a.download` (blob URL) | iOS 13 (reliable: iOS 17) | All | iOS 17 = Sept 2023; safe for 2026 |
| `File.prototype.text()` | iOS 14 | All | iOS 14 = Sept 2020; safe for 2026 |
| `<input type="file">` | All | All | Universal |

---

## Sources

- [Blob URLs — Can I Use](https://caniuse.com/bloburls) — Blob + createObjectURL support: iOS 10+, 96.72% global
- [File API — Can I Use](https://caniuse.com/fileapi) — File.text(), input.files: iOS 10+, 96.72% global
- [Input file accept — Can I Use](https://caniuse.com/input-file-accept) — iOS Safari partial (hint-only), Android Chrome partial
- [WebKit Bug 167341](https://bugs.webkit.org/show_bug.cgi?id=167341) — iOS Safari download attribute history; resolved in iOS 13+
- [Apple Developer Forums: PWA locally generated text download](https://developer.apple.com/forums/thread/119017) — Blob + a.click() confirmed pattern for iOS Safari
- [FileSaver.js iOS issues](https://github.com/eligrey/FileSaver.js/issues/12) — Known iOS Safari blob download edge cases; reasons not to use the library
- [web.dev: Read files in JavaScript](https://web.dev/read-files/) — File API, file.text() pattern (MEDIUM confidence — WebSearch verified)

---

*Stack research for: JSON import/export, SvelteKit 5 admin page, Bun WebSocket*
*Milestone: v1.2*
*Researched: 2026-04-13*
