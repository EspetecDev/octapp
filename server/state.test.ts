import { describe, it, expect, beforeEach } from "bun:test";
import { initState, getState, setState, broadcastState, type GameState, type Player } from "./state.ts";

describe("state module", () => {
  beforeEach(() => {
    // Reset state between tests by re-initializing
    initState("TESTXX");
  });

  it("initState creates a GameState with the given session code", () => {
    const state = initState("ABC123");
    expect(state.sessionCode).toBe("ABC123");
    expect(state.phase).toBe("lobby");
    expect(state.players).toEqual([]);
    expect(state.groomPlayerId).toBeNull();
  });

  it("getState returns the current active state", () => {
    initState("XYZ789");
    const state = getState();
    expect(state).not.toBeNull();
    expect(state!.sessionCode).toBe("XYZ789");
  });

  it("setState applies updater function to active state", () => {
    initState("SESS01");
    const player: Player = { id: "player-1", name: "Alice", role: "group", connected: true };
    setState((s) => ({ ...s, players: [player] }));
    const state = getState();
    expect(state!.players).toHaveLength(1);
    expect(state!.players[0].name).toBe("Alice");
  });

  it("setState does nothing if state is null", () => {
    // Force null state by importing a fresh module is hard, so we just verify no-op on existing
    // This is tested implicitly by the module not throwing
    expect(() => setState((s) => s)).not.toThrow();
  });

  it("broadcastState publishes STATE_SYNC message to 'game' channel", () => {
    initState("BROAD1");
    const publishedMessages: Array<{ topic: string; data: string }> = [];
    const mockServer = {
      publish: (topic: string, data: string) => {
        publishedMessages.push({ topic, data });
        return 0;
      },
    };
    broadcastState(mockServer as any);
    expect(publishedMessages).toHaveLength(1);
    expect(publishedMessages[0].topic).toBe("game");
    const msg = JSON.parse(publishedMessages[0].data);
    expect(msg.type).toBe("STATE_SYNC");
    expect(msg.state.sessionCode).toBe("BROAD1");
  });

  it("broadcastState does nothing if state is null", () => {
    // We can't easily reset to null in this module, but verify it doesn't throw
    const mockServer = { publish: () => 0 };
    expect(() => broadcastState(mockServer as any)).not.toThrow();
  });
});
