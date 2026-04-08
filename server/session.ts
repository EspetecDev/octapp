import { initState, getState, type GameState } from "./state.ts";

// Visually unambiguous characters only — avoids 0/O/1/I/l confusion at a noisy venue
// Source: RESEARCH.md Don't Hand-Roll "Session code generation"
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

export function createSession(): string {
  const code = generateJoinCode(6);
  initState(code);
  return code;
}

export function getSession(code: string): GameState | null {
  const state = getState();
  if (!state || state.sessionCode !== code) return null;
  return state;
}
