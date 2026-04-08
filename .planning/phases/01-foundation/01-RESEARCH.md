# Phase 1: Foundation - Research

**Researched:** 2026-04-07
**Domain:** SvelteKit 5 + Bun WebSocket server, Railway deployment, mobile-first web
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Flat monorepo — single `package.json` at root. `src/` is SvelteKit, `server/` is the Bun WebSocket server. Two entry points, one repo.
- **D-02:** One Railway service — Bun serves the SvelteKit static build and handles WebSocket upgrades on the same port/URL. No separate services, no CORS configuration needed.
- **D-03:** Custom WebSocket wrapper with exponential backoff — no Socket.IO. Native browser WebSocket + a thin reconnect class. Lighter, no extra dependencies, full control.
- **D-04:** Full state snapshot on every server-sent event — no delta messages. Server sends the complete game state object after any change.
- **D-05:** Reconnect + full state snapshot pattern. When connection is lost: show "Reconnecting..." overlay → exponential backoff → on reconnect, receive full current state → dismiss overlay.
- **D-06:** Multi-step wizard join flow — Enter 6-character join code → Enter display name + select role → Waiting screen.
- **D-07:** Waiting screen shows player's own name/role + a live list of all currently connected players.
- **D-08:** Groom role claim — when already taken, Groom option is greyed out inline. Validation is immediate (before submit).
- **D-09:** Tailwind CSS — utility-first, consistent design tokens across all four phases.
- **D-10:** Visual theme — dark, high-energy, nightlife feel. Dark background (`#0d0d0d`), vibrant accent colors.

### Claude's Discretion

- Admin authentication UX — implement as a `?token=` query param check
- Exact font choices within the dark/nightlife theme
- Loading skeleton / spinner treatment
- Specific Tailwind color palette values (within the dark + vibrant accent direction)
- Dev tooling details (ESLint, Prettier, TypeScript strictness)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope.

> **CRITICAL CONFLICT TO RESOLVE BEFORE PLANNING:**
> CONTEXT.md D-09 locks **Tailwind CSS** as the styling approach. The UI-SPEC (01-UI-SPEC.md) explicitly says "No Tailwind — plain CSS custom properties with BEM-style scoped Svelte styles." These two documents contradict each other. The planner MUST surface this conflict to the user and get a resolution before writing tasks. The CONTEXT.md locked decision is the user's explicit choice; the UI-SPEC appears to have overridden it during a separate UI research step. See "Open Questions" section below.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECH-01 | SvelteKit 5 with file-based routes (`/`, `/admin`, `/groom`, `/party`) | SvelteKit 2.57.0 + Svelte 5.55.2 verified current; route structure maps directly to phase goals |
| TECH-02 | Bun WebSocket server with in-memory game state (no database) | Bun 1.x `Bun.serve()` WebSocket API documented; native pub/sub, typed contextual data on ws.data |
| TECH-03 | Deployed to Railway with HTTPS; a single URL is shareable | Railway auto-detects Bun via Dockerfile; automatic SSL; single service WebSocket passthrough confirmed |
| TECH-04 | WebSocket client uses auto-reconnect wrapper (custom with exponential backoff) | Exponential backoff pattern documented; base 500ms, doubles per attempt, cap 30s, jitter required |
| TECH-05 | Sensor events normalized across iOS and Android before use in minigames | iOS/Android DeviceMotion axis polarity differences confirmed; normalization layer required — but sensor games are Phase 3, so Phase 1 only needs the scaffolding structure |
| SESS-01 | Admin can create a new game session and receive a 6-character join code | Server-side: generate 6-char alphanumeric code (excluding 0/O/1/I/l) in memory; admin route validates `?token=` param |
| SESS-02 | Players join by navigating to the app URL and entering the join code | `/` route: code input form; server validates code against active sessions |
| SESS-03 | On joining, player selects their role (groom or group member) and enters a display name | Multi-step wizard with role selector buttons and name input |
| SESS-04 | Only one player can claim the groom role per session; others auto-join as group | Server-side uniqueness check; WebSocket message sends current groom status on join request |
| SESS-05 | Admin authenticates via a secret token (env var) — no account needed | `ADMIN_TOKEN` env var; `?token=` query param check on `/admin` route |
| SESS-06 | Disconnected players automatically reconnect with exponential backoff and rejoin their session with full current state restored | Custom reconnect class + server sends full snapshot on reconnect; player identity persists via localStorage session token |
| SYNC-01 | All game state changes broadcast to all connected clients within 500ms | Bun native pub/sub via `server.publish()` — single in-process call; 500ms SLA trivially achievable with in-memory state |
| SYNC-02 | Server sends full state snapshot to any client that reconnects | On WS `open` event (server side), server sends full `gameState` snapshot to that client |
| SYNC-03 | Server sends heartbeat ping every 30 seconds to prevent Railway idle timeout | `setInterval` on server; Railway drops idle WS after 60s; 30s heartbeat interval is standard practice |
| SYNC-04 | Clients display a "Reconnecting..." overlay when connection is lost; auto-dismiss when restored | `onclose` → show overlay + start reconnect backoff; `onopen` → dismiss overlay + re-sync state |
| MOBX-01 | All views use `height: 100dvh` — portrait mobile, no fullscreen API | `100dvh` is Baseline Widely Available as of June 2025; ~95% global browser support |
| MOBX-02 | All interactive elements are touch-friendly (min 44px tap targets) | `touch-action: manipulation` eliminates 300ms tap delay; min-height 44px on all interactive elements |
| MOBX-03 | Wake Lock acquired during active minigames — re-acquired on visibilitychange | Wake Lock API supported Safari 16.4+; bug fixed in iOS 18.4 for PWAs; Phase 1 only establishes the utility function, not the game trigger |
| MOBX-04 | Landscape-detection overlay prompting portrait orientation if rotated | Pure CSS: `@media (orientation: landscape) { display: flex }` — `screen.orientation.lock()` is rejected on iOS |
| MOBX-05 | SvelteKit SSR is disabled on all game routes | `export const ssr = false` in each route's `+page.ts`; for whole-app SPA also set in root `+layout.ts` |

