import type { Server } from "bun";

export type Player = {
  id: string;
  name: string;
  role: "groom" | "group";
  connected: boolean;
};

export type TriviaQuestion = {
  question: string;
  correctAnswer: string;
  wrongOptions: [string, string, string]; // exactly 3 wrong options
};

export type Chapter = {
  name: string;
  minigameType: "trivia" | "sensor" | "memory";
  triviaPool: TriviaQuestion[];
  scavengerClue: string;
  scavengerHint?: string;
  reward: string;
  servedQuestionIndex: number | null; // per-chapter; reset when chapter activates
};

export type PowerUp = {
  name: string;
  description: string;
  tokenCost: number;
  effectType: "timer_add" | "scramble_options" | "distraction" | string;
};

export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
  // Phase 2 additions:
  chapters: Chapter[];
  activeChapterIndex: number | null;
  scores: Record<string, number>;
  powerUpCatalog: PowerUp[];
};

// In-memory store: one active session at a time (Phase 1 scope)
let activeState: GameState | null = null;

export function initState(sessionCode: string): GameState {
  activeState = {
    sessionCode,
    phase: "lobby",
    players: [],
    groomPlayerId: null,
    // Phase 2 safe defaults — all empty; populated via SAVE_SETUP and UNLOCK_CHAPTER
    chapters: [],
    activeChapterIndex: null,
    scores: {},
    powerUpCatalog: [],
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
