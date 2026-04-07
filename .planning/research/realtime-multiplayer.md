# Real-Time Multiplayer Research

**Domain:** Small-group party game (5-10 players, ephemeral session, event-driven)
**Researched:** 2026-04-07
**Overall confidence:** HIGH (verified against official docs + multiple sources)

---

## Recommendation

**Use PartyKit (deployed to your own Cloudflare account).** It is purpose-built for exactly this use case: ephemeral, stateful, room-per-session WebSocket servers that run at the edge with zero infrastructure to manage. Rooms auto-teardown when the last player disconnects, deployment is a single CLI command, and the cost at bachelor-party scale is effectively zero (Cloudflare Workers free tier covers it).

If PartyKit feels like too much novelty, **Ably Channels** is the safe second choice: generous free tier (6M messages/month, 200 concurrent connections), battle-tested, and requires no server at all.

---

## Transport Layer: WebSocket vs SSE vs Polling

| Transport | Direction | Overhead | Reconnect | Best for this app? |
|-----------|-----------|----------|-----------|-------------------|
| **WebSocket** | Bidirectional | ~2 bytes/frame after handshake | Manual (but libraries handle it) | YES — players must push events to server |
| SSE (Server-Sent Events) | Server → Client only | Low, built-in reconnect | Automatic | NO — players sending power-ups need client→server |
| Long polling | Pseudo-bidirectional | High (full HTTP headers each trip) | Automatic | NO — chatty, high latency, unnecessary complexity |
| Short polling | Client-pull only | Very high | N/A | Hard no — unacceptable latency |

**Verdict:** WebSocket is the only real choice for a bidirectional party game. SSE could theoretically handle the "groom sees effects" read path, but you still need a write channel, and mixing protocols adds complexity for no gain at this scale. Long polling is legacy at this point — don't use it.

At 5-10 players, the persistent connection count is trivially small. Every managed service below handles this on their free tier.

---

## Options Compared

### Managed Services

| Service | Free Tier | Connections (free) | Messages (free) | Ephemeral Rooms | Self-hosted? | Verdict |
|---------|-----------|-------------------|-----------------|-----------------|--------------|---------|
| **PartyKit** | Yes (Cloudflare acct) | Unlimited (Workers model) | Workers free tier | Native — built-in concept | No (CF edge) | Best fit |
| **Ably Channels** | Yes | 200 concurrent | 6M/month | Manual (channel per room) | No | Excellent fallback |
| **Pusher Channels** | Yes (Sandbox) | 100 concurrent | 200K/day | Manual (channel per room) | No | Adequate, lower limits |
| **Supabase Realtime** | Yes (Free project) | 200 concurrent | 100 msg/sec | Manual | No | Overkill, DB-oriented |
| **Firebase RTDB** | Yes (Spark) | 100 simultaneous | Bandwidth-based | Manual | No | Heavyweight, Google lock-in |

### Self-Hosted Options

| Option | Complexity | Deployment | Room Pattern | Reconnect | Verdict |
|--------|------------|------------|--------------|-----------|---------|
| **Socket.io** (Node.js) | Medium | Needs a server (Railway, Fly.io, Render) | Built-in room support | Built-in w/ fallback | Good if you want control |
| **ws** (raw WebSocket) | High | Needs a server | Manual implementation | Manual | Too much boilerplate |
| **Colyseus** | Medium-High | Needs a server | Built-in, game-optimized | Built-in | Overengineered for this |

---

## Key Findings

- **PartyKit was acquired by Cloudflare** (2024) and is now backed by Cloudflare Durable Objects. Each room is a Durable Object — a tiny stateful serverless sandbox. This is the exact primitive you want: one object per game session, auto-cleaned up, globally distributed. Deploying to your own Cloudflare account means you pay CF rates, not a PartyKit markup. At 5-10 connections per room for a few hours, cost rounds to $0.

- **PartyKit rooms are naturally ephemeral.** State lives in memory for the duration of connections. When the last player disconnects, the Durable Object hibernates and storage (if used) persists only if you write it explicitly. For a one-time game session, you write nothing and pay nothing.

- **Ably's free tier is genuinely usable:** 6M messages/month and 200 concurrent connections. A bachelor party session generating a message per second across 10 players for 3 hours = ~108K messages total. That's 1.8% of the monthly free allowance. Even with spammy power-ups, you won't hit the ceiling.

- **Pusher's free Sandbox** caps at 100-200 concurrent connections and 200K messages/day. Fine for this app, but Ably's limits are more generous and Ably's SDK is better maintained.

- **Firebase RTDB** is overkill here. It is a synchronised JSON tree, not an event bus. You'd be bending it into an event-driven shape. The 100 simultaneous connections limit on the Spark plan is tight (though fine for 5-10). Avoid unless you're already on Firebase for auth.

- **Supabase Realtime** is primarily designed for broadcasting database row changes. Using it as a pure event bus for a game is possible but feels wrong. The free tier pauses inactive projects after 1 week, which matters for a one-shot app you might test and then deploy a month later.

- **Socket.io remains a solid self-hosted option** if you want full control and are comfortable deploying a Node.js server. Its main value-adds over raw WebSocket: automatic reconnection, fallback transports, built-in rooms/namespaces, and event-based API. At 5-10 players, the overhead versus raw WS is irrelevant. The real cost is you need to provision a server (a free Railway or Render instance works).

- **SSE + fetch hybrid pattern** (SSE for server-push, fetch POST for client events) is a legitimate architecture for simple cases, but it means managing two connection types, and SSE has a browser limit of 6 concurrent connections per domain — not a problem here but an unnecessary constraint to work around.

