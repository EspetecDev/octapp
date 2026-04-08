// Shared types — must stay in sync with server/state.ts
// Do NOT import from server/ in the client bundle

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
  | { type: "PONG" };
