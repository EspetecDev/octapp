# Phase 6: Three-Device Validation - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-device testing of the live Railway deployment. Admin (PC/laptop), Groom (phone), and one Party member (phone) join the same session simultaneously and run through the validation checklist. No new code is written in this phase — only the deployed app is tested.

Phase 6 closes when VALID-01 and VALID-02 pass. VALID-03 (iOS sensor permission gate) is deferred to Phase 7 because the test will use Android as the groom device, which auto-grants DeviceMotion access without showing the iOS permission dialog.

</domain>

<decisions>
## Implementation Decisions

### Issue handling
- **D-01:** When a test step fails, log the failure in SUMMARY.md and continue testing — do NOT block the session for inline fixes.
- **D-02:** All failures discovered during this session are logged as Phase 7 work items.
- **D-03:** Phase 6 closes when VALID-01 and VALID-02 pass. VALID-03 is deferred to Phase 7.

### Test scope
- **D-04:** Verify only the 4 ROADMAP success criteria — join sync, chapter unlock sync, sensor minigame (Android), and lock-screen reconnect. No full game walkthrough.
- **D-05:** The lock-screen reconnect test (success criterion 4) is included but non-blocking — a failure goes to Phase 7.

### Session setup
- **D-06:** Solo test — one person operating multiple devices/tabs simultaneously.
  - Admin: PC/laptop browser tab
  - Groom: Android phone (primary phone)
  - Party member: second Android phone, tablet, or another browser tab
- **D-07:** VALID-03 (iOS DeviceMotion permission gate) is deferred to Phase 7. Android auto-grants DeviceMotion — the iOS-specific permission dialog will not appear.

### Evidence
- **D-08:** Document results as a pass/fail checklist in SUMMARY.md. No screenshots required.

### Claude's Discretion
- Exact wording and structure of the test script steps
- How to set up the admin session (which chapters to configure, which minigames to include)
- Order of test steps within each criterion

</decisions>

<specifics>
## Specific Ideas

- Live Railway URL: `https://octapp-production.up.railway.app`
- Admin bookmark: `https://octapp-production.up.railway.app/admin?token=ebf5c8b171e554b037df2d4225b3bc65`
- ADMIN_TOKEN: `ebf5c8b171e554b037df2d4225b3bc65`
- Groom and Party devices are Android (or any non-iOS device)
- "All 3 screens simultaneously" for VALID-01/02 means watching all devices at once — solo tester needs them physically in view

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and REQUIREMENTS.md.

### Acceptance criteria
- `.planning/REQUIREMENTS.md` §VALID-01, VALID-02, VALID-03 — the 3 validation acceptance criteria
- `.planning/ROADMAP.md` §Phase 6 Success Criteria — 4 specific success criteria including lock-screen reconnect

### Deployment context
- `.planning/phases/05-railway-deploy-smoke-test/05-02-SUMMARY.md` — Live URL, ADMIN_TOKEN, Railway health confirmed
- `.planning/phases/05-railway-deploy-smoke-test/05-03-SUMMARY.md` — Smoke test results (WebSocket 101, admin gate working)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No new code in this phase — app is already deployed and tested for health.

### Established Patterns
- Reconnect after lock screen: `src/lib/socket.ts` — iOS heartbeat guard (35s timer), exponential backoff reconnect. Untested on real hardware — this is what the lock-screen test (criterion 4) validates.
- Join flow: `src/routes/+page.svelte` — 6-char join code, auto-redirect on refresh for previously joined players.

### Integration Points
- All validation is against `https://octapp-production.up.railway.app` — no local server needed.

</code_context>

<deferred>
## Deferred Ideas

- **VALID-03 (iOS sensor permission gate)** — Deferred to Phase 7. Requires an iPhone as the groom device. Android auto-grants DeviceMotion without the permission dialog, so the iOS-specific gate cannot be validated with Android alone.
- Any bugs discovered during this session — logged to Phase 7.

</deferred>

---

*Phase: 06-three-device-validation*
*Context gathered: 2026-04-12*
