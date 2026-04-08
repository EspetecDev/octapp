<script lang="ts">
  import { onMount } from "svelte";
  import { gameState, getStoredPlayerId } from "$lib/socket.ts";
  import type { Player } from "$lib/types.ts";

  let myPlayerId = $state<string | null>(null);
  let myPlayer = $derived<Player | null>(
    myPlayerId ? ($gameState?.players.find((p: Player) => p.id === myPlayerId) ?? null) : null
  );

  // Recap card state (GAME-05)
  let showRecap = $state(false);
  let recapChapterIndex = $state<number | null>(null);
  let initialSyncDone = $state(false);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const idx = $gameState?.activeChapterIndex ?? null;
    if (!initialSyncDone) {
      // First STATE_SYNC after connecting — set baseline without showing recap (Pitfall 4)
      recapChapterIndex = idx;
      initialSyncDone = true;
      return;
    }
    if (idx !== null && idx !== recapChapterIndex) {
      recapChapterIndex = idx;
      showRecap = true;
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => { showRecap = false; }, 3000);
    }
  });

  onMount(() => {
    myPlayerId = getStoredPlayerId();
  });
</script>

<main
  class="flex flex-col items-center justify-center min-h-[100dvh] bg-bg px-6 gap-6"
  style="--color-accent: var(--color-accent-groom);"
>
  <!-- Role badge pill -->
  <div
    class="px-6 py-2 rounded-full"
    style="background: #f59e0b;"
    aria-label="Role: Groom"
  >
    <span class="text-[24px] font-bold" style="color: #0f0f0f;">You are the Groom</span>
  </div>

  <!-- Player display name -->
  {#if myPlayer}
    <p class="text-[40px] font-bold text-text-primary">{myPlayer.name}</p>
  {:else}
    <p class="text-[40px] font-bold text-text-primary">Loading...</p>
  {/if}

  <!-- Waiting status -->
  <p class="text-base text-text-secondary text-center">Waiting for the game to start...</p>

  <!-- Three-dot pulse (UI-SPEC Animation Contract: 1200ms, staggered 400ms) -->
  <div class="flex gap-2" aria-hidden="true">
    <div class="dot" style="animation-delay: 0ms;"></div>
    <div class="dot" style="animation-delay: 400ms;"></div>
    <div class="dot" style="animation-delay: 800ms;"></div>
  </div>

  <!-- Recap Card Overlay (GAME-05) — shown on chapter unlock, auto-dismisses after 3s -->
  {#if $gameState && recapChapterIndex !== null}
    <div
      class="recap-overlay"
      class:visible={showRecap}
      aria-live="polite"
      role="status"
    >
      <div class="recap-content">
        <p class="recap-label">CHAPTER</p>
        <p class="recap-number">{recapChapterIndex + 1}</p>
        <p class="recap-chapter-name">
          {$gameState.chapters[recapChapterIndex]?.name ?? ""}
        </p>
        <p class="recap-progress">{recapChapterIndex + 1} of {$gameState.chapters.length}</p>
      </div>
    </div>
  {/if}
</main>

<style>
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #f59e0b;
    animation: pulse 1200ms ease-in-out infinite;
    opacity: 0.3;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 1; }
  }

  /* Recap card overlay — theatrical full-screen chapter announcement (GAME-05) */
  .recap-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(15, 15, 15, 0.95); /* --color-bg at 95% opacity */
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease; /* --duration-normal */
  }

  .recap-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .recap-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px; /* --spacing-sm */
    padding: 64px 32px; /* --spacing-3xl --spacing-xl */
    text-align: center;
  }

  .recap-label {
    font-size: 14px; /* --font-size-label */
    color: #9ca3af; /* --color-text-secondary */
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  .recap-number {
    font-size: 40px; /* --font-size-display */
    font-weight: 700;
    color: #f9fafb; /* --color-text-primary */
    line-height: 1.1;
    margin: 0;
  }

  .recap-chapter-name {
    font-size: 24px; /* --font-size-heading */
    font-weight: 700;
    color: #f59e0b; /* --color-accent-groom — theatrical highlight */
    line-height: 1.2;
    margin: 0;
  }

  .recap-progress {
    font-size: 14px; /* --font-size-label */
    color: #9ca3af; /* --color-text-secondary */
    margin: 0;
  }
</style>
