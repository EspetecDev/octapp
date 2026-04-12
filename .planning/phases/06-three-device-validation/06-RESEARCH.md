# Phase 6: Three-Device Validation - Research

**Researched:** 2026-04-12
**Domain:** Human testing / manual QA of a live Railway deployment
**Confidence:** HIGH (no external libraries to research — domain is test procedure design and codebase behavior analysis)

## Summary

Phase 6 is a pure human-testing checkpoint. No code is written. One person operates three devices (Admin/PC, Groom/Android, Party/Android or second tab) against the live Railway deployment and verifies four specific behaviors: simultaneous join sync, chapter unlock broadcast within 2 seconds, sensor minigame on real Android hardware, and lock-screen reconnect recovery. The phase closes when VALID-01 and VALID-02 pass; the remaining criteria are non-blocking and route failures to Phase 7.

The codebase is already deployed and smoke-tested. The only unknowns are real-device behaviors that the smoke test (single browser tab, no Android hardware) could not exercise: touch events, DeviceMotion API on Android, battery-saver / background tab behavior, and the 35-second heartbeat-guard path that is the reconnect mechanism's iOS mitigation but runs on Android too.

**Primary recommendation:** Design the test script as an ordered sequence with explicit "what to observe on each screen" for every step. The tester is alone with 3 devices — ambiguous steps cause context-switching mistakes that invalidate the test.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When a test step fails, log the failure in SUMMARY.md and continue testing — do NOT block the session for inline fixes.
- **D-02:** All failures discovered during this session are logged as Phase 7 work items.
- **D-03:** Phase 6 closes when VALID-01 and VALID-02 pass. VALID-03 is deferred to Phase 7.
- **D-04:** Verify only the 4 ROADMAP success criteria — join sync, chapter unlock sync, sensor minigame (Android), and lock-screen reconnect. No full game walkthrough.
- **D-05:** The lock-screen reconnect test (success criterion 4) is included but non-blocking — a failure goes to Phase 7.
- **D-06:** Solo test — one person operating multiple devices/tabs simultaneously.
  - Admin: PC/laptop browser tab
  - Groom: Android phone (primary phone)
  - Party member: second Android phone, tablet, or another browser tab
- **D-07:** VALID-03 (iOS DeviceMotion permission gate) is deferred to Phase 7. Android auto-grants DeviceMotion — the iOS-specific permission dialog will not appear.
- **D-08:** Document results as a pass/fail checklist in SUMMARY.md. No screenshots required.

### Claude's Discretion
- Exact wording and structure of the test script steps
- How to set up the admin session (which chapters to configure, which minigames to include)
- Order of test steps within each criterion

### Deferred Ideas (OUT OF SCOPE)
- **VALID-03 (iOS sensor permission gate)** — Deferred to Phase 7. Requires an iPhone as the groom device. Android auto-grants DeviceMotion without the permission dialog, so the iOS-specific gate cannot be validated with Android alone.
- Any bugs discovered during this session — logged to Phase 7.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALID-01 | Admin, Groom, and Party member join simultaneously from 3 real devices; all receive state updates in real-time | Join flow analysis (src/routes/+page.svelte); auto-redirect logic; groom/party role routing confirmed |
| VALID-02 | Admin unlocks a chapter and all 3 devices reflect the change within 2 seconds | UNLOCK_CHAPTER broadcast path confirmed via existing STATE_SYNC architecture; recap card logic in groom page |
| VALID-03 | Groom completes sensor minigame end-to-end on a real iOS device (iOS permission gate) | DEFERRED to Phase 7 per D-03/D-07; Android sensor path can be validated instead |
</phase_requirements>

---

## Standard Stack

No new libraries. This is a pure manual-test phase against the already-deployed stack:

| Asset | Value | Notes |
|-------|-------|-------|
| Live URL | `https://octapp-production.up.railway.app` | Confirmed live, Phase 5 |
| Admin bookmark | `https://octapp-production.up.railway.app/admin?token=ebf5c8b171e554b037df2d4225b3bc65` | Token confirmed masked in Railway logs |
| ADMIN_TOKEN | `ebf5c8b171e554b037df2d4225b3bc65` | Set via Raw Editor, no trailing whitespace |
| WebSocket | `wss://octapp-production.up.railway.app/ws` | Confirmed 101 in smoke test |

