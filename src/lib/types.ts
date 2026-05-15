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
  minigameType: "trivia" | "memory";
  triviaPool: TriviaQuestion[];
  scavengerClue: string;
  scavengerHint?: string;
  reward: string;
  servedQuestionIndex: number | null; // per-chapter, reset on each chapter activation (Pitfall 5)
  minigameDone: boolean;      // Phase 3: tracks minigame completion per chapter
  scavengerDone: boolean;     // Phase 3: tracks scavenger completion per chapter
};

export type PointTier = 10 | 25 | 50;

export type Milestone = {
  id: string;
  points: number;
  reward: string;
  unlocked: boolean;
};

export type DareProposal = {
  id: string;
  text: string;
  points: PointTier;
  proposedBy: string;
  votes: string[];
  status: "voting" | "active" | "completed" | "failed" | "deleted";
  createdAt: number;
  resolvedAt?: number;
};

export type { GameConfig } from "$lib/configSerializer";

export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
  // Phase 2 additions:
  chapters: Chapter[];
  activeChapterIndex: number | null;  // null = lobby (no chapter active)
  scores: Record<string, number>;     // playerId → score (D-07); initialized to 0 on first UNLOCK_CHAPTER
  groomScore: number;
  milestones: Milestone[];
  dareProposals: DareProposal[];
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