</phase_requirements>

---

## Summary

Phase 1 establishes the entire technical foundation for a mobile-first real-time party game. The stack is: **SvelteKit 5 (Svelte 5 runes) as the frontend SPA, a Bun `Bun.serve()` server that handles both static file serving and WebSocket upgrades on the same port, deployed as a single Railway service.** This architecture is validated by the existing project research (`.planning/research/`) and confirmed against current package versions.

The key technical challenge in Phase 1 is the **dual-entry monorepo**: `src/` is a standard SvelteKit project built to a static bundle, and `server/` is a Bun HTTP+WebSocket server that serves those static files and handles all WebSocket connections. Both live under one `package.json`. Bun replaces Node.js entirely — it runs the dev server, runs the WebSocket server, and is the production runtime.

The second major challenge is **mobile WebSocket reliability**. iOS terminates WebSocket connections when the screen locks or the app backgrounds — often without firing `onclose`. The solution (locked by D-03 and D-05) is a custom reconnect wrapper with exponential backoff. Since the server always sends a full state snapshot on reconnect, no client-side state reconciliation is needed.

**Primary recommendation:** Follow the architecture in `.planning/research/SUMMARY.md` exactly. All key decisions are locked. The executor's job is precise implementation, not design.

---

## Standard Stack

### Verified Package Versions (checked 2026-04-07 via npm registry)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.55.2 | UI component compiler, runes reactivity | Project requirement; smallest bundle (~47KB) |
| @sveltejs/kit | 2.57.0 | File-based routing, build pipeline | Project requirement; TECH-01 |
| bun (runtime) | 1.x (system: v25.8.2 installed) | WS server runtime, static file serving | Project requirement; TECH-02 |
| tailwindcss | 4.2.2 | Utility-first CSS (IF Tailwind path chosen) | Locked by D-09 — but see conflict note |
| @tailwindcss/vite | 4.2.2 | Vite plugin for Tailwind v4 | Required for Tailwind v4 setup |
| typescript | (bundled with SvelteKit) | Type safety | SvelteKit default |