## Architecture Patterns

### How VALID-01 (Join Sync) Works in the Codebase

The join flow (`src/routes/+page.svelte`) does:
1. User submits code + name + role → `sendMessage({ type: "JOIN", ... })`
2. Server sends `PLAYER_JOINED` then `STATE_SYNC` to all clients
3. Client watches `gameState` for a player matching `name + role` → `goto("/groom")` or `goto("/party")`
4. `playerId` and `sessionCode` stored in `localStorage` for future reconnects

**What "simultaneous join" means in practice:** All three devices must reach their role-appropriate view (admin dashboard shows the session code; groom lands on `/groom` waiting screen; party member lands on `/party` waiting screen) and each receives `STATE_SYNC` with the player list showing all three connected.

**Auto-redirect on refresh:** If `localStorage` has `octapp:playerId` and `octapp:sessionCode`, the join page shows a spinner and waits up to 4 seconds for `STATE_SYNC`, then routes to the correct page. If the server doesn't respond or the player is not found in state, it clears `localStorage` and shows the form. This is the behavior exercised by the lock-screen test.

### How VALID-02 (Chapter Unlock Sync) Works

Admin sends `UNLOCK_CHAPTER` → server transitions `phase` from `"lobby"` to `"playing"`, sets `activeChapterIndex: 0`, broadcasts `STATE_SYNC` to all clients.

On Groom and Party pages:
- A `$effect` watches `activeChapterIndex`; on first change from `null` to `0`, `showRecap = true` (3-second auto-dismiss timer)
- The `initialSyncDone` guard prevents a false-positive recap card on first connect

**What the tester observes:** All three screens (admin dashboard chapter control changes, groom shows recap card, party shows recap card) must update within 2 seconds of admin tapping "Unlock Chapter."

**Admin setup prerequisite:** At least one chapter must be configured in the setup form before `UNLOCK_CHAPTER` can succeed. `canUnlock` is `false` when `chapterCount === 0`.

### How Lock-Screen Reconnect Works

Source: `src/lib/socket.ts`

The reconnect path has two triggers:

**Trigger A — `onclose` fires (normal disconnect):**
- `connectionStatus` → `"reconnecting"`; exponential backoff starts (500ms base, 2x, +50% jitter, max 30s)
- On reconnect: sends `REJOIN` with stored `playerId` + `sessionCode`
- Server restores full state via `STATE_SYNC`

**Trigger B — iOS heartbeat guard (Pitfall 1 mitigation):**
- Server sends `PING` every 30 seconds
- Client resets a 35-second `setTimeout` on each PING
- If no PING arrives in 35s (iOS kills WS silently without firing `onclose`): `ws.close()` is forced, `connectionStatus` → `"reconnecting"`, reconnect schedules

**What the tester observes on lock-screen test:**
1. Groom's phone is mid-challenge, groom locks it for 15+ seconds
2. On unlock, either:
   - A "Reconnecting..." overlay appears briefly, then dismisses — the heartbeat guard fired and recovered (SUCCESS)
   - The game view reloads with full state instantly — `onclose` fired before 35s and reconnect completed (SUCCESS)
   - The screen is stuck on a "Reconnecting..." overlay with no dismiss — reconnect failed (FAILURE → Phase 7)
   - The page is blank or at the join form with no auto-redirect — `localStorage` was cleared or REJOIN failed (FAILURE → Phase 7)

**Note:** The `connectionStatus` overlay is driven by CSS class `.visible` with fade-out animation (not Svelte `{#if}`) so it will animate even on brief interruptions.

### How the Sensor Minigame Works (Android)

Android auto-grants `DeviceMotion` — no permission dialog appears (VALID-03 deferred per D-07).

The tester still validates the minigame mechanics on Android:
- Sensor normalization: `(reading.x + 9.8) / 9.8` for tilt-right fill; win at normalized `>= 0.8`
- The tilt meter should respond visibly to physical phone movement
- 30-second countdown runs; win/loss overlay appears on completion

