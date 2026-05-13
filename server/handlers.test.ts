import { describe, expect, it } from "bun:test";
import { handleMessage } from "./handlers.ts";
import { getState, initState, setState, type GameConfig, type Player } from "./state.ts";

const config: GameConfig = {
  version: 1,
  chapters: [{
    name: "Round 1",
    minigameType: "trivia",
    triviaPool: [{
      question: "Question?",
      correctAnswer: "Yes",
      wrongOptions: ["No", "Maybe", "Later"],
    }],
    scavengerClue: "Find it",
    reward: "Legacy reward",
  }],
  milestones: [
    { points: 25, reward: "First reward" },
    { points: 50, reward: "Second reward" },
  ],
};

function mockServer() {
  return { publish: () => 0 } as any;
}

function mockSocket(playerId: string | null = null) {
  return {
    data: { playerId, sessionCode: "ABC123" },
    send: () => {},
    subscribe: () => {},
  } as any;
}

function seedPlayers() {
  const players: Player[] = [
    { id: "groom", name: "Groom", role: "groom", connected: true },
    { id: "g1", name: "Ari", role: "group", connected: true },
    { id: "g2", name: "Bea", role: "group", connected: true },
    { id: "g3", name: "Cal", role: "group", connected: true },
  ];
  setState((s) => ({ ...s, players, groomPlayerId: "groom", activeChapterIndex: 0, phase: "active" }));
}

describe("game handlers", () => {
  it("adds minigame win points and unlocks milestones without penalties", () => {
    initState("ABC123", config);
    seedPlayers();

    handleMessage(mockSocket("groom"), JSON.stringify({ type: "MINIGAME_COMPLETE", result: "win" }), mockServer());
    expect(getState()!.groomScore).toBe(50);
    expect(getState()!.milestones.map((milestone) => milestone.unlocked)).toEqual([true, true]);

    initState("ABC123", config);
    seedPlayers();
    handleMessage(mockSocket("groom"), JSON.stringify({ type: "MINIGAME_COMPLETE", result: "loss" }), mockServer());
    expect(getState()!.groomScore).toBe(0);
  });

  it("activates dares by connected-group majority and awards points only when completed", () => {
    initState("ABC123", config);
    seedPlayers();

    handleMessage(mockSocket("g1"), JSON.stringify({ type: "PROPOSE_DARE", text: "Sing the chorus", points: 25 }), mockServer());
    let dare = getState()!.dareProposals[0];
    expect(dare.status).toBe("voting");
    expect(dare.votes).toEqual(["g1"]);

    handleMessage(mockSocket("g2"), JSON.stringify({ type: "VOTE_DARE", dareId: dare.id }), mockServer());
    dare = getState()!.dareProposals[0];
    expect(dare.status).toBe("active");

    handleMessage(mockSocket(null), JSON.stringify({ type: "RESOLVE_DARE", dareId: dare.id, result: "completed" }), mockServer());
    expect(getState()!.dareProposals[0].status).toBe("completed");
    expect(getState()!.groomScore).toBe(25);
    expect(getState()!.milestones[0].unlocked).toBe(true);
  });

  it("lets admin delete active dares without awarding points", () => {
    initState("ABC123", config);
    seedPlayers();

    handleMessage(mockSocket("g1"), JSON.stringify({ type: "PROPOSE_DARE", text: "Dance for 20 seconds", points: 50 }), mockServer());
    const dareId = getState()!.dareProposals[0].id;
    handleMessage(mockSocket("g2"), JSON.stringify({ type: "VOTE_DARE", dareId }), mockServer());
    expect(getState()!.dareProposals[0].status).toBe("active");

    handleMessage(mockSocket(null), JSON.stringify({ type: "DELETE_DARE", dareId }), mockServer());
    expect(getState()!.dareProposals[0].status).toBe("deleted");
    expect(getState()!.groomScore).toBe(0);
  });
});
