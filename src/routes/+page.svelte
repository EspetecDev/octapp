<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { gameState, lastError, sendMessage, storePlayerSession, getStoredPlayerId, getStoredSessionCode, clearPlayerSession } from "$lib/socket.ts";
  import type { GameState } from "$lib/types.ts";

  // --- Auto-redirect: if stored session exists, redirect back instead of showing the form ---
  let autoRedirecting = $state(getStoredPlayerId() !== null && getStoredSessionCode() !== null);

  // --- Form state ---
  let code = $state("");          // 6-char join code
  let name = $state("");          // display name
  let role = $state<"groom" | "group" | null>(null);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let submitTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- Derived: loading state (before first STATE_SYNC from server) ---
  // Groom button must be disabled while loading to avoid role selection before server confirms state
  let gameStateLoading = $derived($gameState === null);

  // --- Derived: is groom role already taken? (real-time from server) ---
  let groomTaken = $derived(($gameState?.groomPlayerId ?? null) !== null);

  // --- Form validity ---
  let isValid = $derived(
    code.trim().length === 6 &&
    name.trim().length >= 1 &&
    role !== null &&
    !submitting
  );

  // --- Code input: auto-uppercase, max 6 chars ---
  function handleCodeInput(e: Event) {
    const input = e.target as HTMLInputElement;
    // Strip whitespace, uppercase, max 6
    code = input.value.toUpperCase().replace(/\s/g, "").slice(0, 6);
    input.value = code;
  }

  // --- Role selection ---
  function selectRole(selected: "groom" | "group") {
    if (selected === "groom" && (groomTaken || gameStateLoading)) return;
    role = selected;
    // Haptic feedback — single 50ms pulse (UI-SPEC Interaction Constraints)
    navigator.vibrate?.(50);
  }

  // --- Watch for server error response (lastError store) ---
  let unsubscribeError: () => void;
  // Watch for PLAYER_JOINED (navigate after successful join)
  let unsubscribeState: () => void;
  let joinedPlayerId: string | null = null;

  onMount(() => {
    // Auto-redirect if a stored session exists (handles page refresh)
    const storedPlayerId = getStoredPlayerId();
    const storedSessionCode = getStoredSessionCode();

    if (storedPlayerId && storedSessionCode) {
      // Give up and show form if server doesn't respond in 4 seconds
      const giveUpTimer = setTimeout(() => {
        clearPlayerSession();
        autoRedirecting = false;
        (document.querySelector("#code-input") as HTMLInputElement | null)?.focus();
      }, 4_000);

      const unsubRedirect = gameState.subscribe((state) => {
        if (!state) return; // waiting for STATE_SYNC
        clearTimeout(giveUpTimer);
        unsubRedirect();
        const player = state.players.find((p) => p.id === storedPlayerId);
        if (player && state.sessionCode === storedSessionCode) {
          goto(player.role === "groom" ? "/groom" : "/party");
        } else {
          // Session changed or player was removed (e.g. Reset Game) — show form fresh
          clearPlayerSession();
          autoRedirecting = false;
          setTimeout(() => (document.querySelector("#code-input") as HTMLInputElement | null)?.focus(), 0);
        }
      });
      return () => { clearTimeout(giveUpTimer); unsubRedirect(); };
    }

    // No stored session — show form normally
    autoRedirecting = false;
    // Focus code input on load (UI-SPEC "Primary anchor")
    (document.querySelector("#code-input") as HTMLInputElement | null)?.focus();

    unsubscribeError = lastError.subscribe((err) => {
      if (!err || !submitting) return;
      submitting = false;
      if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }

      if (err.code === "WRONG_CODE") {
        submitError = err.message;
        // Re-focus code input
        setTimeout(() => (document.querySelector("#code-input") as HTMLInputElement | null)?.focus(), 0);
      } else if (err.code === "GROOM_TAKEN") {
        role = "group";
        submitError = err.message;
      } else {
        submitError = err.message ?? "Something went wrong. Try again.";
      }
    });

    // Listen for gameState change that includes our player (navigate after join)
    unsubscribeState = gameState.subscribe((state: GameState | null) => {
      if (!state || !joinedPlayerId) return;
      const player = state.players.find((p) => p.id === joinedPlayerId);
      if (player) {
        submitting = false;
        if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }
        // Haptic: double pulse on successful join (UI-SPEC)
        navigator.vibrate?.([50, 30, 50]);
        goto(player.role === "groom" ? "/groom" : "/party");
      }
    });

    return () => {
      unsubscribeError?.();
      unsubscribeState?.();
    };
  });

  // --- Submit ---
  async function handleSubmit() {
    if (!isValid || !role) return;

    submitting = true;
    submitError = null;
    lastError.set(null);

    // Store session code in localStorage now (socket.ts will store playerId after PLAYER_JOINED)
    // We do this before sending JOIN so that on reconnect the REJOIN message can use it
    localStorage.setItem("octapp:sessionCode", code.trim().toUpperCase());

    // Capture the playerId we expect to receive after join
    // We'll look for new player in gameState subscription above
    joinedPlayerId = null;

    // After server processes JOIN, it sends PLAYER_JOINED then STATE_SYNC
    // The socket.ts onmessage handler for PLAYER_JOINED stores the playerId.
    // We capture it here by temporarily overriding: instead, we watch gameState
    // to find our player after STATE_SYNC (our player will be the newest one
    // matching our role and name).
    const ourName = name.trim();
    const ourRole = role;

    // Override: watch for state that has a player matching our name + role
    // The unsubscribeState above will catch it.
    // We need to know our playerId — but socket.ts stores it after PLAYER_JOINED.
    // Solution: watch for STATE_SYNC with our player included, then read localStorage.
    unsubscribeState?.();
    unsubscribeState = gameState.subscribe((state: GameState | null) => {
      if (!state || !submitting) return;
      const player = state.players.find((p) => p.name === ourName && p.role === ourRole);
      if (player) {
        // Store our playerId (in case PLAYER_JOINED message was missed)
        storePlayerSession(player.id, code.trim().toUpperCase());
        submitting = false;
        if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }
        // Haptic: double pulse on successful join (UI-SPEC)
        navigator.vibrate?.([50, 30, 50]);
        goto(player.role === "groom" ? "/groom" : "/party");
      }
    });

    sendMessage({ type: "JOIN", sessionCode: code.trim().toUpperCase(), name: name.trim(), role });

    // 8-second timeout: revert to enabled state (UI-SPEC Interaction Constraints)
    submitTimeout = setTimeout(() => {
      submitting = false;
      submitError = "Connection timed out. Try again.";
    }, 8_000);
  }