- **Room/session join-by-code pattern** is well-established. Standard implementation: server generates a short alphanumeric code (4-6 chars) as the room identifier, clients connect to `wss://server/party/{code}` or subscribe to channel `game:{code}`. Admin creates the room, shares the code verbally or via QR, players join. In PartyKit this is literally the URL: `usePartySocket({ room: code })`. In Ably/Pusher it's a channel name string.

---

## Gotchas

### Mobile Browser / WebSocket Reliability

**iOS Safari background kills (CRITICAL)**
When an iPhone user switches apps or locks the screen, iOS may terminate the WebSocket connection within seconds, with no `onclose` event fired on the client. This is the most dangerous gotcha for a party game where players are expected to have their phones in their hands but may briefly tab away. Mitigation: implement aggressive client-side reconnect logic with short exponential backoff (try after 1s, 2s, 4s). PartySocket (PartyKit's client) and Socket.io v4+ handle this automatically. Raw WebSocket does not.

**Android Chrome background throttle**
Android Chrome suspends JavaScript timers when the screen is off but does NOT kill WebSocket connections immediately. However, it suspends `setInterval`/`setTimeout`, which breaks ping/heartbeat mechanisms. Socket.io v4 fixed this by moving the ping responsibility to the server side. If rolling your own WebSocket, rely on server-sent pings, not client timers.

**iOS 15+ NSURLSession WebSocket regression**
Safari 15 introduced a new WebSocket backend (`NSURLSession`) that has had reliability issues, notably closing connections when the user switches to another app. Workaround: use a library that handles reconnect automatically rather than the raw browser WebSocket API directly. The issue is partially mitigated in later iOS versions but not fully resolved.

**HTTP/2 connection reuse on mobile**
Some mobile network operators aggressively close idle TCP connections. Keep-alive pings from the server side (every 20-30 seconds) prevent this. Most managed services do this for you; raw WebSocket servers need explicit server-side ping frames.

### Party Game Specific

**Code collision with short room codes**
4-character alphanumeric codes give 36^4 = ~1.7M combinations, which is more than enough for concurrent sessions, but consider excluding visually ambiguous characters (0/O, 1/I/l) for verbal readability at a bachelor party.

**Admin reconnect / session recovery**
If the admin (the person unlocking phases) loses connectivity and reconnects, the game state must be preserved server-side. In PartyKit, keep the current phase and player list in the Durable Object's in-memory state. In Ably/Pusher, you need a small backend or client-side state reconciliation on reconnect. PartyKit wins here because the state lives inside the room itself.

**Groom's phone as display**
If the groom's phone acts as the primary display, it may be the most-viewed screen — but it's also at risk of being set down. Implement a "reconnect spinner" overlay rather than a hard reload requirement. PartySocket's auto-reconnect is ideal for this.

**Message ordering for power-ups/sabotages**
At 5-10 players sending simultaneous power-ups, message ordering matters. WebSocket guarantees ordering per-connection (TCP), but if two players fire simultaneously, the server processes them in arrival order. Design the game logic to be last-write-wins or queue-with-sequence-number, not assume atomic transactions. This is simpler than it sounds — just apply effects in the order messages arrive and broadcast the canonical state.

**Browser connection limits**
Browsers limit SSE to 6 connections per origin (HTTP/1.1) but have no such limit for WebSocket. Not an issue for this app, but it's why SSE was eliminated above.

**CORS and mixed content**
If your frontend is on HTTPS (it must be, on mobile), your WebSocket endpoint must be `wss://` not `ws://`. Browsers block mixed content. All managed services (Ably, Pusher, PartyKit) use `wss://` by default. Self-hosted on a free tier needs TLS termination — Railway and Render provide this automatically.

---

## Recommended Implementation Pattern

```
Client (phone browser)
  └─ PartySocket → wss://[app].partykit.dev/parties/main/[ROOM_CODE]
                              │
                    PartyKit Durable Object
                    (one per ROOM_CODE)
                              │
                    In-memory state:
                    - currentPhase
                    - players[]
                    - activePowerUps[]
                              │
                    Broadcasts state delta on:
                    - admin: phase_unlock
                    - player: powerup_send
                    - player: sabotage_send
                    - server: tick (optional heartbeat)
```

Message shape recommendation: always broadcast **full state snapshot** (not deltas) on every event. At 5-10 players with infrequent events, the payload is tiny and state reconciliation on reconnect becomes trivial — you just re-send the current state to the reconnecting client.

---

## Sources

- [PartyKit How It Works](https://docs.partykit.io/how-partykit-works/)
- [PartyKit joins Cloudflare](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/)
- [Cloudflare acquires PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [Cloudflare Durable Objects on Free Plan](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/)
- [Ably Free Tier Limits](https://ably.com/docs/platform/pricing/free)
- [Ably vs Supabase Realtime](https://ably.com/compare/ably-vs-supabase)
- [Pusher Channels Pricing](https://pusher.com/channels/pricing/)
- [Firebase Realtime Database Limits](https://firebase.google.com/docs/database/usage/limits)
- [Socket.IO Troubleshooting Connection Issues](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [WebSockets vs SSE - Ably](https://ably.com/blog/websockets-vs-sse)
- [WebSockets vs Long Polling - Ably](https://ably.com/blog/websockets-vs-long-polling)
- [Robust WebSocket Reconnection with Exponential Backoff](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [Supabase Realtime background WebSocket issue](https://github.com/supabase/realtime-js/issues/121)
- [Safari iOS WebSocket on lock screen](https://github.com/enisdenjo/graphql-ws/discussions/290)
- [Socket.IO vs WebSocket Guide 2025](https://velt.dev/blog/socketio-vs-websocket-guide-developers)
- [SSE vs WebSockets vs Long Polling 2025](https://dev.to/haraf/server-sent-events-sse-vs-websockets-vs-long-polling-whats-best-in-2025-5ep8)
