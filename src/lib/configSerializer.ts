import type { Chapter, PowerUp } from "$lib/types";

// ConfigChapter — Chapter without the three runtime-only fields
export type ConfigChapter = Omit<Chapter, "servedQuestionIndex" | "minigameDone" | "scavengerDone">;

// GameConfig — the serialized shape written to / read from JSON
export type GameConfig = {
  version: 1;
  chapters: ConfigChapter[];
  powerUpCatalog: PowerUp[];
  startingTokens: number;
};

// Discriminated union returned by validateConfig
export type ValidateConfigResult =
  | { ok: true; config: GameConfig }
  | { ok: false; error: string };

/**
 * serializeConfig — strip runtime-only fields from chapters and return a
 * well-typed GameConfig ready to be JSON-serialised.
 */
export function serializeConfig(
  chapters: Chapter[],
  powerUpCatalog: PowerUp[],
  startingTokens: number
): GameConfig {
  const strippedChapters: ConfigChapter[] = chapters.map((ch) => {
    const { servedQuestionIndex: _sri, minigameDone: _md, scavengerDone: _sd, ...rest } = ch;
    return rest;
  });

  return { version: 1, chapters: strippedChapters, powerUpCatalog, startingTokens };
}

/**
 * validateConfig — validate an unknown value against the GameConfig shape.
 * Permissive of extra fields; strict about required structure.
 */
export function validateConfig(data: unknown): ValidateConfigResult {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Config must be a non-null object" };
  }

  const d = data as Record<string, unknown>;

  if (d.version !== 1) {
    return { ok: false, error: "Missing or invalid 'version' field — expected 1" };
  }

  if (!Array.isArray(d.chapters)) {
    return { ok: false, error: "Missing or invalid 'chapters' field — expected an array" };
  }

  if (!Array.isArray(d.powerUpCatalog)) {
    return { ok: false, error: "Missing or invalid 'powerUpCatalog' field — expected an array" };
  }

  if (typeof d.startingTokens !== "number") {
    return { ok: false, error: "Missing or invalid 'startingTokens' field — expected a number" };
  }

  const chapters = d.chapters as unknown[];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i] as Record<string, unknown>;
    for (const field of ["name", "minigameType", "scavengerClue", "reward"] as const) {
      if (typeof ch[field] !== "string") {
        return { ok: false, error: `Chapter ${i} missing required field '${field}'` };
      }
    }
    if (!Array.isArray(ch.triviaPool)) {
      return { ok: false, error: `Chapter ${i}: 'triviaPool' must be an array` };
    }
  }

  return { ok: true, config: data as GameConfig };
}