</script>

<main class="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-5 py-8">
  {#if autoRedirecting}
    <!-- Reconnecting spinner — shown while we check if stored session is still valid -->
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-text-primary border-t-transparent animate-spin"></div>
      <p class="text-base text-text-secondary">Reconnecting...</p>
    </div>
  {:else}
  <div class="w-full flex flex-col gap-6">

    <!-- App title -->
    <div class="text-center">
      <h1 class="text-[40px] font-bold text-text-primary leading-tight">Bachelor Party</h1>
      <p class="text-base text-text-secondary mt-1">Enter your code to join the game.</p>
    </div>

    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
    >
      <!-- Code input -->
      <div class="flex flex-col gap-1">
        <label for="code-input" class="text-[14px] text-text-secondary">Game code</label>
        <input
          id="code-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          maxlength="6"
          placeholder="XXXXXX"
          class="
            w-full h-14 rounded-lg bg-surface border-2 border-border px-4
            text-[24px] font-bold text-text-primary text-center tracking-[0.2em] uppercase
            focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary
            disabled:opacity-50
          "
          value={code}
          oninput={handleCodeInput}
          disabled={submitting}
          aria-describedby={submitError && submitError.includes("code") ? "code-error" : undefined}
        />
        {#if submitError && (submitError.includes("match") || submitError.includes("code") || submitError.includes("session"))}
          <p id="code-error" class="text-[14px] text-destructive error-message">{submitError}</p>
        {/if}
      </div>

      <!-- Name input -->
      <div class="flex flex-col gap-1">
        <label for="name-input" class="text-[14px] text-text-secondary">Your name</label>
        <input
          id="name-input"
          type="text"
          autocomplete="nickname"
          placeholder="Your name"
          class="
            w-full h-[52px] rounded-lg bg-surface border-2 border-border px-4
            text-base text-text-primary
            focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary
            disabled:opacity-50
          "
          bind:value={name}
          disabled={submitting}
          required
        />
      </div>

      <!-- Role selector -->
      <div class="flex flex-col gap-1">
        <span class="text-[14px] text-text-secondary">Your role</span>
        <div class="flex gap-2">
          <!-- Groom button: disabled when loading (no STATE_SYNC yet) OR groom already taken -->
          <button
            type="button"
            class="
              flex-1 h-14 rounded-lg font-bold text-base transition-all duration-150
              {role === 'groom'
                ? 'bg-accent-groom text-[#0f0f0f] border-2 border-accent-groom'
                : 'bg-surface border-2 border-border text-text-primary'}
              {(groomTaken || gameStateLoading) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              min-h-[44px]
            "
            onclick={() => selectRole("groom")}
            disabled={groomTaken || gameStateLoading || submitting}
            aria-pressed={role === "groom"}
            title={gameStateLoading ? "Connecting..." : groomTaken ? "Groom role already taken" : undefined}
          >
            {gameStateLoading ? "..." : "I'm the Groom"}
          </button>
          <!-- Group button -->
          <button
            type="button"
            class="
              flex-1 h-14 rounded-lg font-bold text-base transition-all duration-150
              {role === 'group'
                ? 'bg-accent-group text-text-primary border-2 border-accent-group'
                : 'bg-surface border-2 border-border text-text-primary'}
              min-h-[44px] cursor-pointer
            "
            onclick={() => selectRole("group")}
            disabled={submitting}
            aria-pressed={role === "group"}
          >
            I'm in the Group
          </button>
        </div>
        {#if submitError && submitError.includes("Groom role")}
          <p class="text-[14px] text-destructive error-message">{submitError}</p>
        {/if}
      </div>

      <!-- CTA button -->
      <button
        type="submit"
        class="
          w-full h-14 rounded-lg font-bold text-base text-[#0f0f0f] bg-text-primary
          transition-opacity duration-200
          {isValid ? 'opacity-100' : 'opacity-40 pointer-events-none cursor-not-allowed'}
          min-h-[44px]
          flex items-center justify-center gap-2
        "
        disabled={!isValid}
      >
        {#if submitting}
          <div class="cta-spinner" aria-hidden="true"></div>
        {:else}
          Join Game
        {/if}
      </button>

      <!-- Generic error toast area -->
      {#if submitError && !submitError.includes("match") && !submitError.includes("code") && !submitError.includes("session") && !submitError.includes("Groom role")}
        <p class="text-[14px] text-destructive text-center error-message">{submitError}</p>
      {/if}
    </form>

  </div>
  {/if}
</main>

<style>
  .error-message {
    animation: slideUp 150ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .cta-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(15, 15, 15, 0.3);
    border-top-color: #0f0f0f;
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  /* Inputs disabled state */
  input:disabled { opacity: 0.5; }
</style>
