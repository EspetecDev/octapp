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
  minigameType: "trivia" | "memory";
  triviaPool: TriviaQuestion[];
  scavengerClue: string;
  scavengerHint?: string;
  reward: string;
  servedQuestionIndex: number | null; // per-chapter; reset when chapter activates
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

export type GameState = {
  sessionCode: string;
  phase: "lobby" | "active" | "ended";
  players: Player[];
  groomPlayerId: string | null;
  // Phase 2 additions:
  chapters: Chapter[];
  activeChapterIndex: number | null;
  scores: Record<string, number>;
  groomScore: number;
  milestones: Milestone[];
  dareProposals: DareProposal[];
};

export type ConfigChapter = Omit<Chapter, "servedQuestionIndex" | "minigameDone" | "scavengerDone">;
export type ConfigMilestone = Omit<Milestone, "id" | "unlocked"> & { id?: string };

export type GameConfig = {
  version: 1;
  chapters: ConfigChapter[];
  milestones: ConfigMilestone[];
};

// In-memory store: one active session at a time (Phase 1 scope)
let activeState: GameState | null = null;

function chaptersFromConfig(config?: GameConfig): Chapter[] {
  return (config?.chapters ?? []).map((chapter) => ({
    ...chapter,
    servedQuestionIndex: null,
    minigameDone: false,
    scavengerDone: false,
  }));
}

function milestonesFromConfig(config?: GameConfig): Milestone[] {
  return (config?.milestones ?? []).map((milestone) => ({
    id: milestone.id ?? crypto.randomUUID(),
    points: milestone.points,
    reward: milestone.reward,
    unlocked: false,
  }));
}

export function initState(sessionCode: string, config?: GameConfig): GameState {
  activeState = {
    sessionCode,
    phase: "lobby",
    players: [],
    groomPlayerId: null,
    chapters: chaptersFromConfig(config),
    activeChapterIndex: null,
    scores: {},
    groomScore: 0,
    milestones: milestonesFromConfig(config),
    dareProposals: [],
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
