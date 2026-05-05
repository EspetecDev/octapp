import { createSession, getSession } from "./session.ts";
import { getState, setState, broadcastState } from "./state.ts";
import { handleOpen, handleMessage, handleClose, type WSData } from "./handlers.ts";

const BUILD_DIR = new URL("../build", import.meta.url).pathname;

// Create the initial game session on server start
// Admin will be given the session code when they hit /api/admin/session
const sessionCode = createSession();
console.log(`[octapp] Session created. Join code: ${sessionCode}`);
console.log(`[octapp] Admin token: ${process.env.ADMIN_TOKEN ?? "(not set)"}`);
console.log(`[octapp] Groom token: ${process.env.GROOM_TOKEN ?? "(not set)"}`);;

const server = Bun.serve<WSData>({
  port: Number(process.env.PORT ?? 3000),

  fetch(req, server) {
    const url = new URL(req.url);

    // --- Health check (railway.toml healthcheckPath="/health") ---
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // FIX-02 verification route — triggers an unhandled rejection to confirm the handler fires
    // Can be removed after manual verification; safe to leave in (no side effects when not called)
    if (url.pathname === "/test-crash") {
      // Fire-and-forget rejected promise — not awaited, so it becomes an unhandledRejection
      Promise.reject(new Error("[octapp] Test crash — verifying unhandledRejection handler"));
      return new Response("Crash triggered — check logs", { status: 200 });
    }

    // --- Admin token gate (SESS-05) ---
    if (url.pathname === "/api/admin/session") {
      const token = url.searchParams.get("token") ?? req.headers.get("x-admin-token");
      if (!token || token !== process.env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const state = getSession(sessionCode);
      return Response.json({
        sessionCode: state?.sessionCode ?? sessionCode,
        groomToken: process.env.GROOM_TOKEN ?? null,
      });
    }

    // --- Groom auto-join: protected by GROOM_TOKEN if set ---
    if (url.pathname === "/api/groom/join" && req.method === "POST") {
      const groomToken = process.env.GROOM_TOKEN;
      if (groomToken) {
        const provided = req.headers.get("x-groom-token");
        if (!provided || provided !== groomToken) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      const state = getState();
      if (!state) {
        return new Response("No active session", { status: 503 });
      }
      if (state.groomPlayerId !== null) {
        return Response.json({ error: "Groom role already taken" }, { status: 409 });
      }
      const playerId = crypto.randomUUID();
      setState((s) => ({
        ...s,
        players: [...s.players, { id: playerId, name: "Groom", role: "groom" as const, connected: false }],
        groomPlayerId: playerId,
      }));
      const updatedState = getState();
      if (updatedState) {
        server.publish("game", JSON.stringify({ type: "STATE_SYNC", state: updatedState }));
      }
      return Response.json({ playerId, sessionCode: state.sessionCode });
    }

    // --- WebSocket upgrade ---
    if (url.pathname === "/ws") {
      const success = server.upgrade<WSData>(req, {
        data: { playerId: null, sessionCode: null },
      });
      return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    // --- Static file serving (SvelteKit build output) ---
    // Map "/" to "/index.html"
    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = `${BUILD_DIR}${requestPath}`;
    const file = Bun.file(filePath);

    // Return file if it exists; otherwise return index.html for SPA routing (Pitfall 5)
    return file.exists().then((exists) => {
      if (exists) return new Response(file);
      return new Response(Bun.file(`${BUILD_DIR}/index.html`));
    });
  },

  websocket: {
    open(ws) {
      handleOpen(ws, server);
    },
    message(ws, msg) {
      handleMessage(ws, msg, server);
    },
    close(ws) {
      handleClose(ws, server);
    },
    idleTimeout: 120, // Bun-level timeout; heartbeat below keeps Railway proxy alive
  },
});

// Server-side heartbeat every 30s to prevent Railway 60s idle timeout (SYNC-03)
// Source: RESEARCH.md Code Examples "Server-Side Heartbeat"
setInterval(() => {
  server.publish("game", JSON.stringify({ type: "PING", ts: Date.now() }));
}, 30_000);

// Prevent unhandled exceptions from crashing the process and wiping in-memory game state
// FIX-02 prerequisite — full handler deferred to Phase 7, this is the safety net
process.on("uncaughtException", (err) => {
  console.error("[octapp] Uncaught exception (process kept alive):", err);
});

// FIX-02: Also handle unhandled Promise rejections — the other common async crash vector (D-04, D-05, D-06)
process.on("unhandledRejection", (reason: unknown, _promise: Promise<unknown>) => {
  console.error("[octapp] Unhandled rejection (process kept alive):", reason);
});

console.log(`[octapp] Server running on port ${server.port}`);
