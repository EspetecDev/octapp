# Phase 9: Export - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can download the current game setup as `octapp-setup.json` from `/admin/setup`, with an iOS Safari fallback that opens the JSON in a new tab instead of triggering a file download. No new routes, no server changes, no new WebSocket messages.

</domain>

<decisions>
## Implementation Decisions

### Button Placement
- **D-01:** "Export Config" button lives in the **sticky bottom bar alongside "Save Setup"** — Export on the left, Save on the right. The fixed bar grows to hold two buttons side by side. Stays visible as the admin scrolls through the full setup form.

### Enabled/Disabled State
- **D-02:** Export button follows the **same `isValid` rule as Save** — disabled unless the form is fully valid (all chapters complete, all required fields filled). Consistent with Save's behavior.

### iOS Safari Detection
- **D-03:** Use a **userAgent regex `/iP(hone|ad|od)/i`** to detect iOS devices. Matches iPhone, iPad, and iPod — exactly the devices affected by WebKit bug #216918 where `<a download>` + blob URL silently fails.
  - Desktop/Android path: create blob URL → programmatically click `<a download>` → `URL.revokeObjectURL` after click
  - iOS path: `window.open(blobUrl, "_blank")` → no revokeObjectURL (browser tab holds the reference)

### Post-Export Feedback
- **D-04:** Button flashes **"Exported!"** for ~1.5 seconds then resets to "Export Config". Same pattern as the Save button's "Saved" flash. Use a separate `exportFlash` state boolean and a clearTimeout-guarded timer, mirroring `saveFlash` / `saveFlashTimer`.

### File Naming
- **D-05:** Downloaded file is named **`octapp-setup.json`** (from ROADMAP success criteria — not up for discussion).

### Memory Leak Prevention
- **D-06:** Call `URL.revokeObjectURL` after the programmatic click on desktop/Android. Skip revoke on iOS (the `window.open` tab holds the reference and will release it when closed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Setup Page
- `src/routes/admin/setup/+page.svelte` — 468-line admin setup page. Read the full file: `saveFlash`/`saveFlashTimer` pattern (lines 15-16, 166-174), sticky bar markup (lines 457-468), `isValid` derived state (lines 33-51), `chapters`/`powerUpCatalog`/`startingTokens` state (lines 10-13).

### Serializer Module (Phase 8 output)
- `src/lib/configSerializer.ts` — `serializeConfig(chapters, powerUpCatalog, startingTokens): GameConfig`. Call this to produce the JSON. Do NOT re-implement field stripping inline.
- `src/lib/types.ts` — `GameConfig` re-exported here.

### Requirements
- `.planning/REQUIREMENTS.md` — EXP-01, EXP-02, EXP-03 define the acceptance criteria for this phase.

### Known Platform Bug
- WebKit bug #216918: `<a download>` + blob URL silently fails on iOS Safari. The fix is `window.open(blobUrl, "_blank")`. Detection: `/iP(hone|ad|od)/i.test(navigator.userAgent)`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `saveFlash` / `saveFlashTimer` pattern in `+page.svelte` — copy this pattern verbatim for `exportFlash` / `exportFlashTimer`
- `isValid` derived state — reuse directly as the disabled condition for the Export button
- `chapters`, `powerUpCatalog`, `startingTokens` — these are the three args to `serializeConfig()`

### Established Patterns
- Svelte 5 runes: `$state`, `$derived`, `$effect` — all exports go through the existing state, no new reactive primitives needed
- Button styling: `accent-admin` color, `rounded-xl`, `min-h-[48px]` — match existing Save button style for the Export button
- Sticky bar: `fixed bottom-0 left-0 right-0 bg-bg pb-6 px-4 pt-2` — extend this div to hold two buttons

### Integration Points
- Import `serializeConfig` from `$lib/configSerializer`
- Add `exportSetup()` function alongside `saveSetup()` in the script block
- Extend the sticky bar `<div>` to use `flex gap-2` for two-button layout

</code_context>

<specifics>
## Specific Ideas

- Flash text: "Exported!" (with exclamation, matching the energy of a successful action)
- Flash duration: ~1.5s (slightly shorter than Save's 2s since download confirmation is visible)
- Two-button layout: Export left (secondary/outline style?), Save right (primary `accent-admin` fill) — relative visual weight should make Save feel more prominent since it's the primary action

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-export*
