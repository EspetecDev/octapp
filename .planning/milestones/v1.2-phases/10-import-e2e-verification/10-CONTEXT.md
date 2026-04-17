# Phase 10: Import + E2E Verification - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can load a previously exported `.json` config file into the setup form on `/admin/setup` — with file validation, an inline confirmation step, and form population. Ends with a manual end-to-end verification roundtrip (export → import → save → verify server state). No new server changes; `SAVE_SETUP` WebSocket message handles applying to server state.

</domain>

<decisions>
## Implementation Decisions

### Sticky Bar Layout
- **D-01:** Three equal buttons in a row: **[Import Config] [Export Config] [Save Setup]** — all `flex-1`, Import on the left, Export in the middle, Save on the right.

### Import Button Enabled State
- **D-02:** Import button is **always enabled** regardless of current form validity. Import is how you fix a broken setup — blocking it when `isValid` is false defeats the purpose.

### Confirmation Prompt
- **D-03:** After a valid file is selected, the sticky bar temporarily swaps to **confirm mode**: shows "Replace setup?" label + [Cancel] [Yes, Replace] buttons instead of the normal three-button layout. No modal, no new overlay component needed.
- **D-04:** Confirm mode shows **just the action buttons** — no filename or chapter count. Admin selected the file 1 second ago and knows what it is.

### Error Feedback
- **D-05:** When `validateConfig()` rejects a file, show an **error strip just above the sticky bar** (e.g. `⚠ Invalid file: missing chapters field`). Fixed position so it's always visible without scrolling.
- **D-06:** Error strip **persists until the admin selects a new file** (or clicks Import again). Does not auto-dismiss on a timer.

### Post-Import Form Population
- **D-07:** After confirming, populate `chapters`, `powerUpCatalog`, `startingTokens` from the parsed config using `structuredClone` (existing pattern, line 28-29 of `+page.svelte`). Set `restoredFromState = true` immediately so the next `STATE_SYNC` does not silently overwrite the imported data.

### E2E Verification
- **D-08:** Verification is a **manual test run before commit** — no new test infra. The plan must include a human-verify checkpoint with these 5 steps:
  1. Load setup, click Export Config → `octapp-setup.json` downloaded
  2. Reload the page (clears form to server state / empty)
  3. Click Import Config → select `octapp-setup.json`
  4. Verify form fields match the exported data
  5. Click Save Setup → open a second browser tab and verify server state matches

### Claude's Discretion
- Exact styling of the error strip (color, padding, border) — match the existing app color system (`text-red-400` or similar warning color consistent with the UI)
- Exact button label for confirm mode cancel (`Cancel` vs `Keep Current`) — use whatever reads most clearly
- Whether to show a brief "Imported!" flash on the Import button after confirming (analogous to "Saved!" / "Exported!") — include if it fits naturally

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Setup Page
- `src/routes/admin/setup/+page.svelte` — Read the full file. Key areas:
  - `saveFlash`/`saveFlashTimer` pattern (lines 15-19) — mirror for `importFlash` if used
  - `exportSetup()` function (lines 183-211) — reference for the iOS detection and blob pattern
  - `restoredFromState` guard (lines 22-33) — MUST set this `true` after import populates form
  - Sticky bar markup (lines 492-509) — extend to three-button layout + confirm mode
  - `isValid` derived state (lines 36-54) — NOT used to gate Import button (D-02)
  - `structuredClone` pattern (lines 28-29) — use when assigning imported arrays to `$state`

### Serializer Module (Phase 8 output)
- `src/lib/configSerializer.ts` — `validateConfig(data: unknown)` returns typed result or descriptive error string. Call this on the parsed JSON before applying.
- `src/lib/types.ts` — `GameConfig` type re-exported here.

### Requirements
- `.planning/REQUIREMENTS.md` — IMP-01, IMP-02, IMP-03, IMP-04 define the acceptance criteria for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `saveFlash` / `saveFlashTimer` / `exportFlash` / `exportFlashTimer` patterns — mirror for any import flash feedback
- `restoredFromState` flag — already wired to prevent `STATE_SYNC` overwrites; set it `true` after import
- `structuredClone` on line 28-29 — required pattern when assigning arrays to `$state` runes
- `isValid` derived state — used by Export and Save, but NOT Import (D-02)
- Sticky bar `<div>` (lines 492-509) — extend with third button + conditional confirm-mode render

### Established Patterns
- Svelte 5 runes: `$state`, `$derived`, `$effect`
- Button styling: `accent-admin` color, `rounded-xl`, `min-h-[48px]`, `flex-1`
- Disabled state: `disabled:opacity-50 disabled:pointer-events-none`
- Import button uses `<input type="file" accept=".json">` (hidden, programmatically clicked)

### Integration Points
- Import `validateConfig` from `$lib/configSerializer`
- Add `importSetup()` function alongside `saveSetup()` / `exportSetup()` in script block
- Sticky bar: add `importConfirmPending` state boolean to toggle between normal 3-button and confirm-mode 2-button layout
- Error strip: add `importError` state string (empty = no error, non-empty = show strip)

</code_context>

<specifics>
## Specific Ideas

- Confirm mode layout: `<p>Replace setup?</p>` + `[Cancel] [Yes, Replace]` — concise, no extra context shown
- Error strip positioning: `fixed` just above the sticky bar (`bottom-[calc(var(--sticky-bar-height))]` or hard-coded offset) — always visible
- Error strip content: `⚠ {importError}` where `importError` is the string returned by `validateConfig`
- Three-button bar: Import button styled as outline (like current Export button), Export and Save keep their existing styles

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-import-e2e-verification*
*Context gathered: 2026-04-17*
