# Feature Research: JSON Config Import/Export

**Domain:** Browser-based admin UI — JSON config import/export for a game setup page
**Researched:** 2026-04-13
**Confidence:** HIGH (browser APIs verified via MDN; UX patterns from production admin tool conventions)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the admin assumes exist. Missing any of these = the import/export feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Export button triggers file download | Standard pattern for any "save config" action; admin expects a file to appear in Downloads | LOW | `Blob` + `URL.createObjectURL` + `<a download>` click. Works on iOS Safari and Android Chrome without any library. Must use `application/json` MIME type. |
| Downloaded filename includes context | Filename `octapp-setup.json` beats `download.json`; admin can recognise the file later | LOW | Hardcode a meaningful filename in the `download` attribute — no user input needed. |
| Import via file picker | Standard pattern: button opens OS file picker, user selects `.json` file | LOW | Hidden `<input type="file" accept=".json,application/json">` styled via a label/button. Works on iOS and Android. Do NOT use File System Access API — Safari does not support it. |
| Imported data replaces current setup | Admin expects the page to reflect the loaded config immediately | LOW | Parse file with `FileReader.readAsText` + `JSON.parse`, then call the existing `saveSetup()` path to push via `SAVE_SETUP` WebSocket message. No new server endpoint needed. |
| Confirmation dialog before import | Import is destructive (overwrites current setup); admin expects a "are you sure?" gate | LOW | Native `window.confirm()` is sufficient here — this is an admin-only screen, not a consumer UX. A custom modal adds complexity for no meaningful gain on mobile. |
| Error message on malformed JSON | If the file is corrupted or wrong type, admin needs to know why it failed | LOW | Catch `JSON.parse` error, show an inline error string below the import button. No toast library needed — a red `<p>` is sufficient. |
| Success feedback after import | Admin needs confirmation that import was applied, not just silence | LOW | Reuse the existing `saveFlash` green flash pattern already present in the Save button. |

### Differentiators (Nice-to-Have, Not Expected)

Features that add polish. None are required for the feature to feel complete.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Schema validation with field-level errors | Instead of "invalid JSON", tell the admin "Chapter 2 is missing a scavenger clue" | MEDIUM | Requires writing a validator against the `Chapter[]` + `PowerUp[]` type shapes. Valuable if configs are hand-edited between events. Adds ~30 lines of validation logic. |
| Preview before confirming import | Show chapter count and power-up count in the confirm dialog: "Import 3 chapters and 4 power-ups?" | LOW | Parse the file, check lengths, inject counts into the confirm message. Minimal extra work, significantly reduces "did it work?" anxiety. |
| Filename reflects event name | Auto-name the export `octapp-{sessionCode}-setup.json` | LOW | Grab `$gameState.sessionCode` at export time. Adds zero complexity; improves file management across events. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| JSON editor / textarea in the UI | "Let me edit the config directly in the browser" | Adds a text editor, syntax highlighting, live validation — massive scope creep for a one-time-event admin | Export → edit in VS Code/TextEdit → import. The admin is a developer. |
| Import from URL / remote JSON | "Store the config in a Gist or Dropbox" | CORS, auth, link rot, mobile network failures — far outside scope | Export file → share via AirDrop or Slack → import |
| Version history / undo | "Oops I imported the wrong file" | Requires diff tracking and state snapshots | Tell admin to export before importing. One extra step. |
| Merge import (add to existing chapters) | "I want to add chapters from another config" | Ambiguous semantics — what wins on conflict? servedQuestionIndex, minigameDone etc. are runtime state | Replace-all is unambiguous. Document "export first, then re-add manually" if needed. |
| Server-side config persistence | "Save configs to a database" | App is in-memory by design; Railway single-replica; no DB in scope | JSON files in the admin's own file system are the persistence layer for this app |

---

## Feature Dependencies

```
Export (download)
    ──reads──> $gameState (chapters, powerUpCatalog, startingTokens)
    ──no server call needed──> pure client-side Blob download

Import (upload)
    ──reads──> file picker (FileReader API)
    ──validation──> JSON.parse + optional schema check
    ──confirmation──> window.confirm()
    ──applies via──> existing SAVE_SETUP WebSocket message
        └──requires──> game phase === "lobby" (server enforces this already)
        └──broadcasts──> STATE_SYNC to all connected clients
        └──triggers──> $gameState reactive update in setup page
            └──$effect restoredFromState guard must be reset to allow re-render
```

### Dependency Notes

- **Import requires SAVE_SETUP:** No new server handler. The existing `SAVE_SETUP` WebSocket message already accepts `{ chapters, powerUpCatalog, startingTokens }` and broadcasts state. Import just pre-populates that payload from a file.
- **Import requires restoredFromState reset:** The setup page guards against overwriting form state after the first `$gameState` sync (`restoredFromState` flag). On import, the local state is set directly from the parsed file — this bypasses the guard, which is correct. But if the intent is to also trigger a server round-trip and then re-sync, the guard must be reset so the next `STATE_SYNC` can update the form.
- **Export has no dependencies** beyond `$gameState` being populated. It works even if no WebSocket connection is active (reads last-known reactive state).
- **SAVE_SETUP is lobby-only:** Server rejects setup changes after game starts. Export should be available at any time (it is read-only), but import button should be disabled or hidden once `$gameState.phase !== 'lobby'`.

