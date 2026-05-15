import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GameConfig, ConfigChapter, ConfigMilestone } from "./state.ts";

export type SavedGameConfig = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: GameConfig;
};

export type SavedGameConfigSummary = Omit<SavedGameConfig, "config"> & {
  chapterCount: number;
};

export type ValidateConfigResult =
  | { ok: true; config: GameConfig }
  | { ok: false; error: string };

function configDir(): string {
  return process.env.OCTAPP_CONFIG_DIR ?? join(process.cwd(), "data", "game-configs");
}

function configPath(id: string): string {
  return join(configDir(), `${id}.json`);
}

function isSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true });
}

function summary(record: SavedGameConfig): SavedGameConfigSummary {
  const { config, ...rest } = record;
  return { ...rest, chapterCount: config.chapters.length };
}

export function validateConfig(data: unknown): ValidateConfigResult {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Config must be a non-null object" };
  }

  const d = data as Record<string, unknown>;

  if (d.version !== 1) {
    return { ok: false, error: "Missing or invalid 'version' field; expected 1" };
  }

  if (!Array.isArray(d.chapters)) {
    return { ok: false, error: "Missing or invalid 'chapters' field; expected an array" };
  }

  if (d.milestones !== undefined && !Array.isArray(d.milestones)) {
    return { ok: false, error: "Invalid 'milestones' field; expected an array" };
  }

  const chapters = d.chapters as unknown[];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i] as Record<string, unknown>;
    for (const field of ["name", "minigameType", "scavengerClue", "reward"] as const) {
      if (typeof ch[field] !== "string" || ch[field].trim().length === 0) {
        return { ok: false, error: `Chapter ${i + 1} missing required field '${field}'` };
      }
    }
    if (ch.minigameType !== "trivia" && ch.minigameType !== "memory") {
      return { ok: false, error: `Chapter ${i + 1}: invalid minigameType` };
    }
    if (!Array.isArray(ch.triviaPool)) {
      return { ok: false, error: `Chapter ${i + 1}: 'triviaPool' must be an array` };
    }
    if (ch.minigameType === "trivia" && ch.triviaPool.length === 0) {
      return { ok: false, error: `Chapter ${i + 1}: trivia chapters need at least one question` };
    }
    for (let qIndex = 0; qIndex < ch.triviaPool.length; qIndex++) {
      const q = ch.triviaPool[qIndex] as Record<string, unknown>;
      if (typeof q.question !== "string" || typeof q.correctAnswer !== "string") {
        return { ok: false, error: `Chapter ${i + 1}, question ${qIndex + 1}: missing question or answer` };
      }
      if (!Array.isArray(q.wrongOptions) || q.wrongOptions.length !== 3 || q.wrongOptions.some((o) => typeof o !== "string")) {
        return { ok: false, error: `Chapter ${i + 1}, question ${qIndex + 1}: expected 3 wrong options` };
      }
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

  return { ok: true, config: data as GameConfig };
}

export function normalizeConfig(config: GameConfig): GameConfig {
  const chapters: ConfigChapter[] = config.chapters.map((chapter) => ({
    name: chapter.name,
    minigameType: chapter.minigameType,
    triviaPool: chapter.triviaPool,
    scavengerClue: chapter.scavengerClue,
    ...(chapter.scavengerHint ? { scavengerHint: chapter.scavengerHint } : {}),
    reward: chapter.reward,
  }));

  const milestones: ConfigMilestone[] = (config.milestones ?? [])
    .map((milestone) => ({
      id: milestone.id,
      points: milestone.points,
      reward: milestone.reward,
    }))
    .sort((a, b) => a.points - b.points);

  return { version: 1, chapters, milestones };
}

export async function listGameConfigs(): Promise<SavedGameConfigSummary[]> {
  await ensureConfigDir();
  const files = await readdir(configDir());
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const content = await readFile(join(configDir(), file), "utf8");
        return JSON.parse(content) as SavedGameConfig;
      })
  );
  return records
    .map(summary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getGameConfig(id: string): Promise<SavedGameConfig | null> {
  if (!isSafeId(id)) return null;
  try {
    const content = await readFile(configPath(id), "utf8");
    return JSON.parse(content) as SavedGameConfig;
  } catch {
    return null;
  }
}

async function writeRecord(record: SavedGameConfig): Promise<void> {
  await ensureConfigDir();
  const path = configPath(record.id);
  const tempPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

export async function createGameConfig(name: string, config: GameConfig): Promise<SavedGameConfig> {
  const now = new Date().toISOString();
  const record: SavedGameConfig = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled game",
    createdAt: now,
    updatedAt: now,
    config: normalizeConfig(config),
  };
  await writeRecord(record);
  return record;
}

export async function updateGameConfig(id: string, name: string, config: GameConfig): Promise<SavedGameConfig | null> {
  const existing = await getGameConfig(id);
  if (!existing) return null;
  const record: SavedGameConfig = {
    ...existing,
    name: name.trim() || existing.name,
    updatedAt: new Date().toISOString(),
    config: normalizeConfig(config),
  };
  await writeRecord(record);
  return record;
}

export async function deleteGameConfig(id: string): Promise<boolean> {
  if (!isSafeId(id)) return false;
  try {
    await unlink(configPath(id));
    return true;
  } catch {
    return false;
  }
}
