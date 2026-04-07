# Phase 1: Foundation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the full technical foundation: project scaffolding (SvelteKit 5 + Bun WebSocket server), player session join flow, WebSocket connection lifecycle with auto-reconnect, and mobile viewport basics. After this phase, any player can navigate to the app URL, enter a join code, pick a name and role, and maintain a reliable real-time connection throughout the night — including auto-recovery from drops.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **D-01:** Flat monorepo — single `package.json` at root. `src/` is SvelteKit, `server/` is the Bun WebSocket server. Two entry points, one repo.
- **D-02:** One Railway service — Bun serves the SvelteKit static build and handles WebSocket upgrades on the same port/URL. No separate services, no CORS configuration needed.

### WebSocket Layer
- **D-03:** Custom WebSocket wrapper with exponential backoff — no Socket.IO. Native browser WebSocket + a thin reconnect class. Lighter, no extra dependencies, full control.
- **D-04:** Full state snapshot on every server-sent event — no delta messages. Server sends the complete game state object after any change. Simple to reason about, no client-side merge logic, trivial payload size at ≤10 players.
- **D-05:** The reconnect + full state snapshot pattern is the answer to bad internet / mobile drops. When a connection is lost: show "Reconnecting..." overlay → exponential backoff → on reconnect, receive full current state → dismiss overlay. No events are missed because state is always authoritative.

### Player Join UX Flow
- **D-06:** Multi-step wizard — one thing per screen:
  1. Enter 6-character join code
  2. Enter display name + select role (Groom or Group Member)
  3. Waiting screen
- **D-07:** Waiting screen shows the player's own name/role + a live list of all currently connected players. Updates in real-time as others join.
- **D-08:** Groom role claim — when already taken, the Groom option is greyed out inline with a message like "Groom role already taken". Player must select Group Member. Validation is immediate (before submit), not post-submit.

### Styling
- **D-09:** Tailwind CSS — utility-first, consistent design tokens across all four phases. Standard SvelteKit + Tailwind setup.
- **D-10:** Visual theme — dark, high-energy, nightlife feel. Dark background (e.g. `#0d0d0d`), vibrant accent colors (electric purple, neon green, or gold). Appropriate for a bachelor party running through the night.

### Claude's Discretion
- Admin authentication UX (query param vs. prompt) — requirements say "secret token via env var", success criteria say "admin visits /admin with the secret token"; implement as a `?token=` query param check is the natural interpretation
- Exact font choices within the dark/nightlife theme
- Loading skeleton / spinner treatment
- Specific Tailwind color palette values (within the dark + vibrant accent direction)
- Dev tooling details (ESLint, Prettier, TypeScript strictness)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Tech Foundation (TECH-01–05) — SvelteKit 5, Bun WS, Railway, reconnect wrapper, sensor normalization
- `.planning/REQUIREMENTS.md` §Session & Joining (SESS-01–06) — join code, player roles, groom uniqueness, reconnect + state restore
- `.planning/REQUIREMENTS.md` §Real-Time Sync (SYNC-01–04) — 500ms broadcast SLA, full state on reconnect, heartbeat, reconnecting overlay
- `.planning/REQUIREMENTS.md` §Mobile UX (MOBX-01–05) — 100dvh, touch targets, Wake Lock, landscape overlay, SSR disabled

### Project
- `.planning/PROJECT.md` — Core constraints: mobile web only, Railway deployment, ≤10 players, one-time event (no persistence needed)

No external specs or ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — codebase is empty. Phase 1 establishes all patterns.

### Established Patterns
- None yet — decisions made here become the project conventions.

### Integration Points
- All future phases (2–4) will extend the SvelteKit routes, Bun server, and WebSocket message protocol established in this phase.

</code_context>

<specifics>
## Specific Ideas

- Dark background: `#0d0d0d` or similar near-black
- Accent palette: electric purple / neon green / gold (one primary accent to be locked in Phase 2 when more UI exists)
- Tailwind should be configured with a custom theme extending the base (not replacing it)
- The "Reconnecting..." overlay must be non-blocking — players shouldn't be able to interact while disconnected, but the overlay should be lightweight (no full-screen modal)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-07*
