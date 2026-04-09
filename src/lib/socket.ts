// Client-side WebSocket layer
// Pattern: RESEARCH.md Pattern 3
// Source for backoff: exponential with jitter — RESEARCH.md Don't Hand-Roll "Jitter calculation"
// Pitfall mitigations: Pitfall 1 (iOS no onclose) + Pitfall 4 (playerId in localStorage)
import { writable } from "svelte/store";
import type { GameState, ServerMessage, ClientMessage } from "./types.ts";

// --- Svelte stores consumed by all components ---
export const gameState = writable<GameState | null>(null);
export const connectionStatus = writable<"connected" | "reconnecting" | "disconnected">("disconnected");
// Last error message from server (shown in UI forms)
export const lastError = writable<{ code: string; message: string } | null>(null);

// Transient effect store — updated on EFFECT_ACTIVATED; NOT stored in gameState (D-14, Pitfall 1)
// Components subscribe to lastEffect for visual/gameplay effects; it is NOT part of persistent state
export type EffectActivatedPayload = {
  activatedBy: string;
  powerUpName: string;
  effectType: string;
  delta?: number;
};
export const lastEffect = writable<EffectActivatedPayload | null>(null);

// localStorage keys
const PLAYER_ID_KEY = "octapp:playerId";
const SESSION_CODE_KEY = "octapp:sessionCode";

export function getStoredPlayerId(): string | null {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function getStoredSessionCode(): string | null {
  return localStorage.getItem(SESSION_CODE_KEY);
}

export function storePlayerSession(playerId: string, sessionCode: string): void {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
  localStorage.setItem(SESSION_CODE_KEY, sessionCode);
}

export function clearPlayerSession(): void {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(SESSION_CODE_KEY);
}

class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private maxAttempts = 15;
  private baseDelay = 500; // ms
  private maxDelay = 30_000; // ms
  private url: string;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  // Missed heartbeat threshold: if no PING received in 35s, treat as disconnected
  // Mitigation for Pitfall 1 (iOS kills WS without firing onclose)
  private readonly HEARTBEAT_TIMEOUT_MS = 35_000;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    // Clean up any previous socket
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.attempt = 0;
      connectionStatus.set("connected");
      this.resetHeartbeatTimer();

      // Re-register with server if we have a stored identity (Pitfall 4, SESS-06)
      const playerId = getStoredPlayerId();
      const sessionCode = getStoredSessionCode();
      if (playerId && sessionCode) {
        this.send({ type: "REJOIN", playerId, sessionCode });
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === "STATE_SYNC") {
        gameState.set(msg.state);
      } else if (msg.type === "PING") {
        // Reset the missed-heartbeat timer (Pitfall 1 mitigation)
        this.resetHeartbeatTimer();
        // Send pong to keep connection alive (optional — ping alone keeps Railway alive)
        this.send({ type: "PONG" });
      } else if (msg.type === "PLAYER_JOINED") {
        // Server confirmed join — store playerId for future reconnects (SESS-06)
        const sessionCode = getStoredSessionCode();
        if (sessionCode) {
          storePlayerSession(msg.playerId, sessionCode);
        }
      } else if (msg.type === "EFFECT_ACTIVATED") {
        // Transient effect — update lastEffect store ONLY; do NOT set gameState (Pitfall 1: EFFECT_ACTIVATED is not persistent state)
        lastEffect.set(msg as unknown as EffectActivatedPayload);
      } else if (msg.type === "ERROR") {
        lastError.set({ code: msg.code, message: msg.message });
      }
    };

    this.ws.onclose = () => {
      connectionStatus.set("reconnecting");
      this.clearHeartbeatTimer();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose; let onclose drive reconnect
    };
  }

  private resetHeartbeatTimer(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setTimeout(() => {
      // No heartbeat in 35s — iOS likely killed the connection silently (Pitfall 1)
      connectionStatus.set("reconnecting");
      this.ws?.close();
      this.scheduleReconnect();
    }, this.HEARTBEAT_TIMEOUT_MS);
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.attempt >= this.maxAttempts) {
      connectionStatus.set("disconnected");
      return;
    }
    // Exponential backoff with up to 50% jitter (RESEARCH.md Don't Hand-Roll)
    const jitter = Math.random() * 0.5;
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt) * (1 + jitter),
      this.maxDelay
    );
    this.attempt++;
    setTimeout(() => this.connect(), delay);
  }

  send(data: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  destroy(): void {
    this.clearHeartbeatTimer();
    this.attempt = this.maxAttempts; // stop reconnects
    this.ws?.close();
  }
}

// Singleton socket instance — created once per page session
let socket: ReconnectingWebSocket | null = null;

/**
 * Initialize the WebSocket connection. Call once from +layout.svelte onMount.
 * Uses the VITE_WS_URL env var if set; otherwise derives from window.location.
 */
export function createSocket(): ReconnectingWebSocket {
  if (socket) return socket;

  // Derive WebSocket URL from the current page origin (same host/port — D-02)
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${proto}//${window.location.host}/ws`;

  socket = new ReconnectingWebSocket(wsUrl);
  return socket;
}

export function destroySocket(): void {
  socket?.destroy();
  socket = null;
}

/**
 * Send a message via the singleton socket.
 * Safe to call even if socket is not yet connected — message is dropped silently.
 * Plan 04 routes use this to send JOIN messages without needing the socket instance.
 */
export function sendMessage(data: ClientMessage): void {
  socket?.send(data);
}
