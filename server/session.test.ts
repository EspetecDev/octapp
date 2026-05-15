import { describe, it, expect, beforeEach } from "bun:test";
import { generateJoinCode, createSession, getSession } from "./session.ts";

describe("session module", () => {
  it("generateJoinCode returns a 6-character string", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it("generateJoinCode only uses visually unambiguous characters", () => {
    // Run many times to cover randomness
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      expect(/[01OIl]/.test(code)).toBe(false);
    }
  });

  it("generateJoinCode supports custom length", () => {
    const code = generateJoinCode(8);
    expect(code).toHaveLength(8);
  });

  it("createSession returns a 6-char code", () => {
    const code = createSession();
    expect(code).toHaveLength(6);
  });

  it("getSession returns the GameState for a valid code", () => {
    const code = createSession();
    const session = getSession(code);
    expect(session).not.toBeNull();
    expect(session!.sessionCode).toBe(code);
    expect(session!.phase).toBe("lobby");
  });

  it("createSession can initialize from a saved game config", () => {
    const code = createSession({
      version: 1,
      chapters: [{
        name: "Chapter 1",
        minigameType: "trivia",
        triviaPool: [{
          question: "Question?",
          correctAnswer: "Yes",
          wrongOptions: ["No", "Maybe", "Later"],
        }],
        scavengerClue: "Find it",
        reward: "Reward",
      }],
      milestones: [{ points: 100, reward: "Reward" }],
    });
    const session = getSession(code);
    expect(session!.chapters).toHaveLength(1);
    expect(session!.chapters[0].servedQuestionIndex).toBeNull();
    expect(session!.chapters[0].minigameDone).toBe(false);
    expect(session!.milestones).toHaveLength(1);
    expect(session!.milestones[0].unlocked).toBe(false);
    expect(session!.players).toEqual([]);
  });

  it("getSession returns null for an unknown code", () => {
    createSession(); // creates a session
    const result = getSession("ZZZZZZ");
    expect(result).toBeNull();
  });
});
