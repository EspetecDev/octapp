import { rm } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "bun:test";
import {
  createGameConfig,
  deleteGameConfig,
  getGameConfig,
  listGameConfigs,
  updateGameConfig,
  validateConfig,
  type SavedGameConfig,
} from "./gameConfigs.ts";
import type { GameConfig } from "./state.ts";

const TEST_CONFIG_DIR = join(process.cwd(), ".tmp-test-game-configs");

function validConfig(name = "Chapter 1"): GameConfig {
  return {
    version: 1,
    chapters: [{
      name,
      minigameType: "trivia",
      triviaPool: [{
        question: "Question?",
        correctAnswer: "Answer",
        wrongOptions: ["Wrong 1", "Wrong 2", "Wrong 3"],
      }],
      scavengerClue: "Find the clue",
      scavengerHint: "",
      reward: "Reward",
    }],
    milestones: [{ points: 100, reward: "Round one unlocked" }],
  };
}

describe("game config storage", () => {
  beforeEach(async () => {
    process.env.OCTAPP_CONFIG_DIR = TEST_CONFIG_DIR;
    await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it("validates reusable game configs", () => {
    const result = validateConfig(validConfig());
    expect(result.ok).toBe(true);
  });

  it("rejects malformed game configs", () => {
    const result = validateConfig({
      version: 1,
      chapters: [{
        name: "",
        minigameType: "trivia",
        triviaPool: [],
        scavengerClue: "",
        reward: "",
      }],
      milestones: [{ points: 0, reward: "" }],
    });
    expect(result.ok).toBe(false);
  });

  it("creates, lists, reads, updates, and deletes config records", async () => {
    const created = await createGameConfig("Smoke config", validConfig());
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Smoke config");

    const listed = await listGameConfigs();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
    expect(listed[0].chapterCount).toBe(1);

    const fetched = await getGameConfig(created.id) as SavedGameConfig;
    expect(fetched.config.chapters[0].name).toBe("Chapter 1");

    const updated = await updateGameConfig(created.id, "Updated config", validConfig("Chapter 2")) as SavedGameConfig;
    expect(updated.name).toBe("Updated config");
    expect(updated.config.chapters[0].name).toBe("Chapter 2");

    const deleted = await deleteGameConfig(created.id);
    expect(deleted).toBe(true);
    expect(await getGameConfig(created.id)).toBeNull();
  });
});
