# Phase 3: Groom Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 03-groom-experience
**Areas discussed:** Groom page flow, Sensor challenge mechanic, Minigame feel & theatrics, Scavenger & reward flow

---

## Groom Page Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single page, conditional rendering | groom/+page.svelte reads $gameState and shows the right screen based on state. No route changes — back-button safe on mobile. | ✓ |
| Sub-routes per screen | /groom/trivia, /groom/scavenger, /groom/reward separate routes. Cleaner files but back-button risk. | |

**User's choice:** Single page, conditional rendering

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-chapter flags on Chapter type | `minigameDone` and `scavengerDone` boolean fields on Chapter. Server is authoritative. | ✓ |
| Top-level GameState flags | `currentMinigameDone` / `currentScavengerDone` on GameState directly. | |

**User's choice:** Per-chapter flags on Chapter type

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reward screen persists | Groom stays on reward until admin unlocks next chapter. | ✓ |
| Back to waiting screen | After reward, return to waiting/lobby. | |

**User's choice:** Reward screen persists

---

## Sensor Challenge Mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Tilt meter — fill/empty a bar | Phone tilt controls a vertical meter. Fill to 100% within time limit. Uses existing x-axis from sensors.ts. | ✓ |
| Balance challenge — keep indicator centered | Ball/dot must stay in center zone. More skill-based, harder to read in noisy venue. | |
| Tilt-to-target — hit specific angle | Precision hold-angle challenge. Normalization variance risk across devices. | |

**User's choice:** Tilt meter — fill/empty a bar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Time-based — fill enough within countdown | 15–20s to fill meter to threshold (80%). Consistent with trivia. | ✓ |
| Endurance — hold for X seconds straight | Must hold position for 5s continuously. Resets on slip. | |

**User's choice:** Time-based — fill enough within countdown

---

## Minigame Feel & Theatrics

| Option | Description | Selected |
|--------|-------------|----------|
| Full theatrical — big win/loss screens | Full-screen celebration/loss overlays, haptic, auto-advance 2s. | ✓ |
| Snappy — inline feedback, quick move on | 800ms overlay on top of minigame, then dismiss. Faster pacing. | |

**User's choice:** Full theatrical — big win/loss screens

---

| Option | Description | Selected |
|--------|-------------|----------|
| 6 pairs — emojis | 4×3 grid, 6 bachelor-party themed emoji pairs. No image loading. | ✓ |
| 4 pairs — emojis | 2×4 grid, 4 pairs. Easier — may be too quick for adults. | |
| Admin-configurable cards | Admin sets emoji set in setup form. Adds Phase 2 scope. | |

**User's choice:** 6 pairs — emojis

---

| Option | Description | Selected |
|--------|-------------|----------|
| SVG circle stroke-dashoffset | Circular ring depleting clockwise. Color shifts green→yellow→red. Number in center. | ✓ |
| Arc-only, no number | Same ring but no center text. | |

**User's choice:** SVG circle stroke-dashoffset with number

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed hardcoded values | +50 win, -20 loss for all minigame types. | ✓ |
| Configurable per phase | Admin sets reward/penalty per chapter in setup. Adds setup form fields. | |

**User's choice:** Fixed hardcoded values (+50 win / -20 loss)

---

## Scavenger & Reward Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Groom self-reports, admin can also confirm | "I found it!" button sends SCAVENGER_DONE. Admin has fallback confirm button. | ✓ |
| Admin confirms only | Groom waits for admin to tap confirm. Creates friction. | |

**User's choice:** Groom self-reports (primary), admin confirm (fallback)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — deduct 10 points for a hint | Hints cost -10 points. Real trade-off: struggle vs. pay for help. | ✓ |
| Free hints | No cost. Removes trade-off. | |

**User's choice:** Hint costs -10 points

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all players see the reward | Party and groom page both show reward when scavengerDone flips. Shared group moment. | ✓ |
| Groom only | Reward shows only on groom's screen. Misses RWRD-01. | |

**User's choice:** All players see the reward (groom + party pages)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion on the reward screen | Collapsible "Past Rewards" section below current reward. No extra route. | ✓ |
| Separate /groom/history route | Dedicated history screen. Cleaner but adds navigation. | |

**User's choice:** Accordion on the reward screen

---

## Claude's Discretion

- Confetti/particle implementation for win celebration
- Card flip animation style for memory matching
- Emoji set selection (suggested: 🍻 👑 💀 🥳 💍 🎶)
- Hint button visibility when `scavengerHint` is absent
- Sensor meter easing curves
- Small score indicator on waiting screen (nice-to-have)

## Deferred Ideas

- Admin-configurable emoji sets for memory cards → v2
- Configurable scoring values per chapter → v2
- Dedicated `/groom/history` route → deferred in favor of accordion
