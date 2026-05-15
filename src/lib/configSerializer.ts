import type { Chapter, Milestone } from "$lib/types";

// ConfigChapter — Chapter without the three runtime-only fields
export type ConfigChapter = Omit<Chapter, "servedQuestionIndex" | "minigameDone" | "scavengerDone">;
export type ConfigMilestone = Omit<Milestone, "id" | "unlocked"> & { id?: string };

// GameConfig — the serialized shape written to / read from JSON
export type GameConfig = {
  version: 1;
  chapters: ConfigChapter[];
  milestones: ConfigMilestone[];
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
  milestones: Milestone[]
): GameConfig {
  const strippedChapters: ConfigChapter[] = chapters.map((ch) => {
    const { servedQuestionIndex: _sri, minigameDone: _md, scavengerDone: _sd, ...rest } = ch;
    return rest;
  });

  const strippedMilestones: ConfigMilestone[] = milestones
    .map((milestone) => ({
      id: milestone.id,
      points: milestone.points,
      reward: milestone.reward,
    }))
    .sort((a, b) => a.points - b.points);

  return { version: 1, chapters: strippedChapters, milestones: strippedMilestones };
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

  if (d.milestones !== undefined && !Array.isArray(d.milestones)) {
    return { ok: false, error: "Invalid 'milestones' field — expected an array" };
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

  const milestones = (d.milestones ?? []) as unknown[];
  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i] as Record<string, unknown>;
    if (typeof milestone.points !== "number" || milestone.points <= 0) {
      return { ok: false, error: `Milestone ${i + 1}: points must be a positive number` };
    }
    if (typeof milestone.reward !== "string" || milestone.reward.trim().length === 0) {
      return { ok: false, error: `Milestone ${i + 1}: reward is required` };
    }
  }

  const config = {
    ...(data as GameConfig),
    milestones: (d.milestones ?? []) as ConfigMilestone[],
  };

  return { ok: true, config };
}