---

## MVP Definition

### Launch With (v1.2)

Minimum viable product for this milestone — what is needed for an admin to save and reuse a game config.

- [ ] Export button on `/admin/setup` — downloads current chapters + powerUpCatalog + startingTokens as `octapp-setup.json`
- [ ] Import button on `/admin/setup` — opens file picker, reads `.json` file, shows confirm dialog, calls SAVE_SETUP
- [ ] Error message on parse failure (invalid JSON or missing required fields)
- [ ] Success flash on successful import (reuse existing saveFlash pattern)
- [ ] Import button disabled when game phase is not "lobby"

### Add After Validation

- [ ] Schema validation with field-level messages — add once an admin reports a confusing error
- [ ] Preview count in confirm dialog ("Import 3 chapters, 4 power-ups?") — low effort, high trust

### Future Consideration (v2+)

- [ ] Export with session code in filename — only useful if running multiple events; premature now
- [ ] Import from URL — requires significant infrastructure; out of scope for this app

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Export to file | HIGH | LOW | P1 |
| Import from file + SAVE_SETUP | HIGH | LOW | P1 |
| Confirmation dialog | HIGH (destructive action) | LOW | P1 |
| Error on bad JSON | HIGH | LOW | P1 |
| Success flash | MEDIUM | LOW (reuse existing) | P1 |
| Disable import in active game | MEDIUM | LOW | P1 |
| Preview count in confirm | MEDIUM | LOW | P2 |
| Schema validation with field errors | MEDIUM | MEDIUM | P2 |
| Filename with session code | LOW | LOW | P3 |

---

## Mobile Browser Behavior Notes

These are production-critical because the admin uses the app from a phone or from a device that may differ from desktop.

**Export on iOS Safari:**
- `<a download="filename.json">` with a blob URL works on iOS Safari 13+. The file is saved to the Downloads folder (Files app).
- Do NOT use the File System Access API (`window.showSaveFilePicker`) — Safari does not support it as of 2025.
- Programmatically creating and clicking a hidden anchor element is the correct approach. This is synchronous and does not require a user gesture beyond the button click that triggers the function.

**Import on iOS Safari:**
- `<input type="file" accept=".json,application/json">` works on iOS Safari and Android Chrome.
- The input must be hidden (`display:none` or `visibility:hidden`) and triggered by clicking a styled label or a button that calls `input.click()`. This counts as a user gesture.
- Do NOT call `input.click()` from inside an async function that was not itself triggered synchronously by a user gesture — iOS Safari will block it.
- `FileReader.readAsText()` is fully supported on all target browsers.
- After reading, `JSON.parse()` the result string. Wrap in try/catch.

**Confirm dialog on mobile:**
- `window.confirm()` produces the OS-native modal on iOS and Android. It blocks the thread and returns a boolean. It is perfectly suitable for an admin-only destructive action. No third-party modal library is needed.

---

## Integration with Existing SAVE_SETUP Flow

The import path must map exactly to the existing `SAVE_SETUP` message shape:

```typescript
// Existing ClientMessage type (src/lib/types.ts)
{ type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[]; startingTokens: number }

// Server handler enforces: phase === "lobby" before applying
// Server response: STATE_SYNC broadcast to all clients
```

The import function should:
1. Parse the JSON file
2. Validate minimally (array fields present, non-empty chapters)
3. Ask for confirmation
4. Call `sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog, startingTokens })`
5. The existing `$effect` that restores form state from `$gameState` will update the UI on the next `STATE_SYNC`

The export function should read directly from the Svelte reactive state (`chapters`, `powerUpCatalog`, `startingTokens`) — not from `$gameState` — so the exported file reflects what is currently in the form, even if Save Setup has not been clicked. This is the most intuitive behavior: "export what I see."

---

## Sources

- MDN: `<input type="file">` accept attribute — https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
- MDN: HTML attribute `accept` — https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept
- Blob + anchor download (cross-browser) — https://blog.logrocket.com/programmatically-downloading-files-browser/
- iOS Safari `<a download>` support — https://bugs.webkit.org/show_bug.cgi?id=167341
- File System Access API: Safari does not support — https://developer.chrome.com/docs/capabilities/browser-fs-access
- Import/export UX trust patterns — https://medium.com/@careful_celadon_goldfish_904/building-import-export-that-doesnt-break-user-trust-202099fd99a5
- FileSaver.js iOS Safari limitations — https://github.com/eligrey/FileSaver.js/issues/375

---

*Feature research for: JSON config import/export — octapp v1.2*
*Researched: 2026-04-13*