This is not VALID-03 (iOS permission gate) but it validates MINI-02 sensor mechanics on real hardware.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test state tracking | Custom tracking spreadsheet | SUMMARY.md pass/fail checklist | D-08 mandates this format; planner writes template |
| Phase 7 work items | Separate tracking system | Failures listed inline in SUMMARY.md | D-02; keeps everything in one file |
| Reconnect verification | Automated test | Human observation of overlay | App is not instrumented for automated reconnect testing; real hardware behavior is what matters |

## Common Pitfalls

### Pitfall 1: Admin session has no chapters configured at test time
**What goes wrong:** Admin opens dashboard, taps "Unlock Chapter" — button is disabled or server rejects it because `chapters.length === 0`.
**Why it happens:** The setup form (`/admin/setup`) is a separate step. The dashboard hides "Configure Game" after the first chapter unlock. If the admin skips setup, there's nothing to unlock.
**How to avoid:** Admin setup is Wave 0 of the test plan. Configure at least 1 chapter (with minigameType `"sensor"` for VALID-02/VALID-03 coverage) before any players join.
**Warning signs:** `canUnlock` is `false` when `chapterCount === 0`; the Unlock button will be absent or disabled on the admin dashboard.

### Pitfall 2: Groom page tries to auto-join via `/api/groom/join` if no stored session
**What goes wrong:** The groom navigates to `/groom` directly without going through the join flow. The page calls `POST /api/groom/join`, which may not exist or may reject if a groom is already registered.
**Why it happens:** `src/routes/groom/+page.svelte` `onMount` has a fallback path that calls `/api/groom/join` when `getStoredPlayerId()` returns `null`.
**How to avoid:** Always join via the root URL `/` with the session code. Never navigate to `/groom` or `/party` directly from a fresh browser tab.
**Warning signs:** Groom page loads but shows "waiting" state even after admin has unlocked a chapter.

### Pitfall 3: Second browser tab shares localStorage with groom tab
**What goes wrong:** If Party member is using a second tab in the same browser as Groom, `localStorage` is shared. The party tab may read the groom's `playerId` and auto-redirect to `/groom`.
**Why it happens:** `localStorage` is per-origin, not per-tab. Both tabs share `octapp:playerId`.
**How to avoid:** Use a different browser (e.g., Chrome for Groom, Firefox for Party) or use a private/incognito window for the second tab.
**Warning signs:** Party tab shows "Reconnecting..." and redirects to `/groom` instead of `/party`.

### Pitfall 4: Lock-screen test must last 15+ seconds (not 5)
**What goes wrong:** Tester locks the phone for only 5 seconds — reconnect fires from `onclose` before the 35s heartbeat guard activates. This tests the easy path (TCP close detected), not the iOS-specific guard (silent kill after 35s).
**Why it happens:** The heartbeat guard fires at 35 seconds. Locking for less than 35s tests only the normal `onclose` path.
**How to avoid:** For a complete test, lock the phone for at least 40 seconds. However, even the `onclose` path passing is a valid PASS for the reconnect criterion — both paths lead to the same REJOIN flow.
**Note:** ROADMAP says "lock for 15 seconds." This is sufficient to test the `onclose` path and confirm the overlay dismisses. The 35s guard test is a bonus.

### Pitfall 5: Recap card does not appear if groom/party joined after chapter was already unlocked (late join)
**What goes wrong:** Party device joins after admin has already unlocked Chapter 1. The `initialSyncDone` guard sets `recapChapterIndex = 1` on the first `STATE_SYNC`, suppressing the recap card.
**Why it happens:** By design — late joiners don't see recap cards for chapters they missed (Pitfall 4 guard in codebase).
**How to avoid:** For VALID-02, all three devices must join BEFORE admin unlocks the first chapter. The test script must enforce this ordering.
**Warning signs:** Party screen jumps straight to minigame view with no recap card — not a bug, just wrong test order.

### Pitfall 6: Android back button navigates away during test
**What goes wrong:** Tester accidentally taps Android hardware back button — Chrome navigates back, leaving the active session. This is a known bug tracked as FIX-01 in Phase 7.
**Why it happens:** FIX-01 is not yet implemented. The back button has default browser behavior.
**How to avoid:** Brief tester during test script: do not press Android back button. If it happens, note it as a FIX-01 failure and re-join.
**Warning signs:** Browser navigates to the join page mid-session with no user action.

