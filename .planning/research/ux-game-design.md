# UX & Game Design Research

**Domain:** Mobile social/party game (bachelor party, real-world bar/restaurant setting)
**Researched:** 2026-04-07
**Confidence:** MEDIUM-HIGH (drawn from Jackbox/Kahoot/Heads Up documented design principles, academic asymmetric game design research, and community-verified game design patterns)

---

## Key Patterns

### The Phone Is the Controller, Not the Screen

The defining insight from Jackbox is that the phone should be a **personal, private input device** — not a display. The main shared experience (scoreboard, minigame state, narrative progression) belongs on a social surface (a secondary screen or a shared view), while each player's phone shows only what is relevant to their role. This architecture makes role differentiation natural, not bolted-on.

Heads Up and Kahoot reinforce the same lesson: **one action at a time on the phone screen**. Never present multiple tasks simultaneously. In a noisy bar, cognitive load is already high. The phone must demand zero orientation time when someone picks it back up.

### The "Jack Principles" (applicable directly)

Jackbox's internal design framework applies cleanly to this project:

1. **Pacing maintenance** — every moment has one clear action. No menus. No decision trees. The game tells you what to do next.
2. **Illusion of awareness** — the game appears to react specifically to your choices, making each player feel seen even in a group of 8.
3. **Dialogue intimacy** — narrative voice creates a personal relationship. The game talks *to* you, not at a crowd.

### Simplicity as a Core Constraint

Party games that fail do so by adding rules complexity. The points system, sabotage economy, and minigame rules must each be explainable in a single sentence that a slightly drunk person can absorb without a tutorial screen. This is not a UX nicety — it is a survival requirement for this context.

Kahoot's growth was driven by behavioral design: **make people feel smart, make them want to tell someone**. Every successful moment (correct answer, sabotage landed, power-up activated) should produce a small, shareable feeling of delight.

### Simultaneous Play Over Turn-Taking

Board game research and Jackbox's own design confirm: simultaneous action eliminates the dead-air problem. When you wait for a turn in a noisy bar, you pull out your other apps. Design every phase so that all players have something to do at the same time — even if their actions are different. The groom answers trivia; the group is simultaneously voting on which power-up to deploy against him.

### Visual Clarity for Noisy Environments

