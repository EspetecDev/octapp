import type { ServerWebSocket, Server } from "bun";
import { getState, setState, broadcastState, type Player, type PointTier, type GameState } from "./state.ts";
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
  | { type: "UNLOCK_CHAPTER" }
  | { type: "MINIGAME_COMPLETE"; result: "win" | "loss" }
  | { type: "SCAVENGER_DONE" }
  | { type: "HINT_REQUEST" }
  | { type: "PROPOSE_DARE"; text: string; points: PointTier }
  | { type: "VOTE_DARE"; dareId: string }
  | { type: "RESOLVE_DARE"; dareId: string; result: "completed" | "failed" }
  | { type: "DELETE_DARE"; dareId: string }
  | { type: "RESET_GAME" }
  | { type: "REPEAT_CHAPTER" };

const MINIGAME_WIN_POINTS = 50;
const SCAVENGER_POINTS = 25;
const DARE_POINT_TIERS: PointTier[] = [10, 25, 50];

function unlockMilestones(s: GameState, nextScore: number) {
  return s.milestones.map((milestone) => ({
    ...milestone,
    unlocked: milestone.unlocked || nextScore >= milestone.points,
  }));
}

function addGroomPoints(s: GameState, points: number): GameState {
  if (points <= 0) return s;
  const nextScore = s.groomScore + points;
  return {
    ...s,
    groomScore: nextScore,
    milestones: unlockMilestones(s, nextScore),
    scores: s.groomPlayerId
      ? { ...s.scores, [s.groomPlayerId]: nextScore }
      : s.scores,
  };
}

function connectedGroupMajorityReached(state: GameState, votes: string[]): boolean {
  const connectedGroupIds = new Set(
    state.players
      .filter((player) => player.role === "group" && player.connected)
      .map((player) => player.id)
  );
  if (connectedGroupIds.size === 0) return false;
  const yesVotes = votes.filter((id) => connectedGroupIds.has(id)).length;
  return yesVotes > connectedGroupIds.size / 2;
}

function activatePassedDares(s: GameState): GameState {
  return {
    ...s,
    dareProposals: s.dareProposals.map((dare) =>
      dare.status === "voting" && connectedGroupMajorityReached(s, dare.votes)
        ? { ...dare, status: "active" }
        : dare
    ),
  };
}

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
      return activatePassedDares({
        ...s,
        players,
        groomPlayerId: msg.role === "groom" ? playerId : s.groomPlayerId,
      });
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
    setState((s) => activatePassedDares({
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

  if (msg.type === "MINIGAME_COMPLETE") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;
    // Idempotency guard (Pitfall 7): do not double-apply score if already done
    if (state.chapters[state.activeChapterIndex]?.minigameDone) return;
    const delta = msg.result === "win" ? MINIGAME_WIN_POINTS : 0;
    setState((s) => {
      const updatedChapters = s.chapters.map((ch, i) =>
        i === s.activeChapterIndex ? { ...ch, minigameDone: true } : ch
      );
      return addGroomPoints({
        ...s,
        chapters: updatedChapters,
      }, delta);
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
      return addGroomPoints({ ...s, chapters: updatedChapters }, SCAVENGER_POINTS);
    });
    broadcastState(server);
    return;
  }

  if (msg.type === "HINT_REQUEST") {
    // Hints no longer penalize the global milestone score.
    return;
  }

  if (msg.type === "PROPOSE_DARE") {
    const state = getState();
    const proposerId = ws.data.playerId;
    if (!state || !proposerId) return;
    const proposer = state.players.find((player) => player.id === proposerId);
    if (!proposer || proposer.role !== "group") return;
    const text = msg.text.trim();
    if (text.length < 3 || text.length > 160 || !DARE_POINT_TIERS.includes(msg.points)) return;
    const votes = [proposerId];
    const status = connectedGroupMajorityReached(state, votes) ? "active" : "voting";
    setState((s) => ({
      ...s,
      dareProposals: [
        {
          id: crypto.randomUUID(),
          text,
          points: msg.points,
          proposedBy: proposerId,
          votes,
          status,
          createdAt: Date.now(),
        },
        ...s.dareProposals,
      ],
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "VOTE_DARE") {
    const state = getState();
    const voterId = ws.data.playerId;
    if (!state || !voterId) return;
    const voter = state.players.find((player) => player.id === voterId);
    if (!voter || voter.role !== "group") return;
    setState((s) => ({
      ...s,
      dareProposals: s.dareProposals.map((dare) => {
        if (dare.id !== msg.dareId || dare.status !== "voting") return dare;
        const votes = dare.votes.includes(voterId) ? dare.votes : [...dare.votes, voterId];
        return {
          ...dare,
          votes,
          status: connectedGroupMajorityReached(s, votes) ? "active" : "voting",
        };
      }),
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "RESOLVE_DARE") {
    const state = getState();
    if (!state) return;
    const dare = state.dareProposals.find((proposal) => proposal.id === msg.dareId);
    if (!dare || dare.status !== "active") return;
    setState((s) => {
      const updated = s.dareProposals.map((proposal) =>
        proposal.id === msg.dareId
          ? { ...proposal, status: msg.result, resolvedAt: Date.now() }
          : proposal
      );
      return addGroomPoints({ ...s, dareProposals: updated }, msg.result === "completed" ? dare.points : 0);
    });
    broadcastState(server);
    return;
  }

  if (msg.type === "DELETE_DARE") {
    const state = getState();
    if (!state) return;
    setState((s) => ({
      ...s,
      dareProposals: s.dareProposals.map((dare) =>
        dare.id === msg.dareId && (dare.status === "voting" || dare.status === "active")
          ? { ...dare, status: "deleted", resolvedAt: Date.now() }
          : dare
      ),
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "RESET_GAME") {
    const state = getState();
    if (!state) return;
    setState((s) => ({
      ...s,
      phase: "lobby",
      activeChapterIndex: null,
      groomPlayerId: null,
      players: [],
      scores: {},
      groomScore: 0,
      milestones: s.milestones.map((milestone) => ({ ...milestone, unlocked: false })),
      dareProposals: [],
      chapters: s.chapters.map((ch) => ({
        ...ch,
        minigameDone: false,
        scavengerDone: false,
        servedQuestionIndex: null,
      })),
    }));
    broadcastState(server);
    return;
  }

  if (msg.type === "REPEAT_CHAPTER") {
    const state = getState();
    if (!state || state.activeChapterIndex === null) return;
    const idx = state.activeChapterIndex;
    setState((s) => {
      const updatedChapters = s.chapters.map((ch, i) => {
        if (i !== idx) return ch;
        if (ch.minigameType !== "trivia" || ch.triviaPool.length === 0) {
          return { ...ch, minigameDone: false, scavengerDone: false, servedQuestionIndex: null };
        }
        return {
          ...ch,
          minigameDone: false,
          scavengerDone: false,
          servedQuestionIndex: Math.floor(Math.random() * ch.triviaPool.length),
        };
      });
      return { ...s, chapters: updatedChapters };
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

  setState((s) => activatePassedDares({
    ...s,
    players: s.players.map((p) =>
      p.id === ws.data.playerId ? { ...p, connected: false } : p
    ),
  }));

  broadcastState(server);
}
