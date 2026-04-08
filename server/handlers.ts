import type { ServerWebSocket, Server } from "bun";
import { getState, setState, broadcastState, type Player, type Chapter, type PowerUp } from "./state.ts";
import { getSession } from "./session.ts";

// Data attached to each WebSocket connection (available as ws.data)
export type WSData = {
  playerId: string | null;
  sessionCode: string | null;
};

type IncomingMessage =
  | { type: "JOIN"; sessionCode: string; name: string; role: "groom" | "group" }
  | { type: "REJOIN"; playerId: string; sessionCode: string }
  | { type: "PONG" }
  | { type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[] }
  | { type: "UNLOCK_CHAPTER" };

export function handleOpen(ws: ServerWebSocket<WSData>, server: Server): void {
  // Subscribe this connection to the game broadcast channel
  ws.subscribe("game");

  // Send full state snapshot immediately on connect (SYNC-02)
  const state = getState();
  if (state) {
    ws.send(JSON.stringify({ type: "STATE_SYNC", state }));
  }
}

export function handleMessage(
  ws: ServerWebSocket<WSData>,
  rawMsg: string | Buffer,
  server: Server
): void {
  let msg: IncomingMessage;
  try {
    msg = JSON.parse(typeof rawMsg === "string" ? rawMsg : rawMsg.toString()) as IncomingMessage;
  } catch {
    ws.send(JSON.stringify({ type: "ERROR", code: "UNKNOWN", message: "Invalid message format." }));
    return;
  }

  if (msg.type === "JOIN") {
    const session = getSession(msg.sessionCode);
    if (!session) {
      ws.send(JSON.stringify({
        type: "ERROR",
        code: "WRONG_CODE",
        message: "That code doesn't match any active game. Check with your host.",
      }));
      return;
    }

    const name = msg.name?.trim();
    if (!name || name.length < 1 || name.length > 40) {
      ws.send(JSON.stringify({
        type: "ERROR",
        code: "INVALID_NAME",
        message: "Enter your name to join.",
      }));
      return;
    }

    // Groom uniqueness check (SESS-04)
    if (msg.role === "groom" && session.groomPlayerId !== null) {
      ws.send(JSON.stringify({
        type: "ERROR",
        code: "GROOM_TAKEN",
        message: "Someone already claimed the Groom role. Join as Group.",
      }));
      return;
    }

    // Create player with a UUID (Bun has Crypto.randomUUID natively)
    const playerId = crypto.randomUUID();
    ws.data.playerId = playerId;
    ws.data.sessionCode = msg.sessionCode;

    setState((s) => {
      const player: Player = { id: playerId, name, role: msg.role, connected: true };
      const players = [...s.players, player];
      return {
        ...s,
        players,
        groomPlayerId: msg.role === "groom" ? playerId : s.groomPlayerId,
      };
    });

    // Send the playerId back to this client so they can store it in localStorage (SESS-06)
    ws.send(JSON.stringify({ type: "PLAYER_JOINED", playerId }));

    // Broadcast updated state to all connected clients (SYNC-01, D-04)
    broadcastState(server);
    return;
  }

  if (msg.type === "REJOIN") {
    const session = getSession(msg.sessionCode);
    if (!session) return; // silently drop — session may have ended

    const existingPlayer = session.players.find((p) => p.id === msg.playerId);
    if (!existingPlayer) return; // unknown player — they may need to re-join fresh

    // Re-register this WS connection to the existing player entry
    ws.data.playerId = msg.playerId;
    ws.data.sessionCode = msg.sessionCode;

    // Mark player as reconnected
    setState((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === msg.playerId ? { ...p, connected: true } : p
      ),
    }));

    // Send full state snapshot to reconnecting client (SYNC-02)
    const updatedState = getState();
    if (updatedState) {
      ws.send(JSON.stringify({ type: "STATE_SYNC", state: updatedState }));
    }

    // Broadcast to others that this player reconnected
    broadcastState(server);
    return;
  }

  // PONG — no-op; ping alone keeps Railway alive

  if (msg.type === "SAVE_SETUP") {
    const state = getState();
    if (!state || state.phase !== "lobby") {
      ws.send(JSON.stringify({
        type: "ERROR",
        code: "UNKNOWN",
        message: "Setup is locked after the game starts.",
      }));
      return;
    }
    setState((s) => ({
      ...s,
      chapters: msg.chapters,
      powerUpCatalog: msg.powerUpCatalog,
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "UNLOCK_CHAPTER") {
    const state = getState();
    if (!state) return;

    const nextIndex = state.activeChapterIndex === null ? 0 : state.activeChapterIndex + 1;

    if (state.chapters.length === 0 || nextIndex >= state.chapters.length) {
      ws.send(JSON.stringify({
        type: "ERROR",
        code: "UNKNOWN",
        message: nextIndex >= state.chapters.length
          ? "No more chapters."
          : "No chapters configured. Set up the game first.",
      }));
      return;
    }

    setState((s) => {
      // Initialize scores to 0 for all current players on the first unlock (D-07)
      const scores: Record<string, number> = { ...s.scores };
      if (s.activeChapterIndex === null) {
        s.players.forEach((p) => { if (!(p.id in scores)) scores[p.id] = 0; });
      }

      // Set servedQuestionIndex on the newly active chapter (Pitfall 5 fix)
      // Pick a random question from the trivia pool; null if pool is empty or not trivia
      const updatedChapters = s.chapters.map((ch, i) => {
        if (i !== nextIndex) return ch;
        if (ch.minigameType !== "trivia" || ch.triviaPool.length === 0) {
          return { ...ch, servedQuestionIndex: null };
        }
        return {
          ...ch,
          servedQuestionIndex: Math.floor(Math.random() * ch.triviaPool.length),
        };
      });

      return {
        ...s,
        phase: "active",
        activeChapterIndex: nextIndex,
        scores,
        chapters: updatedChapters,
      };
    });

    broadcastState(server);
    return;
  }
}

export function handleClose(
  ws: ServerWebSocket<WSData>,
  server: Server
): void {
  if (!ws.data.playerId) return;

  setState((s) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === ws.data.playerId ? { ...p, connected: false } : p
    ),
  }));

  broadcastState(server);
}
