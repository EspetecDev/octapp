# Backend & Deployment Research

**Domain:** Real-time party game server (WebSocket, ephemeral sessions, small scale)
**Researched:** 2026-04-07

---

## Recommendation

Use **Bun + Hono (or raw Bun.serve)** with **Socket.IO or native Bun WebSockets** for the game server, deployed to **Railway ($5/mo Hobby plan)**. This combination gives you the fastest dev experience, first-class persistent WebSocket support, and a dead-simple git-push deploy without fighting serverless limitations.

If cost must be zero, use **Render free tier** with the explicit understanding that the service sleeps after 15 minutes of inactivity — acceptable if you "wake it up" before the event starts.

---

## Options Compared

### Runtime / Framework

| Option | WebSocket Support | DX Speed | Notes |
|--------|------------------|----------|-------|
| **Bun + Bun.serve** | Native, built on uWebSockets, pub/sub built-in | Fastest | Recommended. 7x faster WS than Node+ws. No extra deps needed. |
| Node.js + Express + Socket.IO | Mature, well-documented | Fast | Safe fallback. Socket.IO adds reconnect, rooms, fallback transport. |
| Node.js + Fastify + ws | Good | Medium | More config, less magic than Socket.IO |
| Next.js API routes | Broken on serverless; needs custom server hack | Slow | Do not use. Adds complexity with zero benefit for a game-only backend. |
| Deno | WebSocket support fine, but smaller ecosystem | Medium | No strong reason to choose over Bun for this use case. |

**Verdict:** Bun for new projects (fast installs, native WS, built-in test runner). Node.js + Socket.IO if you want maximum StackOverflow coverage and battle-tested rooms/reconnect logic.

### Deployment

| Platform | WebSocket | Always-On | Cost | DX | Verdict |
|----------|-----------|-----------|------|----|---------|
| **Railway** | Yes, persistent | Yes | $5/mo (Hobby) | git push, zero config | **Top pick** |
| **Render** | Yes | No (sleeps after 15 min on free tier) | Free / $7/mo for always-on | Good | Use only if cost = $0 is hard requirement |
| **Fly.io** | Yes | Yes | ~$2/mo for smallest VM | Requires Docker | Good but more setup than Railway |
| Vercel | No native WS | N/A | Free | Zero config | **Do not use** for the game server |
| Cloudflare Workers + Durable Objects / PartyKit | Yes | Yes (serverless-stateful) | Free tier exists | Steep learning curve | Overkill for 5-10 users; worthwhile if going edge-native |

**Deployment verdict:** Railway wins for this project. $5/month gets you a persistent Node/Bun process, automatic HTTPS, WebSocket passthrough, and deploy-from-GitHub in under 5 minutes. No Docker required. Fly.io is a valid second option if you need a specific region or want sub-$2/mo on a shared 256 MB VM.

### Serverless vs Persistent Process

Serverless platforms (Vercel, standard Cloudflare Workers) **cannot** host a WebSocket game server. Key constraints:
- No long-lived connections — functions time out (Vercel max: 15 min even on Pro)
- No shared in-memory state between invocations
- No authoritative room/session coordinator

The **only** serverless path that works is Cloudflare Durable Objects (now via PartyKit, which Cloudflare acquired). Each Durable Object instance is a single-threaded stateful actor that holds WebSocket connections. This is architecturally elegant but has a meaningful learning curve. For a one-time 5-10-person party game, it is over-engineered.

**Use a persistent process. Railway or Fly.io.**

### State Management

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **In-memory JS object** | Zero deps, instant reads/writes, trivially simple | Lost on restart, no persistence | **Recommended** for a one-time event |
| SQLite (file-based) | Survives restarts, queryable | Render free tier loses disk on sleep/redeploy; Railway needs persistent disk addon | Unnecessary complexity for this use case |
| Redis | Fast pub/sub, survives restarts | Extra service, extra cost | Way overkill for 5-10 users |
| SQLite in-memory (`:memory:`) | Structured queries without disk | Same as plain JS object, just more syntax | No advantage over a plain object |

**Verdict:** Plain JavaScript object in a module singleton. The game is a single session, one-time event. State structure:
```js
const gameState = {
  phase: 'lobby',          // lobby | trivia | scavenger | done
  players: Map<code, player>,
  questions: [...],
  unlockedAt: null,
};
```
If the server restarts mid-game (almost never on Railway), the admin re-unlocks the phase. This is not a risk worth adding a database to solve.

### Session / Room Management (Join by Code)

Standard pattern for ephemeral sessions with no user accounts:

1. **Admin creates session** → server generates a short alphanumeric code (e.g. `OCTPP`) → stores in memory
2. **Player visits URL** → enters code → server validates code exists → assigns them a player ID (UUID or random name) stored in memory alongside the session
3. **WebSocket handshake** → client connects to `wss://your-app.railway.app` with the session code as a query param → server maps the socket to the session room
4. **Phase unlocking** → admin endpoint (password-protected or secret token) sets `gameState.phase` → server broadcasts `phase_change` event to all sockets in the room