### Pitfall 7: Solo tester cognitive load — wrong device order
**What goes wrong:** Solo tester performing actions on the wrong device (e.g., submitting join form on the PC tab instead of the Android phone).
**Why it happens:** Three active screens, context switching.
**How to avoid:** Test script must label every action with the device name in ALL CAPS (e.g., "On ADMIN (PC):") and sequence actions one device at a time.

## Admin Setup Guide (Claude's Discretion — D-06 bullet)

The planner must include a Wave 0 task that walks the tester through admin setup. Minimum viable configuration for this test:

**One chapter is sufficient.** Configure it as:
- Chapter name: anything (e.g., "Test Chapter")
- Minigame type: **sensor** (validates MINI-02/VALID-03-android and can observe tilt behavior)
- Trivia pool: not needed (sensor type)
- Scavenger clue: any text (e.g., "Find something red nearby")
- Scavenger hint: optional
- Reward: any text (e.g., "You win!")
- Power-up catalog: can leave empty for this test
- Starting tokens: 0 is fine

**Why sensor minigame:** It covers the most hardware-specific behavior (DeviceMotion API on real Android) and is the closest analog to VALID-03. Trivia or Memory would also work but don't exercise sensor hardware.

**Setup URL:** `https://octapp-production.up.railway.app/admin/setup?token=ebf5c8b171e554b037df2d4225b3bc65`

**Important:** Setup must be saved (tap "Save Setup") before the test begins. The admin dashboard link "Configure Game" is only visible while in lobby state — it disappears after the first `UNLOCK_CHAPTER`.

## Test Step Sequence Design (Claude's Discretion)

The planner must produce a single ordered test script. Recommended structure:

**Wave 0 — Pre-session setup (Admin only)**
1. Open admin bookmark on PC
2. Navigate to setup, configure 1 sensor chapter, save
3. Return to admin dashboard; confirm session code is displayed

**Wave 1 — VALID-01: Simultaneous join**
1. On GROOM (Android): navigate to live URL, enter code, name, select "I'm the Groom", tap Join
2. On PARTY (second device): navigate to live URL, enter code, name, select "I'm in the Group", tap Join
3. On ADMIN (PC): observe player list — confirm Groom and Party names appear
4. On GROOM: confirm waiting screen shows session active
5. On PARTY: confirm party waiting screen shows session active
6. PASS criterion: all 3 screens show their correct role views, admin player list shows both players

**Wave 2 — VALID-02: Chapter unlock sync**
1. On ADMIN (PC): tap "Unlock Chapter" (or "Start Game" button if in lobby)
2. Immediately watch all three screens
3. On GROOM: recap card must appear within 2 seconds
4. On PARTY: recap card must appear within 2 seconds
5. On ADMIN: chapter index advances in dashboard
6. PASS criterion: both groom and party show the chapter transition card within 2 seconds

**Wave 3 — Sensor minigame (Android hardware validation, non-blocking)**
1. On GROOM (Android): sensor minigame is active (groom page shows sensor screen)
2. Tap "Enable Sensor" / permission button (note: on Android, no OS dialog will appear — this is expected per D-07)
3. Physically tilt the phone — confirm tilt meter responds on screen
4. Hold phone tilted right until win condition (`normalized >= 0.8`) or wait for 30s timeout
5. Observe win/loss overlay
6. PASS criterion: tilt meter responds to physical movement; win/loss overlay appears

**Wave 4 — Lock-screen reconnect (non-blocking per D-05)**
1. With groom session active and on a screen, lock the Android phone
2. Wait at least 15 seconds (30+ to exercise heartbeat path)
3. Unlock the phone
4. On GROOM: observe screen behavior
5. PASS criterion: game view restores without manual page reload; "Reconnecting..." overlay may briefly appear but dismisses; game state is intact

## State of the Art

| Behavior | Expected on Android | Notes |
|----------|---------------------|-------|
| DeviceMotion permission | Auto-granted, no dialog | iOS shows a dialog; Android does not |
| Lock-screen WebSocket | `onclose` fires quickly OR 35s heartbeat guard triggers | Both paths end with REJOIN |
| Back button | Navigates away (known FIX-01 bug) | Document as Phase 7 work item if it occurs |
| Wake Lock during minigame | `navigator.wakeLock.request("screen")` — may not prevent lock on all Android versions | If phone locks DURING minigame, that is a MOBX-03 regression |

