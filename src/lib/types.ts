// Shared types — must stay in sync with server/state.ts
// Do NOT import from server/ in the client bundle

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
  servedQuestionIndex: number | null; // per-chapter, reset on each chapter activation (Pitfall 5)
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
  activeChapterIndex: number | null;  // null = lobby (no chapter active)
  scores: Record<string, number>;     // playerId → score (D-07); initialized to 0 on first UNLOCK_CHAPTER
  powerUpCatalog: PowerUp[];
};

// Server-to-client message union
export type ServerMessage =
  | { type: "STATE_SYNC"; state: GameState }
  | { type: "PING"; ts: number }
  | { type: "PLAYER_JOINED"; playerId: string }
  | { type: "ERROR"; code: "WRONG_CODE" | "GROOM_TAKEN" | "INVALID_NAME" | "UNKNOWN"; message: string };

// Client-to-server message union
export type ClientMessage =
  | { type: "JOIN"; sessionCode: string; name: string; role: "groom" | "group" }
  | { type: "REJOIN"; playerId: string; sessionCode: string }
  | { type: "PONG" }
  | { type: "SAVE_SETUP"; chapters: Chapter[]; powerUpCatalog: PowerUp[] }
  | { type: "UNLOCK_CHAPTER" };