> Note: `svelte-adapter-bun` (v1.0.1) exists but is only needed if using SvelteKit's SSR adapter. Since D-02 specifies Bun serving the SvelteKit **static build**, the correct adapter is `@sveltejs/adapter-static` (v3.0.10), not `svelte-adapter-bun`. Bun then serves the output of the static build directly.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sveltejs/adapter-static | 3.0.10 | Generates static HTML/JS/CSS bundle for Bun to serve | Required for the static build approach (D-02) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `adapter-static` + Bun file server | `svelte-adapter-bun` | Bun adapter embeds SvelteKit SSR inside Bun — heavier, unnecessary since SSR is disabled (MOBX-05). Static adapter + custom Bun server is simpler and matches D-02. |
| Custom reconnect wrapper | Socket.IO | Socket.IO adds ~40KB bundle and has built-in rooms/reconnect. User explicitly rejected this (D-03). |
| Native browser WebSocket | reconnecting-websocket npm package | Thin library option exists; user chose custom wrapper for full control. |

### Installation

```bash
# Create SvelteKit project with Bun
bun create svelte@latest .

# Core dependencies
bun add -d @sveltejs/adapter-static

# If Tailwind path chosen (D-09):
bun add tailwindcss @tailwindcss/vite
```

---

## Architecture Patterns

### Recommended Project Structure

```
octapp/
├── package.json            # single root package.json (D-01)
├── svelte.config.js        # adapter-static config
├── vite.config.ts          # Tailwind vite plugin (if used)
├── tsconfig.json
├── src/                    # SvelteKit frontend
│   ├── app.css             # global CSS / Tailwind import
│   ├── app.html            # HTML shell
│   ├── lib/
│   │   ├── socket.ts       # WebSocket reconnect wrapper + Svelte store
│   │   └── types.ts        # shared GameState type
│   └── routes/
│       ├── +layout.ts      # export const ssr = false (MOBX-05)
│       ├── +layout.svelte  # imports app.css, reconnect overlay, landscape overlay
│       ├── +page.svelte    # /  — join page
│       ├── admin/
│       │   └── +page.svelte   # /admin — admin dashboard
│       ├── groom/
│       │   └── +page.svelte   # /groom — groom waiting screen
│       └── party/
│           └── +page.svelte   # /party — group waiting screen
├── server/                 # Bun WebSocket server
│   ├── index.ts            # Bun.serve() entry point
│   ├── state.ts            # in-memory GameState singleton
│   ├── handlers.ts         # WS message handlers
│   └── session.ts          # join code generation, session management
└── build/                  # SvelteKit static output (gitignored)
```

### Pattern 1: Bun.serve() — Static Files + WebSocket on Same Port

**What:** A single `Bun.serve()` call handles all traffic. The `fetch` handler checks if the request is a WebSocket upgrade; if not, it serves static files from the `build/` directory.

**When to use:** Required by D-02 (one service, same port/URL).

```typescript
// server/index.ts
// Source: https://bun.sh/docs/api/websockets
const BUILD_DIR = new URL("../build", import.meta.url).pathname;

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const token = url.searchParams.get("sessionToken");
      const success = server.upgrade(req, { data: { sessionToken: token } });
      return success ? undefined : new Response("WS upgrade failed", { status: 400 });
    }

    // Serve static build
    const filePath = `${BUILD_DIR}${url.pathname === "/" ? "/index.html" : url.pathname}`;
    const file = Bun.file(filePath);
    return new Response(file);
  },
  websocket: {
    data: {} as { sessionToken: string | null; playerId: string | null },
    open(ws) { /* send full state snapshot */ },
    message(ws, msg) { /* handle join, action messages */ },
    close(ws, code, reason) { /* mark player disconnected */ },
    idleTimeout: 120, // Bun default; heartbeat keeps Railway from dropping at 60s
  },
});
```

### Pattern 2: Full State Snapshot Broadcast

