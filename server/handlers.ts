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
  | { type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[]; startingTokens: number }
  | { type: "UNLOCK_CHAPTER" }
  | { type: "MINIGAME_COMPLETE"; result: "win" | "loss" }
  | { type: "SCAVENGER_DONE" }
  | { type: "HINT_REQUEST" }
  | { type: "SPEND_TOKEN"; powerUpIndex: number }
  | { type: "EARN_TOKEN" };

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
      startingTokens: msg.startingTokens ?? 0,
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
          return { ...ch, servedQuestionIndex: null, minigameDone: false, scavengerDone: false };
        }
        return {
          ...ch,
          servedQuestionIndex: Math.floor(Math.random() * ch.triviaPool.length),
          minigameDone: false,
          scavengerDone: false,
        };
      });

      // Initialize tokenBalances for all current group players (D-03)
      const tokenBalances: Record<string, number> = {};
      const startingTokens = s.startingTokens ?? 0;
      s.players
        .filter((p) => p.role === "group")
        .forEach((p) => { tokenBalances[p.id] = startingTokens; });

      return {
        ...s,
        phase: "active",
        activeChapterIndex: nextIndex,
        scores,
        tokenBalances,           // initialize per-chapter token balances
        recentActions: [],       // clear log on new chapter
        chapters: updatedChapters,
      };
    });

    broadcastState(server);
    return;
  }

  if (msg.type === "MINIGAME_COMPLETE") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;
    // Idempotency guard (Pitfall 7): do not double-apply score if already done
    if (state.chapters[state.activeChapterIndex]?.minigameDone) return;
    const groomId = state.groomPlayerId;
    const delta = msg.result === "win" ? 50 : -20;
    setState((s) => {
      const updatedChapters = s.chapters.map((ch, i) =>
        i === s.activeChapterIndex ? { ...ch, minigameDone: true } : ch
      );
      return {
        ...s,
        chapters: updatedChapters,
        scores: groomId
          ? { ...s.scores, [groomId]: (s.scores[groomId] ?? 0) + delta }
          : s.scores,
      };
    });
    broadcastState(server);
    return;
  }

  if (msg.type === "SCAVENGER_DONE") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;
    setState((s) => {
      const updatedChapters = s.chapters.map((ch, i) =>
        i === s.activeChapterIndex ? { ...ch, scavengerDone: true } : ch
      );
      return { ...s, chapters: updatedChapters };
    });
    broadcastState(server);
    return;
  }

  if (msg.type === "HINT_REQUEST") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;
    const groomId = state.groomPlayerId;
    if (!groomId) return;
    setState((s) => ({
      ...s,
      scores: { ...s.scores, [groomId]: (s.scores[groomId] ?? 0) - 10 },
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "SPEND_TOKEN") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;

    const spenderId = ws.data.playerId;
    if (!spenderId) return;

    const powerUp = state.powerUpCatalog[msg.powerUpIndex];
    if (!powerUp) return; // invalid index — silently drop

    const balance = state.tokenBalances?.[spenderId] ?? 0;
    if (balance < powerUp.tokenCost) return; // insufficient balance — silently drop

    // Pitfall 4: scramble_options only valid during trivia
    const activeChapter = state.chapters[state.activeChapterIndex];
    if (powerUp.effectType === "scramble_options" && activeChapter?.minigameType !== "trivia") return;

    const spenderPlayer = state.players.find((p) => p.id === spenderId);
    const playerName = spenderPlayer?.name ?? "Unknown";

    // Compute delta for timer effects (D-10)
    let delta: number | undefined;
    if (powerUp.effectType === "timer_add") delta = 5;
    else if (powerUp.effectType === "timer_reduce") delta = -5;

    setState((s) => {
      const newBalances = { ...s.tokenBalances, [spenderId]: (s.tokenBalances?.[spenderId] ?? 0) - powerUp.tokenCost };
      const newAction = { playerName, powerUpName: powerUp.name, timestamp: Date.now() };
      const newActions = [newAction, ...(s.recentActions ?? [])].slice(0, 20);
      return { ...s, tokenBalances: newBalances, recentActions: newActions };
    });

    // Broadcast state update (balances + feed)
    broadcastState(server);

    // Broadcast EFFECT_ACTIVATED as a separate event (never stored in GameState — Pitfall 1)
    server.publish("game", JSON.stringify({
      type: "EFFECT_ACTIVATED",
      activatedBy: spenderId,
      powerUpName: powerUp.name,
      effectType: powerUp.effectType,
      ...(delta !== undefined ? { delta } : {}),
    }));
    return;
  }
}

  if (msg.type === "EARN_TOKEN") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;

    const earnerId = ws.data.playerId;
    if (!earnerId) return;

    // Only group players can earn tokens
    const earner = state.players.find((p) => p.id === earnerId);
    if (!earner || earner.role !== "group") return;

    const currentBalance = state.tokenBalances?.[earnerId] ?? 0;
    const cap = state.startingTokens ?? 0;

    // Cap: balance cannot exceed 2× startingTokens (earn up to startingTokens extra)
    const maxBalance = cap * 2;
    if (currentBalance >= maxBalance) return; // already at earn cap — silently drop

    setState((s) => ({
      ...s,
      tokenBalances: {
        ...s.tokenBalances,
        [earnerId]: Math.min((s.tokenBalances?.[earnerId] ?? 0) + 1, maxBalance),
      },
    }));

    broadcastState(server);
    return;
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
