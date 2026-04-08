import { createSession, getSession } from "./session.ts";
import { broadcastState } from "./state.ts";
import { handleOpen, handleMessage, handleClose, type WSData } from "./handlers.ts";

const BUILD_DIR = new URL("../build", import.meta.url).pathname;

// Create the initial game session on server start
// Admin will be given the session code when they hit /api/admin/session
const sessionCode = createSession();
console.log(`[octapp] Session created. Join code: ${sessionCode}`);
console.log(`[octapp] Admin token: ${process.env.ADMIN_TOKEN ?? "(not set)"}`);

const server = Bun.serve<WSData>({
  port: Number(process.env.PORT ?? 3000),

  fetch(req, server) {
    const url = new URL(req.url);

    // --- Health check (railway.toml healthcheckPath="/health") ---
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // --- Admin token gate (SESS-05) ---
    if (url.pathname === "/api/admin/session") {
      const token = url.searchParams.get("token") ?? req.headers.get("x-admin-token");
      if (!token || token !== process.env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      const state = getSession(sessionCode);
      return Response.json({ sessionCode: state?.sessionCode ?? sessionCode });
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

console.log(`[octapp] Server running on port ${server.port}`);