In a bar, you cannot rely on audio. Every important event must communicate through:
- **Large, high-contrast text** (readable at arm's length, dim lighting)
- **Color-coded role identity** (persistent accent color per role throughout the night)
- **Haptic feedback** (confirms actions without requiring the player to look)
- **Full-screen celebrations** for wins/scores (impossible to miss, no reading required)

Do not use subtle animations or small badge counts as the primary feedback mechanism. Design as if the user is slightly drunk, holding a drink in one hand, with someone talking to them.

---

## Role UI Design

### Three Distinct Mental Models

Each role requires its own visual vocabulary and information hierarchy:

**Admin (Host)**
- God-mode view: sees all scores, phase status, which minigames are queued, group's current point balance
- Controls pacing: manually advances phases, can override timers
- Does not compete — their screen is a dashboard, not a game controller
- Key UI need: clarity about "what happens next" and "how is everyone doing"
- Design principle: treat this like a DJ booth view, not a player's hand

**Groom (Main Player)**
- Adversarial framing: the game is happening *to* them
- Sees challenges, timers, minigame prompts — never sees the group's sabotage plans
- Tone should be warm and teasing, never hostile
- Key UI need: the challenge front-and-center, score feedback that lands emotionally
- Design principle: every screen should feel like a dare, not a form

**Group (Helpers/Saboteurs)**
- Collaborative view: the group acts as a single organism with pooled resources
- Sees the group's point balance, available power-ups, and the ability to vote/coordinate
- Critically: the group should see a live feed of what the groom is doing (his current challenge type, timer countdown) so they can time sabotages
- Key UI need: the group panel should feel like a war room — shared state, collective action
- Design principle: individual group members should feel their vote matters; show vote tallies in real time

### Implementation Pattern: Persistent Role Color

Assign a color to each role on session join — this color persists on every screen throughout the night. The groom's accent color (e.g., gold/yellow) should appear on any screen that mentions or affects him. The group gets a shared color (e.g., red/orange for sabotage energy). Admin gets a neutral, control-panel color (e.g., white or gray).

This prevents the "which side am I on again?" confusion after someone returns from the bathroom.

### The Hidden Information Contract

From asymmetric game design research (Among Us, social deduction games): the informed minority (group knows their sabotage plans) vs. uninformed majority (groom doesn't) must be maintained strictly at the UI level. Never let a shared screen spoil hidden information. If there's any shared physical screen in the venue, it should only show public state (scores, current challenge type, timer) — never group strategy.

The technical rule: **never display role-private information on a surface that other roles can see**.

---

## Minigame Design

### The Single-Screen Rule

Each minigame must fit on one screen with no scrolling. In a bar, a player is not going to scroll. If the question, answer options, and timer don't fit above the fold, rewrite the question.

### Timer Design

Timers create urgency and prevent analysis paralysis — but they must be **visible at all times** during a timed challenge. Use a radial/circular timer (occupies a corner, always peripheral) rather than a countdown number. The circular drain is readable at a glance without reading.

Recommended durations by minigame type:
- **Trivia (single answer):** 15-20 seconds. Forces gut-instinct answers which create better social reactions than studied ones.
- **Phone sensor games (tilt, shake):** 10-15 seconds. Physical actions get exhausting fast in a group setting.
- **Memory/matching:** 30-45 seconds. Matching requires actual cognitive effort; rushing it feels unfair.
- **Scavenger hunt tasks:** No timer — or a generous phase timer (5-10 minutes). Rushed exploration destroys the physical experience.

### Feedback That Feels Good

The "feel" of a minigame is almost entirely determined by the feedback moment — the instant between submitting an answer and seeing the result. Research from casual game design (Diner Dash scoring system, hypercasual haptics) shows:

1. **Immediate visual response on tap** — the button should animate on touch before the result is known. Players hate dead input.
2. **Haptic on result** — a distinct vibration pattern for correct vs. wrong vs. time-expired. Three different patterns, learned in the first round.
3. **Full-screen result** — correct answers deserve a full-screen celebration (brief, 1.5-2 seconds). Wrong answers get a smaller dismissal, not a shame screen.
4. **Score delta, not total** — show "+150 pts" in large type, not "Your score: 1450." The delta is the emotional payoff.

### Scoring System Rules

Following the Diner Dash insight: scoring only becomes fun when it rewards **how** you play, not just whether you succeed.

- Award bonus points for speed (answer in the first 5 seconds = 1.5x multiplier)
- Award bonus points for perfect streaks across a minigame
- Show the groom's score vs. group's score as a running narrative, not just numbers ("The group is ahead by 3 challenges")
- Narrative framing of score ("The groom is holding his own... for now") maintains emotional stakes without players needing to do mental math

### Minigame Sequencing

Never run two minigames of the same type back-to-back. The arc across a minigame set should vary: physical → cognitive → social → physical. This mirrors how a good DJ reads the room — energy variation prevents fatigue.

---

## Economy Design

### The Fundamental Rule: One Currency

Do not introduce multiple currencies (coins AND energy AND tokens). For a single-evening party game, one shared group currency ("tokens," "beers," whatever fits the theme) is sufficient and prevents confusion.

The group earns tokens by:
- Completing helper challenges successfully
- Voting correctly in prediction challenges ("Will the groom get this right?")
- Bonus events triggered by phase transitions

The group spends tokens on:
- Sabotages targeting the groom's current or next challenge
- Power-ups that help the groom (for helpers who want to cooperate)
- Special actions during scavenger hunt phases

### Preventing Analysis Paralysis

From casual game economy research: offering too many spending options simultaneously is the most common failure mode. The solution is **contextual availability** — only show the power-ups that are currently applicable.

During a trivia minigame, the group should see: "Skip This Question (30 tokens)" and "Add 10 Seconds to Timer (20 tokens)" — not a full catalog of 12 options. Context-filtering the shop prevents decision fatigue.

### The "Enough to Use, Not Enough to Ignore" Principle

Economy tension comes from scarcity. If the group always has surplus tokens, spending feels meaningless. If they're always broke, it feels punishing. Calibrate so the group can afford approximately one sabotage per two minigames. This creates natural "save or spend now?" moments without requiring strategic depth.

### Sabotage Must Feel Fun for the Target Too

The groom knowing a sabotage is coming (announce it: "The group just activated Double Confusion!") creates anticipatory dread that is more fun than surprise sabotage. The reveal moment — "the group spent 40 tokens to scramble your answers" — is a social event, not a mechanical penalty. Design sabotages as story beats, not punishments.

Sabotage types to include:
- **Timer reduction** (simple, readable, always relevant)
- **Answer scramble** (reorders answer options — funny but not demoralizing)
- **Distraction** (admin physically has to do something — whisper a fake answer, do a gesture)
- **Forfeit insurance** (group bets the groom will fail — if he does, they get double tokens)

Avoid sabotages that completely block the groom from playing (locking the screen, etc.) — these feel cruel and kill session energy.

### Power-Up Display Design

Show the token balance persistently in the group's UI header — never hide it in a submenu. The balance is the group's "ammo counter" and should always be visible. Use a simple number with a thematic icon (beer mug, etc.). No progress bars, no complex indicators.

---

## Engagement & Resilience

### Design for Impaired Attention, Not Ideal Attention

The correct mental model for this game's audience is: **players will be distracted, loud, possibly drunk, moving between venues**. Do not design for a player who is focused and sitting still. Design for:

- Someone who missed the last 20 minutes
- Someone who can only look at their phone for 5 seconds
- Someone who is in the middle of a conversation with a non-player
- Someone who just rejoined after going to the bar

### Drop-In/Drop-Out at the Phase Level

Each phase (set of minigames at a venue) should be a complete, self-contained unit. A player rejoining mid-night should be able to understand their current role and what to do within 10 seconds, without being briefed by another player.

Implementation rules:
- On app open/rejoin, show a "You are: [Role]" splash for 2 seconds before the active game state
- Never require a returning player to catch up on narrative to participate
- Phase transitions (moving venues) are natural re-entry points — design them as explicit "new chapter" moments with a brief recap card

### The Long-Night Arc: Pacing Across Phases

Treat the evening like a three-act structure:

**Act 1 (early evening, first venue): Onboarding energy**
- Simpler minigames, higher success rates, generous token economy
- Goal: get everyone laughing and comfortable with the mechanics
- No complex sabotages yet — let the group discover the economy gradually

**Act 2 (mid-evening, second venue): Peak engagement**
- Introduce scavenger hunt elements, more complex minigames
- Enable the full sabotage/power-up catalog
- Group vs. groom tension peaks here — this is the emotional heart of the night

**Act 3 (late evening, final venue): Chaotic climax**
- Shorter, higher-stakes minigames
- Economy rebalances: dump remaining tokens into a final challenge
- A "finale" challenge type that is explicitly performative (the groom does something embarrassing in public)

This pacing mirrors what Jackbox does across a party pack — start easy, earn complexity, end with a memorable moment.

### Reducing Cognitive Load as the Night Progresses

As players get drunker, the UI must get simpler. Consider:
- Phase 3 minigames should have fewer answer options (2 instead of 4)
- Timer durations should be slightly longer (fatigue is real)
- Scoring celebrations should be louder and more full-screen
- The admin should have a "simplify mode" toggle that strips optional UI elements for later in the night

### Push Notifications and Pings Between Venues

During the transition between venues, players will pocket their phones. Use push notifications (with permission) to:
- Alert when the next phase is starting ("Phase 2 unlocked — you're at O'Malley's now")
- Tease what's coming ("The group just earned 50 bonus tokens. The groom has no idea.")
- Never send notifications during active gameplay — only between phases

### Handling Disconnection Gracefully

Network reliability in bars is poor. Design for it:
- Game state should persist server-side so a player who force-quits can rejoin exactly where they left off
- Admin should be able to pause any minigame timer from their dashboard (someone got separated, someone's phone died)
- If the groom disconnects mid-challenge, that challenge is voided — never counted as a failure. This prevents sour moments from technical failures.

### The Spectator Problem

Group members who are watching the groom complete a live challenge (e.g., a physical phone sensor game) should have something to do on their screen simultaneously — even if it's just voting live on whether he'll succeed ("Yes/No — bet your tokens"). Passive observation of a 30-second challenge is fine at a party, but a passive 2-minute wait is where phones come out for other apps.

Rule of thumb: **no player's phone should show a static state for more than 30 seconds during an active game phase**.

---

## Sources

- [Jackbox Games Design Principles — Built In Chicago](https://www.builtinchicago.org/articles/jackbox-games-design-party-pack)
- [How Kahoot Grew to 7 Billion Players by Designing for Behaviour](https://medium.com/@EmergePMFAcademy/how-kahoot-grew-to-7-billion-users-by-designing-for-behaviour-a-product-market-fit-case-study-667cc4504f14)
- [Game Design Breakdown: Party Games — Alexia Mandeville](https://alexiamandeville.medium.com/game-design-breakdown-party-games-5c2bd301cb96)
- [Asymmetrical Gameplay Design Patterns — Game Developer](https://www.gamedeveloper.com/design/asymmetrical-gameplay-as-a-new-trend-in-multiplayer-games-and-five-design-patterns-to-make-engaging-asymmetrical-games)
- [Designing Games with Hidden Roles — MINIFINITI](https://minifiniti.com/blogs/game-talk/designing-games-hidden-roles)
- [Mobile Session Design: Flexible Sessions](https://mobilefreetoplay.com/mobile-session-design-flexible-sessions-2/)
- [Mobile Session Design: Easy In, Easy Out](https://mobilefreetoplay.com/mobile-session-design/)
- [Hypercasual Games UI/UX Design Guide — Pixune](https://pixune.com/blog/hypercasual-games-ui-ux-design-guide/)
- [Mobile Game Economies: In Praise of Simplicity — Singular](https://www.singular.net/blog/mobile-game-economies/)
- [Heads Up! — Nexus Studios Design](https://nexusstudios.com/work/heads-up/)
- [Scavenger Hunt App Design — Locatify Complete Guide](https://locatify.com/the-complete-guide-to-scavenger-hunt-apps/)
- [Drop-In Drop-Out Party Games — BoardGameGeek](https://boardgamegeek.com/thread/3410745/drop-in-drop-out-party-games)
- [Beyond Player Experience: Designing for Spectator-Players — UXPA Magazine](https://uxpamagazine.org/beyond-player-experience/?lang=en)
- [Game Mechanics: How to Keep Players Engaged — Board Game Design Course](https://boardgamedesigncourse.com/game-mechanics-how-to-keep-players-engaged/)
