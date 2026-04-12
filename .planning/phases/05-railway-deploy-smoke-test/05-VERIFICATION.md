---
phase: 05-railway-deploy-smoke-test
verified: 2026-04-12T00:00:00Z
status: human_needed
score: 7/9 must-haves verified
human_verification:
  - test: "Confirm Railway logs show 'Admin token: ***' (masked) and NOT the raw token value"
    expected: "Railway log viewer displays '***' or auto-redacts the ADMIN_TOKEN value — the source code logs the raw token (process.env.ADMIN_TOKEN ?? '(not set)'), so either Railway redacts it automatically or the SUMMARY report is inaccurate"
    why_human: "Cannot determine cloud-side log redaction behavior from codebase alone; server/index.ts line 11 logs the raw env var, not a masked form"
  - test: "Confirm REQUIREMENTS.md DEPLOY-02 checkbox should be marked complete"
    expected: "DEPLOY-02 checkbox is '[x]' given smoke test confirmed admin routes return 401 without valid token in production"
    why_human: "REQUIREMENTS.md still shows '[ ] DEPLOY-02' (incomplete) but all smoke test evidence confirms the requirement is satisfied; the document needs updating"
---

# Phase 5: Railway Deploy & Smoke Test Verification Report

**Phase Goal:** The app is live on a public Railway URL with ADMIN_TOKEN secured, and a single user can verify the WebSocket connection is healthy before any real-device testing begins.
**Verified:** 2026-04-12
**Status:** human_needed (all automated checks pass; two items need human confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Server handles an unexpected thrown exception without crashing the process | VERIFIED | `process.on("uncaughtException")` present at server/index.ts:99 in committed HEAD |
| 2 | railway.toml healthcheckTimeout is 30s (not 10s) | VERIFIED | railway.toml line 7: `healthcheckTimeout = 30` |
| 3 | Changes committed and pushed to main for Railway auto-deploy | VERIFIED | origin/main is up to date (`fe7335b`); all hardening commits present |
| 4 | Railway project exists and is connected to the GitHub repo on branch main | VERIFIED | 05-02-SUMMARY.md confirms; URL https://octapp-production.up.railway.app live |
| 5 | ADMIN_TOKEN is set in Railway Variables with the exact value | VERIFIED | 05-02-SUMMARY.md confirms set via Raw Editor |
| 6 | First deploy succeeded and a public Railway domain is generated | VERIFIED | 05-02-SUMMARY.md: health check green, URL known |
| 7 | Railway logs show 'Admin token: ***' (masked, not '(not set)') | UNCERTAIN | SUMMARY claims `***` but server/index.ts line 11 logs raw token value — see below |
| 8 | Join page loads with no console errors; GET /health returns 200 | VERIFIED | 05-03-SUMMARY.md confirms all smoke test checks passed |
| 9 | Network tab shows 101 Switching Protocols; wss:// protocol confirmed | VERIFIED | 05-03-SUMMARY.md confirms 101 and wss:// |
| A | Admin dashboard loads with correct token and shows session code; wrong token returns 401 | VERIFIED | 05-03-SUMMARY.md confirms all four admin gate checks passed |

**Score:** 9/10 truths verified (1 uncertain)

---

## Required Artifacts

### Plan 05-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/index.ts` | uncaughtException handler — process survives thrown errors | VERIFIED | Line 99–101: `process.on("uncaughtException", (err) => { console.error(...); })` — no `process.exit()` call |
| `railway.toml` | Deploy config with 30s health timeout | VERIFIED | Line 7: `healthcheckTimeout = 30`; no `drainingSeconds`; no `numReplicas` |

### Plan 05-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/05-railway-deploy-smoke-test/05-02-SUMMARY.md` | Live Railway URL recorded for Plan 03 | VERIFIED | File exists; records URL `https://octapp-production.up.railway.app` and admin bookmark |

### Plan 05-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/05-railway-deploy-smoke-test/05-03-SUMMARY.md` | Smoke test pass record — required before Phase 6 begins | VERIFIED | File exists; all six smoke test checks marked `[x]` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/index.ts` | Railway process | `process.on("uncaughtException")` | VERIFIED | Pattern present at line 99; handler does not call process.exit() |
| `railway.toml` | Railway deploy pipeline | `healthcheckTimeout = 30` | VERIFIED | Exact key present; no forbidden keys (drainingSeconds, numReplicas) |
| GitHub repo main branch | Railway deploy pipeline | GitHub integration auto-deploy on push | VERIFIED | origin/main up to date; commits visible in log |
| ADMIN_TOKEN env var | server/index.ts admin gate | `process.env.ADMIN_TOKEN` at runtime | VERIFIED | Line 27: `token !== process.env.ADMIN_TOKEN` comparison; 401 on mismatch |
| Browser Network tab WS filter | /ws endpoint | 101 Switching Protocols response | VERIFIED (human) | 05-03-SUMMARY confirms 101 and wss:// observed in DevTools |
| `/admin?token=` URL | server ADMIN_TOKEN gate | query param token comparison | VERIFIED (human) | 05-03-SUMMARY confirms correct token grants access; wrong token returns 401 |

---

## Data-Flow Trace (Level 4)

Not applicable — Phase 05 contains no new components that render dynamic data. All artifacts are server config (`railway.toml`) or server process stability (`server/index.ts uncaughtException`).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| uncaughtException handler present and does not call process.exit() | `grep -c "process.exit" server/index.ts` | 0 matches | PASS |
| healthcheckTimeout is 30 (not 10) | `grep "healthcheckTimeout" railway.toml` | `healthcheckTimeout = 30` | PASS |
| drainingSeconds absent from railway.toml | `grep "drainingSeconds" railway.toml` | no match | PASS |
| Admin token gate returns 401 on mismatch | `grep -A2 "Unauthorized" server/index.ts` | Line 28: `return new Response("Unauthorized", { status: 401 })` | PASS |
| Railway URL reachable (smoke test summary) | 05-03-SUMMARY.md | All 6 checks marked [x] | PASS (human-verified) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPLOY-01 | 05-01-PLAN.md | App is deployed to Railway and accessible via a public URL | SATISFIED | URL `https://octapp-production.up.railway.app` live; join page loads confirmed in 05-03-SUMMARY |
| DEPLOY-02 | 05-02-PLAN.md, 05-03-PLAN.md | ADMIN_TOKEN env var is set; admin routes return 401 without it in production | SATISFIED (doc gap) | 05-03-SUMMARY confirms 401 on wrong/missing token in production; but REQUIREMENTS.md still shows `[ ]` (not checked off) |

### Requirements Doc Gap

REQUIREMENTS.md at `.planning/REQUIREMENTS.md` line 151 shows `[ ] **DEPLOY-02**` — still marked pending. All evidence from 05-02 and 05-03 summaries confirms the requirement is met. The checkbox needs to be updated to `[x]`.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/index.ts` | 11 | `console.log(\`[octapp] Admin token: ${process.env.ADMIN_TOKEN ?? "(not set)"}\`)` | Warning | Logs the raw ADMIN_TOKEN value in plaintext at startup. The SUMMARY claims logs show `***` (masked), but this is inconsistent with the code. Railway's log viewer may auto-redact secrets, but that is not guaranteed. If Railway does NOT redact, the token appears in logs in full — a minor security concern for a party app, but notable. |

---

## Human Verification Required

### 1. Admin Token Log Masking

**Test:** Deploy the current server/index.ts to Railway (or check existing Railway logs from the most recent deploy).
**Expected:** Logs show either `[octapp] Admin token: ***` (Railway auto-redacts) or the full token value.
**Why human:** The source code at `server/index.ts` line 11 logs `process.env.ADMIN_TOKEN` directly without masking. The 05-02-SUMMARY claims `***` was observed. If Railway does NOT auto-redact, the token is visible in logs to anyone with Railway dashboard access. This is low risk for a party app but the claim in the SUMMARY may not match actual log output.

### 2. Update REQUIREMENTS.md DEPLOY-02 Checkbox

**Test:** Open `.planning/REQUIREMENTS.md` and manually update `[ ] **DEPLOY-02**` to `[x] **DEPLOY-02**`.
**Expected:** The checkbox reflects the actual completed state confirmed by smoke testing.
**Why human:** This is a documentation maintenance task — the requirement IS satisfied based on all evidence, but the document needs updating before Phase 6 begins.

---

## Notable Observations

### Working Tree Has Uncommitted Changes to server/index.ts

The current working copy of `server/index.ts` includes a `/api/groom/join` endpoint and additional imports (`getState`, `setState`) that are **not yet committed**. These are post-Phase-5 changes added by subsequent bug fixes. The Railway-deployed version is based on the committed HEAD (`fe7335b`), which includes the uncommitted groom auto-join endpoint (it's in the working diff but HEAD also has it — see git diff output: the diff shows additions in the working tree, but `git show HEAD:server/index.ts` confirmed the committed version DOES contain the endpoint).

Clarification: `git status` shows `server/index.ts` as modified in the working tree. The diff confirms the working copy has the `/api/groom/join` endpoint while HEAD does not — meaning these changes are staged for a future commit. This is post-Phase-5 work and does not affect Phase 5 goal verification.

### Plan 05-01 Push Blocker Was Resolved

The 05-01-SUMMARY documented Task 3 (git push) as BLOCKED because no GitHub remote was configured at the time. Subsequently, the remote was added (`git@github.com:EspetecDev/octapp.git`) and all commits were pushed. `origin/main` is now up to date with local HEAD.

---

## Gaps Summary

No blocking gaps. All Phase 5 must-haves are either verified by code inspection or confirmed by human-completed summary files (Plans 02 and 03 were human-action checkpoints by design). Two items require human follow-up:

1. The admin token log masking claim in SUMMARY may be inaccurate (code logs raw value; Railway may auto-redact or may not).
2. REQUIREMENTS.md DEPLOY-02 checkbox is still marked `[ ]` and should be updated to `[x]`.

Neither item blocks Phase 6 from beginning.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
