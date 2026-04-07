# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 01-foundation
**Areas discussed:** Project structure, WebSocket client library, Player join UX flow, Styling approach

---

## Project Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat monorepo | Single package.json, `src/` = SvelteKit, `server/` = Bun WS | ✓ |
| Two packages | `client/` and `server/` as separate packages with workspace tooling | |
| SvelteKit + WS on same port | Use SvelteKit hooks for WS upgrades, no separate process | |

**User's choice:** Flat monorepo

| Option | Description | Selected |
|--------|-------------|----------|
| One Railway service | Bun serves static build + WS on same URL | ✓ |
| Two Railway services | Frontend on one service, backend on another | |

**User's choice:** One Railway service

---

## WebSocket Client Library

**Context provided:** User raised concern about bad internet / mobile connections while travelling (e.g. in a car). Discussed whether WebSocket is appropriate vs. polling or SSE.

**Analysis shared:** For 10 players, the reconnect + full state snapshot pattern (SESS-06 + SYNC-02) already handles drops gracefully. A 5-10 second reconnect during a phase unlock is acceptable for a party game. Polling every 2s would be maximally resilient but adds noticeable lag during minigame timing. WebSocket + reconnect is the right balance.

| Option | Description | Selected |
|--------|-------------|----------|
| Custom WebSocket wrapper | Native WS + thin reconnect with exponential backoff | ✓ |
| Polling every 1–2 seconds | Stateless HTTP, maximally resilient, 1-2s lag | |
| Socket.IO | Built-in reconnect + fallback, ~40KB bundle | |

**User's choice:** Custom WebSocket wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| Full state snapshot on every event | Server sends complete state object after any change | ✓ |
| Delta messages | Server sends only changed fields | |

**User's choice:** Full state snapshot on every event

---

## Player Join UX Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard | Code → name+role → waiting screen, one step at a time | ✓ |
| Single-page form | All fields on one screen, single submit | |

**User's choice:** Multi-step wizard

| Option | Description | Selected |
|--------|-------------|----------|
| Name + role + connected players list | Live list of who has joined | ✓ |
| Minimal holding message | Just "Waiting for the game to start..." | |

**User's choice:** Name + role + connected players list

| Option | Description | Selected |
|--------|-------------|----------|
| Block + inline message | Groom option greyed out with "already taken" message | ✓ |
| Allow selection, error after submit | Post-submit server-side rejection | |

**User's choice:** Block + inline message (before submit)

---

## Styling Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind CSS | Utility-first, consistent tokens across phases | ✓ |
| Scoped CSS (Svelte default) | Per-component `<style>` blocks | |
| CSS Modules | Class-based scoping | |

**User's choice:** Tailwind CSS

| Option | Description | Selected |
|--------|-------------|----------|
| Dark, high-energy, nightlife feel | Dark bg, vibrant accents (purple/neon/gold) | ✓ |
| Bold and playful | Bright saturated colors, fun typography | |
| You decide | Defer to Claude, revisit in Phase 2 | |

**User's choice:** Dark, high-energy, nightlife feel

---

## Claude's Discretion

- Admin token UX (query param interpretation)
- Exact font choices within nightlife theme
- Loading/spinner treatment
- Specific Tailwind color palette values
- Dev tooling configuration

## Deferred Ideas

None.