**What:** After every mutation to `gameState`, serialize and broadcast the full state to all subscribers.

**When to use:** Required by D-04. Applied after every game event.

```typescript
// server/state.ts
export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
};

export type Player = {
  id: string;
  name: string;
  role: "groom" | "group";
  connected: boolean;
};

let gameState: GameState | null = null;

export function broadcastState(server: Server) {
  if (!gameState) return;
  const payload = JSON.stringify({ type: "STATE_SYNC", state: gameState });
  server.publish("game", payload);
}
```

### Pattern 3: Custom WebSocket Reconnect Wrapper

**What:** A thin class wrapping the native browser WebSocket with exponential backoff reconnect.

**When to use:** Required by D-03. Instantiated once in `src/lib/socket.ts`.

```typescript
// src/lib/socket.ts
// Source: https://websocket.org/guides/reconnection/ + custom implementation
import { writable } from "svelte/store";

export const gameState = writable<GameState | null>(null);
export const connectionStatus = writable<"connected" | "reconnecting" | "disconnected">("disconnected");

class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private maxAttempts = 15;
  private baseDelay = 500; // ms
  private maxDelay = 30_000; // ms
  private url: string;
  private sessionToken: string;

  constructor(url: string, sessionToken: string) {
    this.url = url;
    this.sessionToken = sessionToken;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(`${this.url}?sessionToken=${this.sessionToken}`);
    this.ws.onopen = () => {
      this.attempt = 0;
      connectionStatus.set("connected");
    };
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "STATE_SYNC") gameState.set(msg.state);
    };
    this.ws.onclose = () => {
      connectionStatus.set("reconnecting");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.attempt >= this.maxAttempts) return;
    const jitter = Math.random() * 0.5; // up to 50% additional delay
    const delay = Math.min(this.baseDelay * 2 ** this.attempt * (1 + jitter), this.maxDelay);
    this.attempt++;
    setTimeout(() => this.connect(), delay);
  }

  send(data: unknown) {
    this.ws?.send(JSON.stringify(data));
  }
}
```

### Pattern 4: SSR Disable — Whole App

**What:** Export `ssr = false` from the root layout to make the entire app a client-side SPA.

**When to use:** Required by MOBX-05. Game routes use browser APIs (`navigator`, `DeviceMotion`, WebSocket) that crash on the server.

```typescript
// src/routes/+layout.ts
// Source: https://svelte.dev/docs/kit/page-options
export const ssr = false;
export const prerender = false;
```

> Setting `ssr = false` in the root layout applies to all routes. With `adapter-static`, this produces an SPA with a single `index.html` shell — exactly what we need.

### Pattern 5: Tailwind v4 Vite Plugin Setup (if Tailwind path chosen)

**What:** Tailwind v4 uses a Vite plugin instead of PostCSS. Configuration is CSS-first, not `tailwind.config.js`.

**When to use:** Required by D-09 if the Tailwind/CSS conflict is resolved in favor of Tailwind.

```typescript
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

```css
/* src/app.css — Tailwind v4 CSS-first config */
@import "tailwindcss";

@theme {
  --color-bg: #0f0f0f;
  --color-surface: #1c1c1e;
  --color-accent-groom: #f59e0b;  /* amber-400 */
  --color-accent-group: #ef4444;  /* red-500 */
  --color-accent-admin: #6b7280;  /* gray-500 */
  --color-success: #22c55e;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
}
```

### Pattern 6: Landscape Overlay — Pure CSS

**What:** CSS media query shows a fixed overlay when device is landscape. No JavaScript.

**When to use:** Required by MOBX-04. `screen.orientation.lock()` is rejected on iOS.

```svelte
<!-- In +layout.svelte or a LandscapeOverlay.svelte component -->
<div class="landscape-overlay">
  <!-- inline SVG rotate icon -->
  <h2>Rotate your phone</h2>
  <p>This game is portrait only.</p>
</div>

<style>
  .landscape-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 200;
    background: #0f0f0f;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  @media (orientation: landscape) {
    .landscape-overlay {
      display: flex;
    }
  }
