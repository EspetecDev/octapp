# Phase 12: String Catalog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 12-string-catalog
**Areas discussed:** Translation ownership, Extraction scope, Plan chunking

---

## Translation Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| A — User writes them | Executor extracts English, pauses at human checkpoint, user provides native ca/es | ✓ |
| B — Executor drafts, user reviews | Rough translations generated, user reviews JSON diff before plan closes | |
| C — Executor drafts, fix later | Translations go in, user corrects any awkward phrasing post-merge | |

**User's choice:** A — user (Manel) provides ca/es translations at a human checkpoint
**Notes:** Given native Catalan speaker, quality matters. Human checkpoint fits naturally after all English extraction is complete.

---

## Extraction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| A — All three layers | Template text + aria-label/placeholder attributes + programmatic JS strings | ✓ |
| B — Layers 1+2 only | Template text + attributes; skip programmatic script-block strings | |
| C — Layer 1 only | Visible template text first; attributes + programmatic as cleanup pass | |

**User's choice:** A — all three layers, strict I18N-01 compliance
**Notes:** Matches success criteria literally. Includes error messages, toast text, and WebSocket handler strings in addition to template HTML.

---

## Plan Chunking

| Option | Description | Selected |
|--------|-------------|----------|
| A — View-by-view | One plan per route + components plan (~6 plans) | |
| B — Batched by theme | 3-4 plans grouping related routes | ✓ |
| C — Single big pass | 1-2 plans, extract everything at once | |

**User's choice:** B — batched by theme (3-4 plans)
**Notes:** Natural fit with human checkpoint: 3 extraction batches → checkpoint → 1 translation wiring batch.

---

## Claude's Discretion

- Message key naming convention (flat snake_case with view prefix vs nested JSON)
- Message function import location (direct Paraglide vs re-export wrapper)

## Deferred Ideas

None.
