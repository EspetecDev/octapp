# Feature Landscape: Multi-Device Testing

**Domain:** Real-time WebSocket party game — multi-device smoke test
**Researched:** 2026-04-10
**Scope:** What multi-device testing typically surfaces, structured by role, with mobile-specific production issues that do not appear in Chrome DevTools.

---

## Table Stakes — Test Scenarios by Role

These are the scenarios that MUST pass for the game to be considered production-ready. If any fail, the night breaks.

### Role: Admin (PC Browser)

| Scenario | What to Verify | Complexity | Known Failure Mode |
|---|---|---|---|
| Create session, get 6-char code | Code generated, shared URL works on phone | Low | PORT env var hardcoded instead of Railway-injected; 502 on connection |
| Open pre-event setup, save config | Trivia questions, scavenger clues, power-up catalog persisted to server state | Low | SAVE_SETUP payload silently dropped if WS not yet open at page load |
| Unlock Chapter while groom + party are connected | All three devices update simultaneously within ~1s | Medium | Admin sees chapter advance but clients miss broadcast if WS reconnect is mid-flight |
| Real-time scores view updates as groom completes minigames | Score increments arrive in real time, no stale reads | Medium | Score mutations sent before full state rebroadcast causes party to see old total |
| Admin override on scavenger hunt "Found It!" | Groom view transitions to reward reveal | Low | Admin click lands on wrong chapter if two chapters unlocked in quick succession |
| Session persistence across admin tab refresh | Rejoin as admin, state is intact | High | Admin role not reassigned on reconnect if role stored only in WS server memory, not session state |

### Role: Groom (Phone — iOS Safari or Android Chrome)

| Scenario | What to Verify | Complexity | Known Failure Mode |
|---|---|---|---|
| Join via code on phone | Join wizard renders, code accepted, transitions to groom waiting view | Low | Mixed-content error if WS uses ws:// on HTTPS Railway URL |
| Trivia minigame — answer within 15s | Radial countdown animates, answer registers, win/loss overlay fires | Medium | 300ms tap delay on iOS causes answer tap to miss if `touch-action: manipulation` not set on option buttons |
| Sensor minigame — tilt meter on real phone | DeviceMotion permission gate appears, motion data flows, tilt reaches 80% | High | Permission gate never shown if `DeviceMotionEvent.requestPermission` call is not inside a user gesture handler — silent failure on iOS |
| Sensor minigame — permission denied by groom | Graceful fallback, no crash, retry available | Medium | `undefined` data on DeviceMotion event when permission denied; unguarded access throws and freezes view |
| Memory/matching game — touch flip cards | Cards flip on tap, no ghost state, timer counts down | Medium | Rapid double-tap on card triggers two flip events; immutability check must prevent double-match |
| Scavenger hunt — request hint | Score deducts 10pts, hint text shows, reflected on admin | Low | Hint request sent but deduction not confirmed if server response drops; optimistic update shows wrong score |
| Groom locks phone mid-minigame | On unlock, minigame state is intact or game recovers gracefully | High | iOS Safari drops WS connection on screen lock; reconnect fires but server may have advanced state — groom rejoins mid-chapter with no context |
| Groom switches to another app for 30s | Connection drops, exponential backoff reconnects, full-state snapshot restores view | High | Backoff timer not cleared on successful reconnect; multiple parallel reconnect attempts create duplicate message handlers |
| Reward reveal — full-screen overlay | Overlay fires on groom phone when admin unlocks a reward | Medium | Overlay fires correctly in local dev (loopback), but on real device the WS message arrives out of order if chapter unlock and reward unlock are sent in rapid succession |

### Role: Party Member (Phone — mixed iOS/Android)

| Scenario | What to Verify | Complexity | Known Failure Mode |
|---|---|---|---|
| Join via code on second phone | Join wizard, code accepted, transitions to group waiting view | Low | Same mixed-content / WS upgrade issue as groom |
| Earn tokens via tap mechanic | Token count increments in real time, reflected on admin scores view | Medium | Multiple rapid taps race against each other; server must debounce or process serially |
| Spend token on power-up | Power-up activates, broadcast to groom and admin | Medium | Token balance goes negative if client sends spend before server confirms prior earn |
| Spend token on sabotage | Sabotage triggers on groom view | Medium | Same race as power-up; order of message processing matters |
| Chapter recap card overlay appears | Overlay shows on party member phone when admin unlocks new chapter | Low | Party member misses overlay if they joined after the chapter unlock event (late joiner issue) |
| Party member locks phone, returns | Reconnects, token balance and chapter state restored | High | Full-state snapshot on reconnect must include tokenBalances per-player; partial snapshots leave balance at 0 |
| Two party members spend tokens simultaneously | Both transactions acknowledged, no double-spend | High | Race condition on server-side balance — requires serial processing or optimistic lock |

---

## Differentiators — Tests That Validate the "Party" Experience

These are not required for correctness but validate the intended feel of the game.