With Socket.IO this maps directly to rooms: `io.to(sessionCode).emit('phase_change', newPhase)`.
With Bun native WebSockets: use the built-in pub/sub — `server.publish(sessionCode, JSON.stringify({ type: 'phase_change', phase }))`.

No database needed. No auth library needed. A `Map<sessionCode, SessionState>` in memory is sufficient.

---

## Key Findings

- Vercel (and serverless generally) is incompatible with WebSocket game servers — the architecture is fundamentally stateless and connection-lifetimed. Do not attempt to shoe-horn this.
- Render's free tier spins down after 15 minutes of no inbound traffic, including WebSocket keepalives. This means the server will be cold when guests arrive unless you ping it manually before the event.
- Railway has no true free tier as of 2026 — $5/month Hobby plan is the entry point, but this includes $5 in compute credits, so a small always-on service costs effectively nothing extra beyond the plan fee.
- Fly.io removed its free tier for new accounts in late 2024. A continuously running shared-CPU 256 MB VM costs ~$2/month. Requires Docker knowledge.
- Bun's WebSocket implementation (built on uWebSockets) has a native pub/sub API that maps perfectly to game rooms — no Socket.IO required, but Socket.IO's reconnect and fallback transport can simplify edge cases.
- PartyKit (now Cloudflare-owned) is the most elegant serverless solution for this domain, but is overkill here: Durable Objects have a meaningful mental model shift and the free tier limits need verification for production use.
- In-memory state is the right call for a one-time event. Adding SQLite or Redis introduces deployment complexity (persistent disk, extra service) with no user-facing benefit.
- Node.js 22+ has a built-in SQLite module (`node:sqlite`) — if you want lightweight persistence without an external dep, this is an option, but still not necessary here.

---

## Gotchas

### Render Free Tier: Cold Start Kills Party Games
The 15-minute sleep means guests who arrive and try to connect will hit a cold start (~60 seconds of nothing). You must either pay for always-on ($7/mo) or manually hit the server before the event. Not a problem if you account for it; a disaster if you forget.

### Railway 60-Second Idle WebSocket Timeout
Railway drops WebSocket connections idle for over 60 seconds. Implement a client-side heartbeat ping every 30 seconds. This is standard practice but easy to miss.

### Fly.io Docker Requirement
Fly.io requires a Dockerfile or recognized buildpack. For a pure Bun app, the official Bun Docker image works, but it adds a step Railway doesn't require. Don't use Fly.io just because it's slightly cheaper — Railway's DX advantage is worth $3/month.

### Next.js Custom Server Breaks Vercel
If you try to add WebSocket support to a Next.js app via a custom server (`server.js`), it will deploy fine locally but **will not work on Vercel** — Vercel ignores custom servers entirely. The game would appear to work in dev and break silently in production. Avoid mixing Next.js frontend + game server in one Next.js deployment on Vercel.

### No Persistent Disk on Railway Without Addon
If you decide you want SQLite persistence later, Railway requires attaching a Volume (persistent disk). The Hobby plan supports this but it costs extra. Design the state around in-memory from the start to avoid this path.

### Session Code Collisions
With short codes like `ABCD`, collisions are possible if you run multiple sessions. For a single one-time event this is irrelevant, but generate codes with enough entropy (6 alphanumeric chars = 26^6 = ~300 million combos) to be safe.

### Admin Auth Must Not Be Production-Grade Security Theater
A hardcoded secret token in an environment variable (`ADMIN_TOKEN=xyz`) is sufficient. Do not spend time implementing JWT or OAuth for an admin endpoint that one person will use for 3 hours.

---

## Sources

- [Railway vs Render vs Fly.io 2026 — PkgPulse](https://www.pkgpulse.com/blog/railway-vs-render-vs-fly-io-app-hosting-platforms-nodejs-2026)
- [Heroku vs Railway vs Render vs Fly.io 2026 — TheSoftwareScout](https://thesoftwarescout.com/heroku-vs-railway-vs-render-vs-fly-io-2026-which-platform-should-you-deploy-on/)
- [Railway Free Tier 2026 — SaaSPricePulse](https://www.saaspricepulse.com/tools/railway)
- [Fly.io Free Allowance 2026: Gone — SaaSPricePulse](https://www.saaspricepulse.com/tools/flyio)
- [Fly.io Pricing Docs](https://fly.io/docs/about/pricing/)
- [Render Free Tier Spin Down — Render Community](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303)
- [Vercel WebSocket Limitations — Vercel KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Cloudflare Durable Objects vs Socket.IO — Ably](https://ably.com/compare/cloudflare-durable-objects-vs-socketio)
- [PartyKit acquired by Cloudflare — Cloudflare Blog](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [Bun WebSocket Docs](https://bun.com/docs/runtime/http/websockets)
- [Bun vs Node.js WebSocket benchmark — Daniel Lemire](https://lemire.me/blog/2023/11/25/a-simple-websocket-benchmark-in-javascript-node-js-versus-bun/)
- [Next.js WebSocket limitations — GitHub Discussion](https://github.com/vercel/next.js/discussions/14950)