</style>
```

### Anti-Patterns to Avoid

- **Using `adapter-node` or `svelte-adapter-bun`:** Adds SSR/server-side rendering complexity. The project uses `adapter-static` + a custom Bun server. Keep them separate.
- **Splitting WS and HTTP to two ports:** D-02 requires same port. Railway exposes one port per service.
- **Accessing `window`/`navigator` at module level in Svelte components:** SSR will crash. Always inside `onMount()` or behind `if (browser)` — even though SSR is disabled globally, this is still defensive practice.
- **Relying on `onclose` alone for disconnect detection on iOS:** iOS may kill the WS without firing `onclose`. Pair with a missed-heartbeat detector on the client side (if no ping received in 35s, treat as disconnected).
- **Storing player identity only in server memory:** Players must be able to reconnect with the same identity. Store `playerId` in `localStorage` and send it on reconnect to re-register.
- **`screen.orientation.lock()`:** Always throws on iOS Safari. Use the CSS landscape overlay instead.
- **`100vh` instead of `100dvh`:** The static unit doesn't account for browser chrome; causes layout jumps on Safari.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tailwind custom theme tokens | Manual CSS variables parallel to Tailwind | Tailwind v4 `@theme` block in CSS | v4 CSS-first config makes custom tokens first-class; no duplication |
| WebSocket reconnect logic | Custom per-component reconnect | Single `src/lib/socket.ts` ReconnectingWebSocket | Centralizes all retry/backoff/state; components just subscribe to the store |
| Jitter calculation | Deterministic backoff | `Math.random() * 0.5 * delay` | Without jitter, all clients reconnect simultaneously and spike the server |
| Session code generation | `Math.random().toString(36)` | Whitelist character set explicitly (A-Z, 2-9 only) | Eliminates 0/O/1/I/l ambiguity that causes player join failures at a noisy venue |
| Bun static file server | Express static middleware | `Bun.file(path)` + content-type header | Bun has native file serving built in; no extra library needed |
| Railway port detection | Hardcode 3000 | `process.env.PORT ?? 3000` | Railway injects `PORT` at runtime; hardcoding causes bind failure |

**Key insight:** The game state is trivially small at ≤10 players. The reconnect pattern + full state snapshots mean the client never needs to know "what changed" — only "what is". This eliminates an entire class of merge conflict bugs.

---

## Common Pitfalls

### Pitfall 1: iOS WebSocket Killed on Screen Lock — No `onclose` Fired

**What goes wrong:** Player locks their iPhone. iOS kills the WebSocket TCP connection within ~30 seconds. No `onclose` event fires on the browser side. Player's app shows no reconnecting overlay — it just freezes.

**Why it happens:** iOS aggressively suspends background network connections. The browser's WebSocket implementation does not guarantee an `onclose` event when the connection is killed by the OS.

**How to avoid:** Implement both a `onclose` handler AND a heartbeat timeout detector. If the client receives no server ping for 35+ seconds, treat the connection as lost and trigger the reconnect flow manually.

**Warning signs:** During dev testing on iOS: lock screen, wait 30s, unlock — the app shows stale state without the "Reconnecting..." overlay.

### Pitfall 2: Railway 60-Second Idle Timeout

**What goes wrong:** Railway's load balancer drops WebSocket connections that have been idle for 60 seconds. On a quiet night between phases, all connections silently drop.

**Why it happens:** Railway uses a proxy that enforces idle timeouts on persistent connections.

**How to avoid:** Server sends a heartbeat ping message every 30 seconds to all connected clients via `server.publish()`. Client responds with a pong (or the ping alone is sufficient to keep the TCP connection alive from Railway's perspective).

**Warning signs:** During testing, connections drop precisely every 60–65 seconds when no messages are exchanged.

### Pitfall 3: `100vh` Viewport Height on iOS Safari

**What goes wrong:** Layout is clipped or jumps when the URL bar appears/disappears. Content at the bottom of the screen goes behind the browser chrome.

**Why it happens:** `100vh` on iOS Safari is calculated at the "maximum" viewport size (address bar hidden). When the address bar is visible, the real viewport is shorter, clipping the bottom of the layout.

**How to avoid:** Use `height: 100dvh` on all full-screen views. `dvh` is now Baseline Widely Available (June 2025, ~95% global support).

**Warning signs:** Bottom CTA button or role selector partially hidden behind Safari's bottom toolbar in portrait mode.

### Pitfall 4: Player Identity Lost on Reconnect

**What goes wrong:** Player reconnects after a drop. The server doesn't recognize them — they appear as a new anonymous connection. Their name, role, and session membership are gone.

**Why it happens:** WebSocket connections are ephemeral. A new connection has no inherent link to the previous one.

**How to avoid:** On initial join success, server generates a `playerId` (UUID) and sends it to the client. Client stores it in `localStorage`. On every reconnect, client sends `{ type: "REJOIN", playerId, sessionCode }` as the first message after the connection opens. Server re-registers the player to their existing session entry.

**Warning signs:** After a phone lock/unlock cycle, the player list on the admin view shows duplicate entries or a "new" player with no name.

### Pitfall 5: Static Build and SPA Fallback Route

**What goes wrong:** Player navigates directly to `/groom` or `/admin` (e.g., after a browser refresh). The Bun file server returns a 404 because there is no `groom/index.html` — the static adapter outputs only a root `index.html`.

**Why it happens:** `adapter-static` with `ssr = false` generates a single-page app with one shell HTML file. All routing is client-side. The file server must return `index.html` for all unknown paths.

**How to avoid:** In the Bun `fetch` handler, catch file-not-found cases and return `build/index.html` as the fallback.

```typescript
// server/index.ts — SPA fallback pattern
const file = Bun.file(filePath);
if (!(await file.exists())) {
  return new Response(Bun.file(`${BUILD_DIR}/index.html`));
}
return new Response(file);
```

**Warning signs:** Hard refresh on `/admin` returns an empty page or 404.

### Pitfall 6: Svelte 5 Runes Outside Component Files

**What goes wrong:** `$state()`, `$derived()`, `$effect()` runes fail at runtime when used in plain `.ts` files (not `.svelte` files).

**Why it happens:** Runes are compile-time transforms. They only work inside `.svelte` files by default.

**How to avoid:** For shared reactive state in `.ts` files (like `socket.ts`), use Svelte `writable` / `readable` stores from `svelte/store`. Runes-based state must live in `.svelte` files or `.svelte.ts` files (Svelte 5 supports the `.svelte.ts` extension for runes-compatible TypeScript modules).

**Warning signs:** `ReferenceError: $state is not defined` at runtime in the browser console.

### Pitfall 7: Tailwind v4 No Longer Uses `tailwind.config.js`

**What goes wrong:** Developer creates `tailwind.config.js` and sets `theme.extend.colors`. Colors don't appear.

**Why it happens:** Tailwind v4 uses a CSS-first configuration model. Theme customization is done in CSS using `@theme { }` blocks, not in a JavaScript config file.

**How to avoid:** Put all custom design tokens in `src/app.css` inside an `@theme { }` block. Use `@tailwindcss/vite` plugin (not PostCSS).

**Warning signs:** Custom colors added to `tailwind.config.js` don't generate utility classes. `tailwind.config.js` is silently ignored.

---

## Code Examples

### Join Code Generation (Server)

```typescript
// server/session.ts — avoids visually ambiguous characters
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
export function generateJoinCode(length = 6): string {
  return Array.from({ length }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}
```

### Server-Side Heartbeat (Server)

```typescript
// server/index.ts — prevents Railway 60s idle timeout (SYNC-03)
setInterval(() => {
  server.publish("game", JSON.stringify({ type: "PING", ts: Date.now() }));
}, 30_000);
```

### Admin Token Gate (Server)

```typescript
// server/index.ts — SESS-05
if (url.pathname === "/api/admin/session") {
  const token = url.searchParams.get("token") ?? req.headers.get("x-admin-token");
  if (token !== process.env.ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... create session
}
```

### SPA Fallback (Server)

```typescript
// server/index.ts — handles /admin, /groom, /party direct navigation
const filePath = `${BUILD_DIR}${url.pathname}`;
const file = Bun.file(filePath);
if (await file.exists()) {
  return new Response(file);
}
// SPA fallback — all unknown paths return index.html
return new Response(Bun.file(`${BUILD_DIR}/index.html`));
```

### Reconnecting Overlay (Svelte)

```svelte
<!-- src/lib/ReconnectingOverlay.svelte -->
<script lang="ts">
  import { connectionStatus } from "$lib/socket";
</script>

{#if $connectionStatus === "reconnecting"}
  <div class="overlay" style="pointer-events: all;">
    <div class="spinner" aria-hidden="true"></div>
    <h2>Reconnecting...</h2>
    <p>Hold tight — we'll get you back in the game.</p>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    height: 100dvh;
    background: rgba(28, 28, 30, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 100;
    transition: opacity 200ms ease-in;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #9ca3af;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
```

### Wake Lock Utility (for Phase 3 prep)

```typescript
// src/lib/wakeLock.ts — MOBX-03
// Phase 1: establish utility; Phase 3 calls it from minigame routes
let lock: WakeLockSentinel | null = null;

export async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    lock = await navigator.wakeLock.request("screen");
  } catch { /* low battery or power save mode — fail silently */ }
}

// Re-acquire on tab visibility change (spec: WakeLock auto-releases on background)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") acquireWakeLock();
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` for theme | `@theme {}` in CSS (`@tailwindcss/vite` plugin) | Tailwind v4 (early 2025) | No JS config file; custom tokens in CSS only |
| `100vh` for full-screen layouts | `100dvh` (dynamic viewport height) | Safari 15.4 (2022), Baseline 2025 | Eliminates iOS address bar clipping |
| Socket.IO for reconnect | Native WebSocket + custom exponential backoff | 2023+ (browser WebSocket matured) | ~40KB bundle reduction; full control |
| `screen.orientation.lock()` | CSS `@media (orientation: landscape)` overlay | Always broken on iOS | No-op on iOS; CSS is the only reliable approach |
| `svelte/store` writable for shared state | Svelte 5 `.svelte.ts` runes files | Svelte 5 (Oct 2024) | Runes work in `.svelte.ts` modules; stores still valid in `.ts` |
| `addEventListener('touchstart')` for tap | `pointer` events + `touch-action: manipulation` CSS | ~2020, reinforced in 2022+ | Unifies mouse/touch/stylus; eliminates 300ms delay without libraries |

**Deprecated/outdated:**
- **Hammer.js:** Last commit 2016. Do not use for gestures. Use native Pointer Events.
- **`-webkit-fill-available` hack for viewport:** Replaced by `dvh`. Only needed for iOS < 15.4.
- **NoSleep.js:** Wake Lock API is now in all major browsers (Safari 16.4+). Not needed.
- **`svelte-adapter-bun`:** Only relevant if you want SSR via Bun. This project uses `adapter-static`.

---

## Open Questions

1. **CRITICAL: Tailwind vs. Plain CSS — Which wins?**
   - What we know: CONTEXT.md D-09 locks Tailwind CSS as the user's explicit decision. The UI-SPEC (01-UI-SPEC.md) says "No Tailwind — plain CSS custom properties with BEM-style scoped Svelte styles. This keeps the bundle at ~47KB total."
   - What's unclear: The UI-SPEC was generated after CONTEXT.md by a separate UI research step. It's unclear whether the user reviewed and approved the UI-SPEC's override of D-09, or whether it was generated without the user's knowledge.
   - Recommendation: **Ask the user before writing any tasks.** Present both options: (A) Tailwind v4 as locked in D-09 — utility classes in templates, `@theme` for custom tokens; (B) Plain CSS custom properties in scoped Svelte `<style>` blocks as in the UI-SPEC — zero CSS framework overhead, smaller bundle. The UI-SPEC's color/spacing/animation tokens are already fully defined and can be implemented either way.

2. **Player identity on reconnect: localStorage token vs. re-entry**
   - What we know: SESS-06 requires reconnect with full state restored. The player must be re-recognized by the server.
   - What's unclear: Whether the user wants seamless silent re-registration (localStorage `playerId`) or a name/code re-entry prompt.
   - Recommendation: Silent re-registration via localStorage `playerId`. Store `{ playerId, sessionCode, role, name }` in `localStorage` on initial join success. On reconnect, send as `REJOIN` message. No user action required.

3. **Dev workflow: run SvelteKit dev server + Bun server simultaneously**
   - What we know: In development, `vite dev` runs the SvelteKit frontend on port 5173. The Bun WS server runs separately on another port (e.g., 3001). WebSocket connections in dev point to `ws://localhost:3001/ws`. In production, both are on the same port via the Bun static server.
   - Recommendation: Use `concurrently` or a `package.json` `"dev"` script that starts both: `"dev": "concurrently \"vite dev\" \"bun run server/index.ts --dev\""`. The WS URL should be env-var driven: `VITE_WS_URL=ws://localhost:3001/ws` in dev, derived from `window.location` in production.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun runtime | TECH-02, server entry point | ✓ | 1.x (system reports v25.8.2 as node; Bun not separately installed as CLI) | — |
| Node.js | SvelteKit/Vite build tooling | ✓ | v25.8.2 | — |
| npm | Package installation | ✓ | (via Node.js) | `bun install` |
| Railway CLI | Deployment | Not verified | — | Deploy via GitHub push (Railway dashboard) |

> Note: The system reports `node --version` as `v25.8.2` (Node.js Canary). Bun was not found as a standalone CLI (`bun` command). The project requires Bun as both package manager and runtime. **The executor must install Bun before beginning:** `curl -fsSL https://bun.sh/install | bash`.

**Missing dependencies with no fallback:**
- Bun runtime CLI — required for `bun run server/index.ts`. Install before starting.

**Missing dependencies with fallback:**
- Railway CLI — not required; GitHub push deploy works without it.

---

## Sources

### Primary (HIGH confidence)
- Bun WebSocket docs (https://bun.sh/docs/api/websockets) — `Bun.serve()` WebSocket API, handlers, pub/sub, idleTimeout, contextual data
- SvelteKit page options docs (https://svelte.dev/docs/kit/page-options) — `ssr = false` pattern, root layout vs per-route
- Tailwind CSS SvelteKit guide (https://tailwindcss.com/docs/guides/sveltekit) — v4 Vite plugin setup, `@theme` CSS block
- npm registry (2026-04-07) — verified versions: svelte@5.55.2, @sveltejs/kit@2.57.0, tailwindcss@4.2.2, @tailwindcss/vite@4.2.2, @sveltejs/adapter-static@3.0.10

### Secondary (MEDIUM confidence)
- Railway Bun deployment guide (https://docs.railway.com/guides/bun) — Dockerfile approach recommended; Nixpacks/Railpack for Bun support
- WebSocket.org reconnection guide (https://websocket.org/guides/reconnection/) — exponential backoff + jitter pattern, 500ms base, 30s cap
- MDN / web.dev — Wake Lock API browser support (Safari 16.4+, iOS PWA bug fixed iOS 18.4)
- iOS Safari 100dvh — Baseline Widely Available June 2025, ~95% global support

### Tertiary (LOW confidence)
- `.planning/research/SUMMARY.md` (internal, generated 2026-04-07) — architectural decisions, confidence assessments
- `.planning/research/frontend-stack.md` (internal, generated 2026-04-07) — framework comparison, iOS gotchas

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on research date
- Architecture: HIGH — validated against Bun official docs and existing project research
- Pitfalls: HIGH — iOS WebSocket, Railway timeout, `dvh` all confirmed from official/primary sources
- Tailwind/CSS conflict: requires user resolution — cannot proceed with styling tasks until resolved

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Tailwind v4 and SvelteKit are actively developed; re-verify versions before execution)
