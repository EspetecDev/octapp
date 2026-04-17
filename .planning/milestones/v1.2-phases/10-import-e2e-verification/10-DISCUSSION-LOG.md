# Phase 10: Import + E2E Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 10-import-e2e-verification
**Areas discussed:** Confirmation prompt style, Error feedback placement, Import button enabled state, E2E verification deliverable

---

## Confirmation Prompt Style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline sticky bar swap | Sticky bar temporarily shows 'Replace setup? [Cancel] [Yes, Replace]' | ✓ |
| native window.confirm() | Browser-native confirm dialog — zero new UI code | |
| Fullscreen confirm overlay | Semi-transparent overlay card with question and buttons | |

**User's choice:** Inline sticky bar swap
**Notes:** No follow-up — user confirmed no extra context (filename/chapter count) needed in confirm mode. Just the action buttons.

---

## Error Feedback Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Error strip above sticky bar | Fixed error band just above sticky bar, always visible | ✓ |
| Inline in the sticky bar | Error label inside the sticky bar beneath the button | |
| Toast / floating banner | Brief toast auto-dismissing after ~3s | |

**User's choice:** Error strip above sticky bar
**Notes:** Strip persists until admin selects a new file (does not auto-dismiss on a timer).

---

## Import Button Enabled State

| Option | Description | Selected |
|--------|-------------|----------|
| Always enabled | Import is how you fix a broken setup — not gated by isValid | ✓ |
| Same isValid rule as Export/Save | Consistent with other buttons, but blocks fixing a broken form | |

**User's choice:** Always enabled

---

## E2E Verification Deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Manual test, verified before commit | Run roundtrip in browser, document result — no new test infra | ✓ |
| Checklist in PLAN.md | Human-verify checkpoint with checklist steps in the plan | |
| Playwright E2E test | Automated test — requires setting up Playwright from scratch | |

**User's choice:** Manual test, verified before commit
**Notes:** 5-step roundtrip: export → reload → import → verify form → save → check second tab.

---

## Claude's Discretion

- Exact styling of the error strip (color scheme)
- Exact cancel button label in confirm mode
- Whether to include an "Imported!" flash after confirming

## Deferred Ideas

None
