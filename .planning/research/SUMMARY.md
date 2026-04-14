# Project Research Summary

**Project:** octapp — Bachelor Party Game
**Domain:** Browser-based file import/export for a SvelteKit 5 admin UI backed by a Bun WebSocket server
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

The v1.2 milestone adds JSON config import/export to the existing `/admin/setup` page. Research confirms this is a narrow, well-bounded feature: zero new npm dependencies, zero new server handlers, and zero new WebSocket message types are required. Export is a pure browser-side Blob download from the existing Svelte `$state` form variables. Import parses a local file, validates its shape in the browser, populates the form, and lets the existing `SAVE_SETUP` WebSocket message handle the server write — the same path the admin uses today when clicking "Save Setup".

The recommended approach is a two-step import model: load config into the form, then the admin reviews and saves. This is architecturally correct (form state is the authoritative source, not `gameState`) and operationally safer (no silent server overwrites). A dedicated `configSerializer.ts` module isolates the pure serialization and validation logic from the UI component, keeping `+page.svelte` focused on presentation.

The primary risk is iOS Safari's known limitation with `<a download>` + blob URLs (WebKit bug #216918): on iOS Safari the file opens inline rather than downloading. This is a production-critical issue since the admin is expected to use the app on an iPhone. The mitigation is to fall back to `window.open(url, "_blank")` for iOS, which lets the user save via the share sheet. A secondary risk is the `restoredFromState` guard in the setup page: forgetting to set it to `true` after import causes the next `STATE_SYNC` to silently overwrite the just-imported form values. Both pitfalls are well-understood and have clear fixes.

## Key Findings

### Recommended Stack

No new packages are needed. The browser's native File API (`Blob`, `URL.createObjectURL`, `File.prototype.text`, `<input type="file">`) covers everything required. All target APIs have 96%+ global browser coverage and are fully supported on iOS Safari 14+ and Android Chrome. The existing stack (SvelteKit 5, Bun WebSocket, Tailwind v4, Railway) is unchanged.

**Core technologies:**
- `Blob` + `URL.createObjectURL` + `<a download>`: file export — native browser; no library needed
- `File.prototype.text()`: async file read — simpler than legacy `FileReader`; iOS Safari 14+
- `JSON.stringify` / `JSON.parse`: serialization — built-in; no schema library needed
- `SAVE_SETUP` (existing WebSocket message): server write after import — zero new message types
- `configSerializer.ts` (new module): pure serialization/validation logic isolated from UI

### Expected Features

**Must have (table stakes) — v1.2 launch:**
- Export button downloads current chapters + powerUpCatalog + startingTokens as `octapp-setup.json`
- Import button opens file picker, parses the file, and populates the form
- Confirmation dialog before import (destructive action; `window.confirm()` is sufficient)
- Error message on malformed or schema-invalid JSON
- Success flash on import (reuse existing `saveFlash` pattern)
- Import button disabled when game phase is not "lobby"
- iOS-safe export: `window.open(blob URL, "_blank")` fallback for iOS Safari

**Should have — add after first validation:**
- Preview count in confirm dialog ("Import 3 chapters, 4 power-ups?") — low effort, high trust
- Schema validation with field-level error messages — add once an admin reports a confusing parse failure

**Defer (v2+):**
- Export filename with session code — premature; only relevant across multiple events
- Import from URL / remote JSON — out of scope; requires CORS, auth, and infrastructure
- Server-side config persistence — in-memory by design; files in the admin's file system are the persistence layer

### Architecture Approach

The feature fits entirely within the existing client/server boundary without changing it. Export is pure client-side: read from `$state` form variables, strip runtime fields, serialize to Blob, trigger download. Import is client-parse + existing server path: `file.text()` → `validateConfig()` → populate `$state` runes → admin reviews → `sendMessage(SAVE_SETUP)`. A new `configSerializer.ts` module hosts `serializeConfig()`, `validateConfig()`, and the `GameConfig` type. The server (`handlers.ts`, `state.ts`) and WebSocket protocol (`ClientMessage` union) are untouched.

