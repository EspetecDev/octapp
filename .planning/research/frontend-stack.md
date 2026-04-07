# Frontend Stack Research

## Recommendation

Use **Svelte 5 + SvelteKit** as the frontend framework: it ships the smallest bundle (~47KB vs React's 156KB), has fine-grained reactivity ideal for real-time state, and built-in routing/stores eliminate the need for third-party libraries — all critical for a one-time mobile party event where fast build + fast load both matter.

Do **not** use a game framework (Phaser, etc.): the minigames described (trivia, card flip, sensor tilt, scavenger hunt) are UI-driven interactions, not sprite/physics games. CSS transforms + Web APIs cover everything needed.

---

## Options Compared

### Frameworks

| Framework | Bundle (prod) | Real-time DX | Mobile perf | Routing | Verdict |
|-----------|--------------|--------------|-------------|---------|---------|
| Svelte 5 + SvelteKit | ~47KB | Runes + built-in stores, reactive by default | Fastest startup, least JS | File-based, built-in | **Recommended** |
| React 19 + React Router | ~156KB | Context/Zustand/Jotai, verbose | Moderate, virtual DOM overhead | Third-party required | Overkill for scope |
| Vue 3 + Vue Router | ~89KB | Pinia, good DX | Good | Official plugin | Valid but mid-ground |
| Vanilla JS | ~0KB | Manual DOM, error-prone | Best possible | Manual | Too much boilerplate for multiple views |

**Decision:** Svelte 5. Real bundle size 3x smaller than React for identical functionality. Runes (Svelte 5's reactivity primitives) make server-push state updates (WebSocket/SSE for phase changes, power-ups) trivial without external state libraries. SvelteKit handles the three distinct views (admin, groom, participant) as separate routes with shared stores.

### Game Framework vs CSS+JS

| Approach | Use Case | Bundle Impact | Complexity |
|----------|----------|--------------|-----------|
| Phaser 3/4 | Sprite-based, physics, tile maps | +1MB+ | High setup cost |
| PixiJS | 2D canvas/WebGL rendering | +400KB | Medium |
| CSS + Web Animations API | UI transitions, card flips, countdowns | ~0KB extra | Low |
| Canvas API (raw) | Custom sensor visualizations | ~0KB extra | Medium |

**Decision:** CSS + Web Animations API is sufficient. Card flip = `rotateY` + `backface-visibility: hidden`. Trivia timer = CSS `@keyframes` on a progress bar. Sensor tilt game = read `DeviceMotion` event, map value to CSS `transform: rotate()` or translate a DOM element. No canvas needed unless you add a custom particle effect. Phaser would add over 1MB and a steep learning curve for interactions that are fundamentally HTML UI.

---

## Key Findings

- **Svelte 5 bundle sizes** in real-world production: Svelte 47KB / Vue 89KB / React 156KB (with code splitting and tree shaking). On a shaky wedding venue WiFi, this difference is felt. [Source: JSGuru benchmarks 2025]

- **SvelteKit WebSocket support** is now native (added for testing in March 2025). Integrate WebSocket client in a shared `$lib/socket.ts` store; all three views subscribe reactively.

- **Multiple views** map cleanly to SvelteKit routes: `/admin`, `/groom`, `/party` (or query-param–driven if one URL is shared via QR code). Svelte stores (writable/derived) hold shared game state pushed from server.

- **CSS card flip** is a solved problem: `perspective` + `transform-style: preserve-3d` + `backface-visibility: hidden` + `transition: transform 0.6s`. No library, ~20 lines of CSS. Works on all mobile browsers.

- **DeviceMotion/DeviceOrientation** is available in all target browsers but requires explicit `requestPermission()` on iOS 13+ (Safari and all iOS browsers). Must be triggered from a user gesture (button tap), not page load. Android grants automatically. Site must be HTTPS.

- **Wake Lock API** is supported in Chrome 85+, Safari 16.6+, Firefox 124+. Use `navigator.wakeLock.request('screen')` to prevent screen timeout during play. Falls back gracefully if denied. NoSleep.js is a polyfill for older iOS but likely not needed given iOS 16.6+ target.

- **Screen orientation lock** via `screen.orientation.lock('portrait')` is supported on Android Chrome but **not on iOS Safari** (always returns a rejected promise). On iOS, use CSS `@media (orientation: landscape)` to show a "please rotate" overlay instead.

- **Fullscreen API** (`element.requestFullscreen()`) works on Android Chrome but is **blocked on iOS Safari** — no true fullscreen for in-browser web apps unless added to home screen as a PWA (`display: standalone` in the manifest). Plan for this: the game needs to work without fullscreen.

- **Hammer.js is unmaintained** (last commit 2016). Use native Pointer Events for simple tap/drag, or **The Finger** (3.68KB, 11 gestures, active) for anything more complex like swipe-to-answer or drag-to-match.

- **`overscroll-behavior: none`** on `body` + `touch-action: none` on interactive areas is the modern way to prevent unwanted scroll/bounce. `preventDefault()` on `touchmove` no longer reliably works in iOS 15+.

- **`100dvh`** (dynamic viewport height) should be used instead of `100vh` to avoid layout jumps caused by the Safari address/bottom bar. Supported in Safari 15.4+.

---

## Gotchas

### iOS Sensor Permission (Critical)
`DeviceMotionEvent.requestPermission()` must be called inside a user gesture handler. If you call it on page load or outside a click/tap, iOS silently ignores it. Show a "tap to enable motion" button before any sensor minigame starts. Both `DeviceMotionEvent` and `DeviceOrientationEvent` need separate permission calls on iOS.

### No Fullscreen on iOS Safari
`document.documentElement.requestFullscreen()` is not implemented in iOS Safari (as of 2025). The address bar and bottom bar stay visible. Workaround: add `<meta name="apple-mobile-web-app-capable" content="yes">` and instruct players to "Add to Home Screen" for a standalone experience — but don't block on it. Design the layout to work within the browser chrome.

### Viewport Height Jumps
Use `height: 100dvh` not `100vh`. The dynamic viewport unit accounts for the browser UI bar showing/hiding. Without it, content gets clipped or jumps when the URL bar retracts on scroll.

### iOS Scroll Bounce ("Rubber Banding")
Setting `overscroll-behavior: none` on `body` removes the elastic bounce. Also add `touch-action: none` on canvas-like interaction areas. Do not rely on `event.preventDefault()` in passive event listeners — iOS may ignore it.

### Wake Lock Revoked on Tab Switch
The Wake Lock is automatically released when the browser tab goes to background. Re-acquire it in the `visibilitychange` event handler. This is spec-compliant behavior, not a bug.

### DeviceMotion Coordinate System Differences
iOS and Android report `DeviceMotionEvent.acceleration` values with **opposite signs on some axes**. Normalize to a consistent coordinate system in your sensor abstraction layer. Test on both platforms early.

### Pointer Events vs Touch Events
Use `pointer` events (`pointerdown`, `pointermove`, `pointerup`) rather than `touchstart`/`touchmove` for all custom interactions. They unify mouse, touch, and stylus. Touch events still work but require extra handling for multi-touch. Set `touch-action: manipulation` to eliminate the 300ms tap delay on mobile browsers without needing `fastclick`.

### SvelteKit SSR and Browser APIs
SvelteKit renders pages server-side by default. Any code that accesses `window`, `navigator`, or `DeviceMotionEvent` must be guarded with `if (browser)` from `$app/environment` or placed in `onMount()`. Failure to do this causes SSR crashes. For a party game with no SEO need, consider setting `export const ssr = false` in each route's `+page.ts` to opt out entirely.

### iOS 15+ `touchmove` preventDefault
Since iOS 15, `preventDefault()` on passive `touchmove` listeners does not prevent scroll in all cases. The reliable approach is CSS: `overflow: hidden` on the root, `touch-action: none` on interaction zones, and `overscroll-behavior: none` globally.

### Screen Orientation Lock on iOS
`screen.orientation.lock()` always rejects on iOS Safari. Do not throw an uncaught error. Use a try/catch and fall back to CSS orientation detection with a rotation overlay: `@media (orientation: landscape) { show-rotate-prompt }`.
