import type { Server } from "bun";

export type Player = {
  id: string;
  name: string;
  role: "groom" | "group";
  connected: boolean;
};

export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
};

// In-memory store: one active session at a time (Phase 1 scope)
let activeState: GameState | null = null;

export function initState(sessionCode: string): GameState {
  activeState = {
    sessionCode,
    phase: "lobby",
    players: [],
    groomPlayerId: null,
  };
  return activeState;
}

export function getState(): GameState | null {
  return activeState;
}

export function setState(updater: (s: GameState) => GameState): void {
  if (!activeState) return;
  activeState = updater(activeState);
}

export function broadcastState(server: Server): void {
  if (!activeState) return;
  server.publish("game", JSON.stringify({ type: "STATE_SYNC", state: activeState }));
}