**Major components:**
1. `src/lib/configSerializer.ts` (NEW) — `serializeConfig()`, `validateConfig()`, `GameConfig` type; pure functions, independently testable
2. `src/routes/admin/setup/+page.svelte` (MODIFIED) — export button + handler, import file input + async handler, flash states, `restoredFromState` interaction
3. `src/lib/types.ts` (MODIFIED, 1 line) — re-export `GameConfig` from `configSerializer.ts`
4. `server/handlers.ts` (UNCHANGED) — existing `SAVE_SETUP` handler covers import without modification
5. `server/state.ts` (UNCHANGED) — `GameState` and `Chapter` shapes unchanged

### Critical Pitfalls

1. **iOS Safari ignores `<a download>` on blob URLs** — the file opens inline instead of saving. Detect iOS via UA and call `window.open(url, "_blank")` instead; add "Tap share icon > Save to Files" instruction text. Must be tested on a real iPhone before the export phase is marked done.

2. **`restoredFromState` flag not set after import** — the `$effect` watching `$gameState` fires on the next `STATE_SYNC` and overwrites the just-imported form values with stale server state. Fix: set `restoredFromState = true` immediately after populating form state from the parsed file.

3. **No runtime schema validation — malformed JSON corrupts server state silently** — `SAVE_SETUP` in `handlers.ts` does zero shape validation; a chapter missing `triviaPool` will crash `UNLOCK_CHAPTER`. Fix: validate the parsed object in `validateConfig()` before sending `SAVE_SETUP`. Check `Array.isArray(chapters)`, per-chapter required fields (`name`, `minigameType`, `triviaPool`, `scavengerClue`, `reward`), and `typeof startingTokens === "number"`.

4. **Runtime fields in export break re-import** — `Chapter` carries `servedQuestionIndex`, `minigameDone`, and `scavengerDone` as runtime state. If exported as-is, an import from a played game restores chapters that appear already complete. Fix: strip these three fields in `serializeConfig()` and reset them to defaults in the import handler.

5. **`structuredClone` omitted on import** — assigning parsed JSON directly to `$state` runes skips Svelte 5's deep proxy wrapping, causing reactivity gaps: edited values may not trigger recomputation of `$derived(isValid)`. Fix: always `structuredClone` imported arrays before assigning to `chapters` and `powerUpCatalog`. The existing code already uses this pattern for server state restoration (line 25, `+page.svelte`).

## Implications for Roadmap

Based on research, the feature decomposes cleanly into three sequential phases. Build order is dictated by a single dependency chain: serializer logic must exist before export UI, and export must be verified before import is layered on top (they share the same data contract).

### Phase 1: Config Serializer Module

**Rationale:** `configSerializer.ts` is a pure function module with no UI dependencies. Writing it first establishes the `GameConfig` type and the runtime field stripping/validation contract before any UI code touches it. It is the lowest-risk starting point and can be tested in isolation.

**Delivers:** `serializeConfig()` (strips runtime fields, adds `version: 1`), `validateConfig()` (shape check with useful error strings), `GameConfig` type re-exported via `types.ts`.

**Addresses:** Pitfalls 3, 4, 5 — the serializer enforces the strip-on-export and validate-on-import contracts at the boundary before any UI is written.

**Avoids:** Spreading validation logic across the UI component; making the `GameConfig` type ambiguous.

### Phase 2: Export

**Rationale:** Export is additive and read-only — it does not touch WebSocket state, server code, or the `restoredFromState` guard. It is the safer half to ship first. iOS Safari behavior must be confirmed here on a real device before import is built.

**Delivers:** "Export Config" button on `/admin/setup`. Calls `serializeConfig()` then `downloadJson()`. iOS fallback: `window.open(blob, "_blank")` + instruction text for share sheet save. `URL.revokeObjectURL` called after every export.

**Addresses:** Table-stakes "Export button triggers file download" and "Downloaded filename includes context" (`octapp-setup.json`).

**Avoids:** Pitfall 1 (iOS Safari `<a download>` breakage), Pitfall 4 (runtime fields in exported JSON).

**Research flag:** None — patterns are established and iOS workaround is documented in STACK.md and PITFALLS.md.

### Phase 3: Import + End-to-End Verification

**Rationale:** Import has the most integration surface: `restoredFromState` guard, phase awareness, validation error display, success flash, and the two-step review model. It comes last so it can rely on a verified serializer and a confirmed export data shape.

**Delivers:** "Import Config" file input on `/admin/setup`. Hidden `<input type="file" accept=".json,application/json">` triggered by a styled button. Async `file.text()` read → `validateConfig()` → `structuredClone` → populate form state → set `restoredFromState = true` → success flash. Import button disabled when `$gameState.phase !== "lobby"`. Inline error display on validation failure. File size guard (`> 500 KB → reject`). End-to-end test: export a live config, reload, import it, verify form, save, verify server state matches via a second browser tab.

