# Phase 4: Group Economy & Multiplayer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 04-group-economy-multiplayer
**Areas discussed:** Token earning mechanic, Group view layout during challenge, Announcement design, Distraction overlay content

---

## Token Earning Mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel trivia question | Group gets their own question to answer while groom plays. Correct = token reward. | |
| Reaction tap button | Tap to earn 1 token, capped per challenge. Simple, mobile-friendly. | ✓ |
| Fixed grant at chapter start only | Everyone gets X tokens on chapter unlock, no mid-challenge earning. | |

**User's choice:** Reaction tap button — each tap earns 1 token, max 5 per challenge.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap to earn | Each tap = 1 token, per-challenge cap (e.g., max 5). Simple, spammable. | ✓ |
| Hold-to-fill meter | Press and hold to fill a meter, release to claim tokens. More deliberate. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Tap to earn (cap = 5 per challenge, resets each chapter).

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tokens starting balance | Enough for 1-2 cheap actions. Forces strategy. | |
| 5 tokens starting balance | More room to play. Less tension. | |
| Admin-configurable | Admin sets starting balance during pre-event setup. | ✓ |

**User's choice:** Admin-configurable starting balance.

---

## Group View Layout During Challenge

| Option | Description | Selected |
|--------|-------------|----------|
| Single-screen: earn button + shop list | One scrollable screen: tap-to-earn at top, shop below. No navigation needed. | ✓ |
| Tabbed: Earn tab vs Shop tab | Two tabs. Earn tab has tap button; Shop tab shows catalog. | |
| Shop-only, earn is passive | Shop only; earning is automatic (no tap mechanic). | |

**User's choice:** Single-screen — earn button at top, shop items scrollable below.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Social waiting screen | Show all group members' token balances + recent actions feed between challenges. | ✓ |
| Just the waiting screen (current) | Keep existing waiting screen. No shop between challenges. | |
| You decide | Claude picks what fits the bachelor party context. | |

**User's choice:** Social waiting screen — token balances + recent actions feed when no challenge is active.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small timer shown | Compact groom timer at top of group screen during challenge. Builds tension. | ✓ |
| No — just shop and earn | Group doesn't see groom's countdown. Screen stays focused. | |

**User's choice:** Yes — small groom timer at top of the group challenge screen.

---

## Announcement Design

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay | Recap card pattern — dark full-screen, auto-dismisses 2s. Dramatic. | ✓ |
| Toast/banner at top | Non-blocking banner, slides in 3s. Group can still interact with shop. | |
| You decide | Claude picks style for bachelor party drama. | |

**User's choice:** Full-screen overlay, auto-dismisses after 2 seconds.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Who + what | "ALICE" + "TIMER SCRAMBLE". Simple and clear. | ✓ |
| Who + what + flavor text | "ALICE used TIMER SCRAMBLE — The clock is ticking faster!" | |
| You decide | Claude decides content layout. | |

**User's choice:** Who + what only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — different color/icon | Sabotages red (⚡), power-ups gold/green. Instant visual read. | ✓ |
| No — uniform style | Same overlay style for all effects. | |

**User's choice:** Yes — red for sabotages, gold/green for power-ups.

---

## Distraction Overlay Content

| Option | Description | Selected |
|--------|-------------|----------|
| Emoji storm overlay | Bachelor party emojis float up over groom's screen for 3-5s. pointer-events: none so groom can still tap. | ✓ |
| Message from group member | "Bob says: GOOD LUCK LOSER 😂" — personal message overlaid on groom's screen. | |

**User's choice:** Emoji storm overlay.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bachelor party themed | 🍻👑💀🥳💍🎶 — same set as memory cards. | ✓ |
| You decide | Claude picks funny/appropriate emoji set. | |

**User's choice:** Bachelor party themed emoji set (🍻👑💀🥳💍🎶).

---

## Claude's Discretion

- Exact CSS animation for the emoji storm
- How to handle simultaneous/stacked sabotage activations
- Exact layout dimensions and spacing on mobile
- Visual treatment of "0 tokens" / insufficient balance state in shop
- Exact wording for the earn button
- Whether to show phase name above earn area during challenge

## Deferred Ideas

None — discussion stayed within Phase 4 scope.