| Feature | Value | Complexity | Test Approach |
|---|---|---|---|
| Haptic feedback on minigame win/loss | Tactile confirmation feels polished | Low | Must test on physical Android (Chrome); iOS Safari does not support Vibration API — verify graceful no-op, not crash |
| Sub-1s broadcast latency for power-ups | Sabotage feels immediate, not laggy | Medium | Timestamp tap on party phone, watch groom phone; Railway RTT typically 50–150ms on EU/US servers |
| Recap card overlay timing | All three devices show chapter transition within 2s of admin action | Medium | Watch all three screens simultaneously; staggered arrival is a UX failure even if technically delivered |
| Token economy legibility on small screen | Token count, power-up list readable at arm's length | Low | Real device at normal holding distance; DevTools viewport does not replicate font rendering on low-DPI Android screens |

---

## Anti-Features — Do Not Test or Implement During This Milestone

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Load testing (10+ simultaneous connections) | Designed for 5–10 players; Railway free tier handles that easily | Test with exactly 3 devices matching real-night setup |
| Automated reconnect stress testing | Over-engineers for a one-time event | Manual: turn airplane mode on/off once per role, verify recovery |
| Video or audio streaming over WS | Out of scope per PROJECT.md | — |
| Persistent session across server restart | Ephemeral by design | If Railway restarts mid-test, treat as new session |

---

## Mobile-Specific Production Issues Not Visible in Chrome DevTools

These do not surface during local development or DevTools device mode. They only appear on physical devices.

### Critical

**1. WebSocket drops on iOS screen lock**
Safari freezes the memory of backgrounded pages and silently closes the WS connection without firing `onclose`. The server eventually times out the socket, but the client sees nothing until the screen is unlocked. The exponential backoff reconnect must detect the stale connection and re-handshake. Test: lock the groom's iPhone for 15 seconds mid-trivia, unlock, verify state recovery.

**2. DeviceMotion permission is silently skipped if not in a user gesture**
`DeviceMotionEvent.requestPermission()` on iOS 13+ must be called synchronously inside a user-initiated event handler (button click). Calling it on page load, in a `setTimeout`, or inside an `async` function that was not itself triggered by a direct gesture fails silently — the permission sheet never appears and `DeviceMotionEvent` data is undefined. DevTools sensor simulation never exercises the permission gate.

**3. Mixed-content WebSocket on Railway**
Railway serves apps over HTTPS. Any `ws://` URL (non-secure) will be blocked by the browser on a real device under the mixed-content policy. DevTools on localhost does not enforce this because localhost is treated as a secure origin. The WS client URL must use `wss://` in production. Verify via `window.location.protocol` check in the WS URL construction.

**4. Railway proxy 30-second timeout on `*.up.railway.app`**
Railway's edge proxy terminates idle WebSocket connections after 30 seconds on the default `*.up.railway.app` domain. This is not a Railway bug — it is the CDN's idle-connection timeout. The app already implements exponential backoff reconnect (validated in Phase 01), but the test must confirm reconnect fires and full-state snapshot is received before the timer for the current minigame expires. Mitigation: configure a custom domain (avoids CDN timeout) or ensure WS ping/pong heartbeat fires every 20 seconds.

### Moderate

**5. 300ms tap delay on iOS for minigame answer buttons**
Without `touch-action: manipulation` on interactive elements, iOS Safari waits 300ms after every tap to check for a double-tap. On the 15-second trivia timer, a 300ms ghost delay is perceptible. CSS fix: apply `touch-action: manipulation` to all game buttons. Viewport meta `width=device-width` also eliminates the delay in modern Safari. DevTools touch simulation uses synthetic events that bypass this delay entirely.

**6. Vibration API not available on iOS Safari**
`navigator.vibrate()` is undefined on iOS Safari (all versions). The haptic feedback calls in win/loss overlays must be guarded with `if ('vibrate' in navigator)`. DevTools on desktop Chrome does not simulate vibration, but Android Chrome does execute it. A missing guard does not crash the game — it throws a silent TypeError — but if any downstream code depends on the return value, it will misbehave. Verify the guard exists.

**7. Double-tap card flip in memory minigame on real touch screens**
Physical touchscreens generate touch events at higher frequency than simulated DevTools touch. Rapid consecutive taps on the same card can fire two `click` events before the CSS flip animation finishes, bypassing the "already flipped" guard if that guard reads DOM state instead of immutable JS state. Verify the guard is based on game state array, not `classList.contains('flipped')`.

**8. Android Chrome back-button exits the game**
On Android, the hardware back button navigates browser history. If the SvelteKit router adds entries to the history stack during view transitions (join → waiting → game), the back button pops the user out of the game into the join screen mid-session. Test: press Android back button during the trivia minigame. Expected: browser warns or stays in game. Fix if needed: `history.replaceState` instead of `pushState` for in-game view transitions, or intercept `popstate`.

**9. iOS viewport keyboard push on any text input**
If any view has a text input (e.g., the join code entry field), the iOS software keyboard pushes the viewport up and clips game UI. DevTools does not simulate keyboard-induced viewport resize. Test: focus the join code field on iPhone, verify no critical UI is clipped. This is low risk for mid-game views since the join wizard is the only text-input-heavy screen.