**Addresses:** All remaining table-stakes features. Pitfalls 2, 3, 5.

**Avoids:** Pitfall 2 (import during active game), Pitfall 3 (malformed JSON corrupting state), Pitfall 5 (`structuredClone` omission). The `restoredFromState` interaction must be verified in the end-to-end test.

**Research flag:** None — integration points are fully mapped to existing code with exact line references in ARCHITECTURE.md.

### Phase Ordering Rationale

- Serializer-first enforces the data contract (what fields belong in a config file) before any UI touches it. This prevents the runtime-fields pitfall from being baked into export and having to be untangled during import.
- Export before import: iOS behavior must be confirmed on a real device; the export shape confirmed in Phase 2 is the exact input shape validated in Phase 3.
- Import last: it is the most behaviorally complex step (phase guard, `restoredFromState`, `structuredClone`, two-step model) and is safest to write once the serializer contract is stable.

### Research Flags

Phases with standard patterns (no research-phase run needed):
- **Phase 1 (serializer):** Pure TypeScript functions; well-documented patterns; no external dependencies.
- **Phase 2 (export):** iOS workaround fully documented; Blob/createObjectURL patterns in STACK.md. No unknown territory.
- **Phase 3 (import):** Integration with existing `SAVE_SETUP` flow fully mapped in ARCHITECTURE.md with exact line numbers; `restoredFromState` interaction is the only non-obvious step and is explicitly documented.

No phases require additional research-phase runs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all APIs verified via MDN and Can I Use with exact iOS version data |
| Features | HIGH | Feature set is narrow and directly derives from admin workflow; anti-features well argued |
| Architecture | HIGH | Grounded in direct codebase inspection (`handlers.ts`, `+page.svelte`, `types.ts`) with exact line numbers |
| Pitfalls | HIGH | iOS Safari blob URL bug confirmed via open WebKit bug tracker; `restoredFromState` guard confirmed via code inspection; Svelte 5 `structuredClone` from official docs |

**Overall confidence:** HIGH

### Gaps to Address

- **iOS export UX copy:** The "Tap share icon > Save to Files" instruction text should be validated on a real iPhone to confirm the UI flow matches the copy. Minor — can be adjusted during Phase 2 implementation.
- **Android file picker filtering:** Research confirms `accept` is advisory only on Android. During Phase 3 verification, test on a real Android device to confirm the picker shows `.json` files. The error handling path covers the case where it does not filter.
- **Server-side SAVE_SETUP validation:** PITFALLS.md recommends adding a basic `Array.isArray(msg.chapters)` guard server-side as a backstop. Low-effort addition to Phase 3; not strictly required if client-side validation is solid.

## Sources

### Primary (HIGH confidence)
- `server/handlers.ts` lines 135–153 — SAVE_SETUP handler shape and lobby-only phase guard
- `src/routes/admin/setup/+page.svelte` lines 18–30 — `restoredFromState` guard
- `src/lib/types.ts` — `ClientMessage` union; `Chapter` runtime fields
- [WebKit bug #216918](https://bugs.webkit.org/show_bug.cgi?id=216918) — iOS Safari `<a download>` + blob URL (open since 2021)
- [MDN — File.prototype.text()](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text) — iOS Safari 14+ support confirmed
- [Can I Use — Blob URLs](https://caniuse.com/bloburls) — 96.72% global coverage
- [Can I Use — File API](https://caniuse.com/fileapi) — 96.72% global coverage
- [Svelte docs — $state](https://svelte.dev/docs/svelte/$state) — `structuredClone` pattern for reactive import

### Secondary (MEDIUM confidence)
- [web.dev: Read files in JavaScript](https://web.dev/read-files/) — `file.text()` pattern (verified via WebSearch)
- [Simon Neutert — Force iOS Safari to download](https://www.simon-neutert.de/2025/js-safari-media-download/) — `window.open` fallback for iOS
- [eligrey/FileSaver.js issues](https://github.com/eligrey/FileSaver.js/issues/12) — iOS Safari blob download edge cases

### Tertiary (LOW confidence)
- Import/export UX trust patterns — community conventions for confirmation dialogs on destructive admin actions

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*
