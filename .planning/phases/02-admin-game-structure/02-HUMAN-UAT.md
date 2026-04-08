---
status: partial
phase: 02-admin-game-structure
source: [02-VERIFICATION.md]
started: 2026-04-08T18:30:00Z
updated: 2026-04-08T18:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end Setup Flow
expected: Navigate to `/admin/setup?token=ADMIN_TOKEN`. Add a chapter with a name, one trivia question, scavenger clue, and reward. Click Save Setup. Button flashes green "Saved" for ~1.5s, then returns to "Save Setup". Refresh the page — form reappears with same data.
result: [pending]

### 2. Recap Card Overlay — Theatrical Quality
expected: With admin and at least one player connected, unlock a chapter from the admin dashboard. Groom and party pages show full-screen dark overlay with "CHAPTER" label, chapter number (large), chapter name in amber (#f59e0b), "N of M" progress — fades out after 3 seconds.
result: [pending]

### 3. Late-Joiner Guard
expected: Unlock Chapter 1. Then open a new browser tab and join as a group player. Navigate to the party page. Recap card does NOT appear. The player sees the waiting screen directly.
result: [pending]

### 4. Configure Game Link Disappears After First Unlock
expected: Admin dashboard in lobby state — "Configure Game" link is visible. Click "Unlock Chapter 1". Observe dashboard. "Configure Game" link disappears immediately after unlock; Zone 3 shows "Chapter 1 of N — active".
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
