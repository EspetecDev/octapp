# Phase 2: Admin & Game Structure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 02-admin-game-structure
**Areas discussed:** Content setup flow, Phase data model, Admin dashboard layout, New chapter recap card

---

## Content Setup Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Separate /admin/setup route | Pre-event config lives at /admin/setup, live night control stays at /admin | ✓ |
| Same /admin page, tabbed | Setup tab + Live Control tab on the same page | |
| Same /admin page, scrollable | Setup form above, dashboard below | |

**User's choice:** Separate /admin/setup route
**Notes:** Clean separation — setup is a different job than running the night.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All chapters on one page | Accordion or stacked sections, one section per chapter | ✓ |
| Chapter-by-chapter wizard | Step through one chapter at a time | |
| Flat form, all fields together | Trivia questions pooled, all scavenger clues together, all rewards together | |

**User's choice:** All chapters on one page

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button on /admin when in lobby | "Configure Game" button during lobby; disappears once first chapter unlocked | ✓ |
| Always accessible via nav link | Persistent link at top of /admin | |
| Separate URL, no nav link | Admin navigates directly to /admin/setup?token=... | |

**User's choice:** Button on /admin when in lobby

---

## Phase Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed at 3 chapters | Simple, maps to dinner/bar/club night arc | |
| Admin sets the number (1–5) | Flexible, variable-length chapter array | ✓ |
| Fixed at 5 chapters | More content, longer night | |

**User's choice:** Admin sets the number (1–5)

---

| Option | Description | Selected |
|--------|-------------|----------|
| One question per chapter | Simple, predictable, admin knows exactly which question | |
| Pool per chapter (3 questions, server picks one) | More variety, server tracks which was asked | ✓ |
| Global pool, drawn in order | One big list across all chapters | |

**User's choice:** Pool per chapter

---

| Option | Description | Selected |
|--------|-------------|----------|
| Admin picks per chapter | Admin selects minigame type for each chapter | ✓ |
| Auto-cycle in order (trivia → sensor → memory) | No choice needed, inflexible | |
| Same type all night | Admin picks one type for all chapters | |

**User's choice:** Admin picks per chapter

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold scores in state, display zeros | Add scores object to GameState now; Phase 3 populates | ✓ |
| Skip scores entirely in Phase 2 | Phase 3 adds scores when minigames are implemented | |
| Placeholder score display only | Static "Scores will appear here" | |

**User's choice:** Scaffold scores in state, display zeros

---

## Admin Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical zones: code → chapter control → players → scores | Stacked layout, mobile-friendly | ✓ |
| Tabs: Control / Players / Scores | Three tabs, clean separation, requires tapping to switch | |

**User's choice:** Vertical zones

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant unlock, no confirmation | One tap, fast, decisive | ✓ |
| Confirm dialog before unlocking | "Are you sure?" prompt | |
| Hold to confirm (press and hold 2s) | Prevents accidental taps | |

**User's choice:** Instant unlock, no confirmation

---

## New Chapter Recap Card

| Option | Description | Selected |
|--------|-------------|----------|
| Chapter name + number only | e.g. "Chapter 2: The Bar" — theatrical, no spoilers | ✓ |
| Chapter name + what's coming next | Slightly spoils the reveal | |
| Full-screen cinematic splash | Large number, bold name, tagline | |

**User's choice:** Chapter name + number only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss after 3 seconds | Everyone advances together automatically | ✓ |
| Groom taps to dismiss | Groom controls timing | |
| Admin dismisses from dashboard | Admin controls exact timing, second action required | |

**User's choice:** Auto-dismiss after 3 seconds

---

## Claude's Discretion

- Exact accordion/expand behavior for setup form
- Visual treatment of the recap card (full-screen overlay vs. card modal)
- Power-up catalog setup form layout
- WebSocket message type names for new server events
- Error handling for setup form validation

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