## Phase 7 Failure Logging Format

When a failure is found, log it in SUMMARY.md with:
```
## Phase 7 Work Items

- [ ] [CRITERION]: [what failed] — [observed behavior] vs [expected behavior]
  - Example: `VALID-02`: recap card appeared on groom but not on party device — Android Chrome tab was backgrounded
```

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| Live Railway URL | All validation | Confirmed (Phase 5) | `https://octapp-production.up.railway.app` |
| Android phone (groom) | VALID-01, VALID-02, sensor test | Tester must supply | Primary Android phone |
| Second device (party) | VALID-01, VALID-02 | Tester must supply | Second Android phone, tablet, or second browser (different from groom browser) |
| PC/laptop browser | VALID-01, VALID-02 | Assumed available | Admin role |

**Missing dependencies with no fallback:**
- At least one Android phone is required for the sensor minigame step. A second browser tab on the same PC can serve as Party for VALID-01/VALID-02, but cannot test the sensor path.

**Missing dependencies with fallback:**
- If only one phone is available: Party role can be a second browser tab (different browser or incognito) on the PC. VALID-01 and VALID-02 can still pass. Lock-screen test (Wave 4) cannot be performed with a browser tab — it requires a physical phone.

## Open Questions

1. **Does the sensor minigame "tap to enable" button actually trigger DeviceMotion on Android, or does it silently no-op?**
   - What we know: `requestPermission` is called from the button's `onclick` handler (iOS hard constraint). On Android, `DeviceMotionEvent.requestPermission` is `undefined` and the code falls through to start listening immediately.
   - What's unclear: Whether the SensorMinigame component handles the `undefined` case gracefully or throws.
   - Recommendation: Watch the browser console on Android during the sensor test. If the meter doesn't move, check for JS errors.

2. **Does the REJOIN handler restore mid-minigame state correctly?**
   - What we know: Server sends `STATE_SYNC` with full `gameState` on reconnect (SESS-06, SYNC-02).
   - What's unclear: If the groom is mid-minigame countdown when they reconnect, does the local timer resume from a sensible position or reset?
   - Recommendation: Document the observed behavior; if timer resets to full on reconnect, log as Phase 7 work item.

3. **Can the Party "second tab" in the same browser share localStorage with the Groom tab?**
   - What we know: Yes — `localStorage` is per-origin not per-tab.
   - Recommendation: PLAN must explicitly state "use a different browser or incognito window" for Party if the same PC is used. This is a tester instruction, not a code fix.

## Sources

### Primary (HIGH confidence)
- `src/lib/socket.ts` — ReconnectingWebSocket class, heartbeat timer (35s), REJOIN flow, backoff algorithm — read directly
- `src/routes/+page.svelte` — Join form, auto-redirect logic, localStorage keys, 4-second give-up timer — read directly
- `src/routes/groom/+page.svelte` — screen router, recap card `$effect`, initialSyncDone guard — read directly
- `src/routes/admin/+page.svelte` — canUnlock derived, UNLOCK_CHAPTER message — read directly
- `src/routes/admin/setup/+page.svelte` — setup form validation, chapter structure — read directly
- `.planning/phases/05-railway-deploy-smoke-test/05-02-SUMMARY.md` — confirmed live URL, ADMIN_TOKEN, health green
- `.planning/phases/05-railway-deploy-smoke-test/05-03-SUMMARY.md` — confirmed WebSocket 101, wss://, admin gate working

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` §VALID-01/02/03 — acceptance criteria text
- `.planning/ROADMAP.md` §Phase 6 Success Criteria — 4 specific success criteria
- `.planning/STATE.md` — heartbeat guard rationale, REJOIN pattern, initialSyncDone guard origin

### Tertiary (LOW confidence)
- None — all findings are backed by direct codebase reads

## Metadata

**Confidence breakdown:**
- Test procedure design: HIGH — based on direct codebase analysis
- Lock-screen reconnect behavior on real Android hardware: MEDIUM — codebase path is clear, but actual Android behavior is untested (that's exactly what this phase validates)
- Sensor minigame on Android: MEDIUM — normalization math confirmed, but DeviceMotion availability on specific Android models is unknown until tested

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable phase — no external library changes; only changes if codebase is modified before testing)
