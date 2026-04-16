# Phase 9: Export - Research

**Researched:** 2026-04-16
**Domain:** Browser file download API, iOS Safari compatibility, Svelte 5 runes
**Confidence:** HIGH

## Summary

Phase 9 is almost entirely contained within a single existing file: `src/routes/admin/setup/+page.svelte`. The implementation adds one function (`exportSetup`), two state variables (`exportFlash`, `exportFlashTimer`), and extends the sticky bottom bar to hold two buttons side by side. The serializer infrastructure from Phase 8 (`serializeConfig`) is already built and ready to call.

The only non-trivial technical concern is the iOS Safari platform bug (WebKit #216918) where `<a download>` combined with a blob URL silently fails without triggering any error event. The fix — `window.open(blobUrl, "_blank")` — is well-established and confirmed by multiple sources. The detection method (`/iP(hone|ad|od)/i.test(navigator.userAgent)`) is locked in D-03 and is the industry-standard approach for this specific WebKit restriction.

All design decisions (button placement, enabled/disabled rule, flash pattern, file naming, memory leak prevention) are locked in CONTEXT.md. Research confirms each decision is technically sound.

**Primary recommendation:** Copy the `saveFlash`/`saveFlashTimer` pattern exactly, call `serializeConfig()` for the payload, branch on the iOS userAgent regex for download vs. `window.open`, and extend the sticky bar `<div>` to `flex gap-2` with two children.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** "Export Config" button lives in the sticky bottom bar alongside "Save Setup" — Export on the left, Save on the right. The fixed bar grows to hold two buttons side by side. Stays visible as the admin scrolls.
- **D-02:** Export button follows the same `isValid` rule as Save — disabled unless the form is fully valid.
- **D-03:** Use a userAgent regex `/iP(hone|ad|od)/i` to detect iOS. Desktop/Android path: create blob URL → programmatically click `<a download>` → `URL.revokeObjectURL` after click. iOS path: `window.open(blobUrl, "_blank")` → no revokeObjectURL.
- **D-04:** Button flashes "Exported!" for ~1.5 seconds then resets to "Export Config". Use a separate `exportFlash` state boolean and a clearTimeout-guarded timer, mirroring `saveFlash`/`saveFlashTimer`.
- **D-05:** Downloaded file is named `octapp-setup.json`.
- **D-06:** Call `URL.revokeObjectURL` after the programmatic click on desktop/Android. Skip revoke on iOS.

### Claude's Discretion

- Two-button visual weight: Export left (secondary/outline style), Save right (primary `accent-admin` fill). Relative styling makes Save feel more prominent.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | Admin can download the current game setup as a JSON file from /admin/setup | Blob URL + `<a download>` pattern; `serializeConfig()` already available |
| EXP-02 | Exported JSON contains chapters, power-up catalog, and starting tokens — runtime-only fields stripped | `serializeConfig()` from Phase 8 handles this exactly; returns `GameConfig` shape |
| EXP-03 | Export works on iOS Safari (uses `window.open()` fallback when `<a download>` is unsupported) | WebKit bug #216918 confirmed; `window.open(blobUrl, "_blank")` is the established fix |
</phase_requirements>

---

## Standard Stack

### Core

| Library / API | Version | Purpose | Why Standard |
|---|---|---|---|
| `URL.createObjectURL` | Browser built-in | Create a temporary URL pointing to in-memory Blob | No dependency; universally supported on target browsers |
| `Blob` constructor | Browser built-in | Package JSON string as binary data for download | Native; no polyfill needed |
| `URL.revokeObjectURL` | Browser built-in | Release memory held by the blob URL | Required after use to prevent memory leak |
| `window.open` | Browser built-in | iOS Safari fallback — opens blob URL in a new tab | Only reliable option on WebKit for blob content |

### Supporting

| Library / API | Purpose | When to Use |
|---|---|---|
| `serializeConfig` from `$lib/configSerializer` | Strip runtime fields; return `GameConfig` | Always — never build inline field-stripping logic |
| `navigator.userAgent` regex | iOS device detection | Guard the `window.open` path |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `Blob` + `URL.createObjectURL` | `data:` URI with base64 | `data:` URIs have 2MB browser limits; blob URL has no practical size limit for JSON |
| userAgent sniff | Feature-detect download attr support | No reliable feature-detect for `<a download>` + blob URL failure on iOS — the element reports as supported but silently fails |

**No npm installation required** — everything is browser built-in or already imported.

---

## Architecture Patterns

### Recommended Project Structure

No new files. All changes live in:

```
src/routes/admin/setup/+page.svelte   ← only file that changes
src/lib/configSerializer.ts           ← already built, only imported
```

### Pattern 1: Blob Download with iOS Fallback

**What:** Create a Blob from the serialized JSON, generate a temporary URL, branch on iOS detection to either programmatically click `<a download>` or call `window.open`.

**When to use:** Any browser-side JSON export where iOS must be supported.

```typescript
// Source: CONTEXT.md D-03 + WebKit bug #216918 established practice
function exportSetup() {
  if (!isValid) return;

  const config = serializeConfig(chapters, powerUpCatalog, startingTokens);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);

  if (isIOS) {
    // WebKit bug #216918 — <a download> + blob URL silently fails on iOS.
    // window.open triggers the share sheet; user can save from there.
    window.open(url, "_blank");
    // Do NOT revoke — the open tab holds the reference.
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = "octapp-setup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportFlash = true;
  if (exportFlashTimer) clearTimeout(exportFlashTimer);
  exportFlashTimer = setTimeout(() => {
    exportFlash = false;
  }, 1500);
}
```

### Pattern 2: Flash State (copy of saveFlash pattern)

**What:** Transient boolean + guarded timer to show confirmation text on button.

**When to use:** Any action button that benefits from brief success feedback without a toast or modal.

```typescript
// Source: +page.svelte lines 15-16, 166-174 (existing saveFlash pattern)
let exportFlash = $state(false);
let exportFlashTimer: ReturnType<typeof setTimeout> | null = null;
```

Button markup mirrors the Save button:
```svelte
<button
  onclick={exportSetup}
  disabled={!isValid}
  class="flex-1 min-h-[48px] border border-accent-admin text-accent-admin font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
>
  {exportFlash ? "Exported!" : "Export Config"}
</button>
```

### Pattern 3: Two-Button Sticky Bar

**What:** Convert the single-button fixed bar to a `flex gap-2` row.

```svelte
<!-- Source: +page.svelte lines 457-467 — extend this exact div -->
<div class="fixed bottom-0 left-0 right-0 bg-bg pb-6 px-4 pt-2 flex gap-2">
  <!-- Export: left, secondary/outline style -->
  <button onclick={exportSetup} disabled={!isValid} class="flex-1 min-h-[48px] border border-accent-admin text-accent-admin font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none">
    {exportFlash ? "Exported!" : "Export Config"}
  </button>
  <!-- Save: right, primary fill -->
  <button onclick={saveSetup} disabled={!isValid} class="flex-1 min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none" style={saveFlash ? "background: #22c55e;" : ""}>
    {saveFlash ? "Saved" : "Save Setup"}
  </button>
</div>
```

### Anti-Patterns to Avoid

- **Inline field stripping:** Do not destructure runtime fields directly in `exportSetup`. Always call `serializeConfig()` — that's what Phase 8 built it for.
- **Revoking on iOS:** Do not call `URL.revokeObjectURL` after `window.open` on iOS. The open tab holds the blob reference; revoking prematurely makes the tab show a blank/error page.
- **Appending `<a>` without removing it:** Always `document.body.appendChild(a)` → click → `document.body.removeChild(a)`. Leaving detached elements in the DOM is not the right pattern.
- **Mutating `$state` arrays in-place:** Not applicable here (no array mutation needed for export), but maintain existing Svelte 5 rune discipline across the file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Stripping runtime-only fields | Inline destructuring or JSON replacer | `serializeConfig()` from `$lib/configSerializer` | Already tested, type-safe, single source of truth |
| iOS detection | navigator.platform, CSS media queries, touch event presence | `/iP(hone|ad|od)/i.test(navigator.userAgent)` | The most targeted match for exactly the devices with the WebKit blob download bug |
| File naming | Dynamic timestamps or user input | Hardcoded `"octapp-setup.json"` | Locked in D-05; simpler and predictable |

---

## Common Pitfalls

### Pitfall 1: Revoking the blob URL before iOS tab loads

**What goes wrong:** `URL.revokeObjectURL` is called immediately after `window.open` on iOS. The new tab starts loading but the blob is already gone — the tab shows an error or blank page.

**Why it happens:** `window.open` is asynchronous; the returned window object hasn't finished navigating when the calling code continues. The blob must remain valid until the tab has read the data.

**How to avoid:** Only call `URL.revokeObjectURL` on the desktop/Android path. On iOS, let the browser tab hold and release the reference naturally. This is locked in D-06.

**Warning signs:** iOS user reports blank tab or "Failed to load resource" on export.

---

### Pitfall 2: `<a>` element not appended to DOM

**What goes wrong:** `a.click()` is called on a detached element. In some browsers (especially Firefox) a programmatic click on a detached anchor does not trigger the download.

**Why it happens:** Browser security policies require the anchor to be in the live document for `.click()` to work reliably.

**How to avoid:** Always do `document.body.appendChild(a)` before `a.click()`, then `document.body.removeChild(a)` immediately after.

---

### Pitfall 3: Export button enabled when form is invalid

**What goes wrong:** `serializeConfig` is called with partially-filled chapters, producing a JSON file that fails `validateConfig` on import (Phase 10).

**Why it happens:** Forgetting to guard `exportSetup` with the `isValid` check.

**How to avoid:** Mirror the Save button exactly — `disabled={!isValid}` on the button AND `if (!isValid) return;` as the first line of `exportSetup`. Locked in D-02.

---

### Pitfall 4: Flash timer not cleared before reset

**What goes wrong:** Rapid double-clicks cause the flash to disappear prematurely because the first timer fires while the second flash is still showing.

**Why it happens:** Each click starts a new timer; if the first timer fires, it resets `exportFlash` mid-second-flash.

**How to avoid:** `if (exportFlashTimer) clearTimeout(exportFlashTimer)` before setting a new timer. This is the exact pattern used by `saveFlashTimer` on line 172 of +page.svelte.

---

## Code Examples

### Complete `exportSetup` function

```typescript
// Source: pattern derived from saveSetup (lines 168-176) + D-03 iOS fallback
import { serializeConfig } from "$lib/configSerializer";

let exportFlash = $state(false);
let exportFlashTimer: ReturnType<typeof setTimeout> | null = null;

function exportSetup() {
  if (!isValid) return;

  const config = serializeConfig(chapters, powerUpCatalog, startingTokens);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  if (/iP(hone|ad|od)/i.test(navigator.userAgent)) {
    window.open(url, "_blank");
    // No revoke — tab holds the reference
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = "octapp-setup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportFlash = true;
  if (exportFlashTimer) clearTimeout(exportFlashTimer);
  exportFlashTimer = setTimeout(() => {
    exportFlash = false;
  }, 1500);
}
```

### Updated sticky bar markup

```svelte
<!-- Replaces lines 457-467 in +page.svelte -->
<div class="fixed bottom-0 left-0 right-0 bg-bg pb-6 px-4 pt-2 flex gap-2">
  <button
    onclick={exportSetup}
    disabled={!isValid}
    class="flex-1 min-h-[48px] border border-accent-admin text-accent-admin font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
  >
    {exportFlash ? "Exported!" : "Export Config"}
  </button>
  <button
    onclick={saveSetup}
    disabled={!isValid}
    class="flex-1 min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
    style={saveFlash ? "background: #22c55e;" : ""}
  >
    {saveFlash ? "Saved" : "Save Setup"}
  </button>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|---|---|---|
| `data:` URI with base64 for file download | `Blob` + `URL.createObjectURL` | Blob URL has no practical size limit; `data:` URIs are capped in some browsers |
| Library (FileSaver.js) for cross-browser download | Vanilla `Blob` + `<a download>` + iOS userAgent guard | FileSaver.js was needed pre-2016; modern browsers handle this natively |

**Not needed for this phase:**
- File System Access API (write to real disk path) — overkill for a single JSON download; no browser permission prompt needed
- Safari 26 File System WritableStream — future API, not available in current iOS Safari versions

---

## Open Questions

None. All decisions are locked and technically verified.

---

## Environment Availability

Step 2.6: SKIPPED — phase is a pure code change to an existing Svelte component. No external tools, services, CLIs, databases, or new npm packages are required.

---

## Sources

### Primary (HIGH confidence)
- `src/routes/admin/setup/+page.svelte` — Full source read; `saveFlash`/`saveFlashTimer` pattern at lines 15-16, 166-174; sticky bar at lines 457-468; `isValid` at lines 33-51
- `src/lib/configSerializer.ts` — Full source read; `serializeConfig` signature and return type confirmed
- `.planning/phases/09-export/09-CONTEXT.md` — All implementation decisions (D-01 through D-06) read verbatim
- [WebKit bug #167341](https://bugs.webkit.org/show_bug.cgi?id=167341) — iOS Safari `<a download>` support history
- [WebKit bug #190351](https://bugs.webkit.org/show_bug.cgi?id=190351) — Regression: download of Blob URL fails in Safari 12+

### Secondary (MEDIUM confidence)
- WebSearch: iOS Safari blob URL download workarounds (2024-2025) — `window.open("_blank")` confirmed as established fallback across multiple community sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all browser APIs are built-in; `serializeConfig` is already implemented and tested
- Architecture: HIGH — single-file change following established patterns already present in the file
- Pitfalls: HIGH — iOS Safari bug is well-documented; flash timer pattern is copied from existing working code
- iOS fallback: HIGH — `window.open(blobUrl, "_blank")` confirmed by WebKit bug tracker and community consensus

**Research date:** 2026-04-16
**Valid until:** Stable — blob URL API and iOS userAgent sniff are not changing; `window.open` fallback is a structural platform limitation
