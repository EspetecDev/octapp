# Phase 7: Mobile Bug Fixes - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the two known mobile bugs (FIX-01, FIX-02) and verify no regressions via a fresh three-device join. No new features — strictly bug fixes and verification.

Phase 7 closes when:
1. Android hardware back button during an active session does not navigate away from the game
2. Server survives a simulated unhandled exception (logged to Railway, process keeps running)
3. A fresh three-device join passes with no regressions

Lock-screen reconnect (deferred from Phase 6) and VALID-03 (sensor minigame removed) are NOT in scope.

</domain>

<decisions>
## Implementation Decisions

### FIX-01: Android Back Button Guard
- **D-01:** Apply navigation guard to both `groom` and `party` pages — both roles are active participants in a live session and should not be able to accidentally navigate away.
- **D-02:** Use SvelteKit's `beforeNavigate` hook to cancel client-side navigation. Also push a dummy history entry on mount so the hardware back button triggers `popstate` rather than leaving the page.
- **D-03:** No user-facing confirmation dialog — navigation is silently blocked. The game is a one-time event; interrupting it with "are you sure?" would hurt the experience.

### FIX-02: Server Crash Protection
- **D-04:** The `uncaughtException` handler at `server/index.ts:99` already logs and keeps the process alive. Phase 7 extends it to also handle `unhandledRejection` (Promise rejections), which is the other common crash vector in async Bun servers.
- **D-05:** No process.exit() in either handler — preserving in-memory game state (sessions) is the priority. This matches the existing Phase 5 decision.
- **D-06:** Both handlers use `console.error` so errors appear in Railway logs.

### Verification
- **D-07:** FIX-01 verified manually on real Android: press hardware back button mid-session, confirm page stays.
- **D-08:** FIX-02 verified by temporarily adding a route that throws a sync error (or rejects a Promise), hitting it, then confirming Railway logs show the error and the server is still responding to health checks and WebSocket connections.
- **D-09:** Regression check is a simplified two-device join (admin + groom) — not full three-device if solo testing. Confirms join, chapter unlock, and recap card still work.

### Claude's Discretion
- Exact implementation of the history push-state trick for back button blocking
- Whether `beforeNavigate` alone suffices or a `popstate` listener is also needed
- Exact error text/format for Railway log messages
- How to structure the verification test route (can be removed after testing or left as `/test-crash` — Claude decides)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug requirements
- `.planning/REQUIREMENTS.md` §FIX-01, FIX-02 — acceptance criteria for both bugs

### Existing partial implementation
- `server/index.ts` lines 97-101 — existing uncaughtException handler (Phase 5 safety net, Phase 7 extends it)

### Pages to modify
- `src/routes/groom/+page.svelte` — add beforeNavigate guard here
- `src/routes/party/+page.svelte` — add beforeNavigate guard here

### Phase 7 success criteria
- `.planning/ROADMAP.md` §Phase 7 Success Criteria — 3 specific pass conditions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/index.ts:99` — existing uncaughtException handler (logs only, no exit). Phase 7 adds unhandledRejection alongside it.
- SvelteKit `beforeNavigate` — available in both route pages, no new dependency needed.

### Established Patterns
- `onMount` is already used in `src/routes/groom/+page.svelte` for wake lock and session restoration — back button setup goes in the same `onMount` block.
- `console.error` for server-side logging (matches existing patterns in `server/index.ts`).
- No `process.exit()` anywhere in server code — maintain this.

### Integration Points
- Both page files are self-contained — no shared layout hook needed; guards go directly in each page's `<script>`.
- Server error handlers are at the bottom of `server/index.ts` after `Bun.serve()`.

</code_context>

<specifics>
## Specific Ideas

- No user-specific references — standard SvelteKit `beforeNavigate` + history push pattern.
- Verification test route can be a bare `GET /test-crash` that throws synchronously — quick to add and remove.

</specifics>

<deferred>
## Deferred Ideas

- Lock-screen reconnect formal test — Phase 6 skipped it; Phase 7 ROADMAP does not require it. Dropped.
- VALID-03 (iOS sensor permission gate) — sensor minigame removed entirely; moot.

</deferred>

---

*Phase: 07-mobile-bug-fixes*
*Context gathered: 2026-04-13*