**10. Portrait lock not enforced**
The game is smartphone-first in portrait. On real devices, rotating to landscape changes the viewport aspect ratio and may break the tilt meter's axis mapping in the sensor minigame. DevTools rotation does simulate this, but the interaction between DeviceMotion axis data and landscape orientation is only testable on a real device. Test: rotate the phone 90 degrees during the sensor minigame.

### Minor

**11. Font rendering on low-DPI Android screens**
Some mid-range Android phones have DPR 1.5 or lower. Token counts and minigame timers may render crisply in DevTools (which defaults DPR to device-pixel-ratio) but appear blurry or too small on the physical screen. Test on the actual Android device that will be used at the party.

**12. Safe area insets on iPhone notch/Dynamic Island**
Without `env(safe-area-inset-*)` padding in the CSS, UI elements at the top or bottom of the screen may be clipped by the notch, Dynamic Island, or home indicator. DevTools does not simulate safe area insets by default. Test: verify all interactive elements are reachable without the notch overlapping them.

---

## Feature Dependencies

```
Railway deployment (live URL)
    → All multi-device scenarios (requires real network, not localhost)

HTTPS URL (wss://)
    → iOS + Android WebSocket connection (mixed-content block on ws://)

DeviceMotion permission gate
    → Sensor minigame on groom's iPhone (not Android)

Exponential backoff reconnect (Phase 01)
    → Screen lock recovery
    → Railway 30s proxy timeout recovery

Full-state snapshot on reconnect (Phase 01)
    → Late joiner chapter state restoration
    → Token balance restoration after reconnect

Admin chapter unlock broadcast
    → Groom view router (minigame/scavenger/reward routing)
    → Party recap overlay

Token balance server authority
    → Power-up / sabotage spend
    → Multi-tap earn race condition handling
```

---

## MVP Test Sequence Recommendation

Run in this order to catch blockers early before burning time on polish issues.

1. **Deployment smoke test** — Admin opens the live Railway URL on PC. Zero local environment. Verify no console errors, WS connects, code generated.
2. **Three-device join** — Groom and one party member join via phone. Verify all three see the correct view for their role.
3. **Chapter unlock broadcast** — Admin unlocks Chapter 1. Verify all three devices update within 2 seconds.
4. **Trivia on groom phone** — Complete one trivia question. Verify score appears on admin view.
5. **Sensor minigame on groom phone** — iOS permission gate, tilt to win. This is the highest-risk scenario.
6. **Power-up from party phone** — Spend a token. Verify effect on groom view and admin score.
7. **Screen lock recovery** — Lock groom's phone for 15 seconds. Verify reconnect and state restore.
8. **Full chapter run** — Admin progresses through at least two full chapters end-to-end.

Defer to second pass: haptic feel, font size on Android, portrait lock edge cases.

---

## Validation Checklist

- [ ] WS URL uses `wss://` in production build (not `ws://`)
- [ ] Server reads PORT from environment variable (not hardcoded)
- [ ] DeviceMotionEvent.requestPermission called only inside user gesture handler
- [ ] DeviceMotion data access guarded against `undefined` when permission denied
- [ ] `navigator.vibrate` guarded with `'vibrate' in navigator` before calling
- [ ] All game buttons have `touch-action: manipulation` or viewport sets `width=device-width`
- [ ] Memory game flip guard based on JS state array, not DOM class
- [ ] Android back button does not pop user out of active game session
- [ ] Full-state snapshot on reconnect includes tokenBalances per-player
- [ ] Reconnect handler clears previous backoff timer before starting new one
- [ ] Late joiner receives current chapter state immediately on connect
- [ ] Railway 30s proxy timeout: heartbeat ping/pong interval under 25 seconds OR custom domain configured
- [ ] Safe area insets applied for iPhone notch / home indicator
- [ ] Admin role restored correctly on tab refresh / reconnect

---

## Sources

- Railway WebSocket timeout behavior: https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69
- Railway HOST/PORT requirements: https://docs.railway.com/guides/sse-vs-websockets
- iOS Safari screen lock WS disconnect: https://github.com/enisdenjo/graphql-ws/discussions/290
- Safari 26 WebSocket CONNECT bug: https://www.jackpearce.co.uk/posts/debugging-websocket-upgrade-failures-safari-ios26/
- DeviceMotionEvent.requestPermission iOS 13+: https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2
- iOS touch-action 300ms delay: https://developer.chrome.com/blog/300ms-tap-delay-gone-away
- Vibration API iOS absence: https://blog.openreplay.com/haptic-feedback-for-web-apps-with-the-vibration-api/
- Real device vs Chrome DevTools gaps: https://dev.to/bhawana127/chrome-simulation-vs-real-device-cloud-testing-1bhg
- WebSocket reconnect state sync: https://websocket.org/guides/reconnection/
- Double-tap iOS Safari fix: https://medium.com/@kristiantolleshaugmrch/fixing-the-double-tap-issue-in-ios-safari-with-javascript-4e72a18a1feb
