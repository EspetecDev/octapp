<script lang="ts">
  import { onMount } from "svelte";
  import { gameState, getStoredPlayerId } from "$lib/socket.ts";
  import type { Player } from "$lib/types.ts";

  let myPlayerId = $state<string | null>(null);

  onMount(() => {
    myPlayerId = getStoredPlayerId();
  });

  let myPlayer = $derived<Player | null>(
    myPlayerId ? ($gameState?.players.find((p: Player) => p.id === myPlayerId) ?? null) : null
  );

  let allConnectedPlayers = $derived(
    ($gameState?.players ?? []).filter((p: Player) => p.connected)
  );

  let groupMembers = $derived(
    allConnectedPlayers.filter((p: Player) => p.role === "group")
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

  // Reward reveal state (RWRD-01, D-24)
  let showRewardReveal = $state(false);
  let revealedChapterIndex = $state<number | null>(null);

  $effect(() => {
    const idx = $gameState?.activeChapterIndex ?? null;
    const chapter = idx !== null ? ($gameState?.chapters[idx] ?? null) : null;

    if (!initialSyncDone) {
      // Baseline on first STATE_SYNC (Pitfall 4 guard)
      revealedChapterIndex = idx;
      // If player joins mid-reward, show overlay immediately
      if (chapter?.scavengerDone && idx !== null) {
        showRewardReveal = true;
      }
      return;
    }

    // New reward: scavengerDone flipped true on current chapter
    if (chapter?.scavengerDone && idx !== revealedChapterIndex) {
      revealedChapterIndex = idx;
      showRewardReveal = true;
    }

    // Dismiss when chapter advances (activeChapterIndex changes beyond revealedChapterIndex)
    if (idx !== null && revealedChapterIndex !== null && idx !== revealedChapterIndex && showRewardReveal) {
      showRewardReveal = false;
    }
  });
</script>

<main
  class="flex flex-col items-center justify-center min-h-[100dvh] bg-bg px-6 gap-6"
  style="--color-accent: var(--color-accent-group);"
>
  <!-- Role badge pill -->
  <div
    class="px-6 py-2 rounded-full"
    style="background: #ef4444;"
  >
    <span class="text-[24px] font-bold text-text-primary">You're in the Group</span>
  </div>

  <!-- Player display name -->
  {#if myPlayer}
    <p class="text-[40px] font-bold text-text-primary">{myPlayer.name}</p>
  {:else}
    <p class="text-[40px] font-bold text-text-primary">Loading...</p>
  {/if}

  <!-- Live player count (UI-SPEC: "{N} players ready") -->
  <p class="text-[24px] font-bold text-text-primary">
    {allConnectedPlayers.length} player{allConnectedPlayers.length === 1 ? "" : "s"} ready
  </p>

  <!-- Mini player list — scrollable (UI-SPEC: max-height 200px) -->
  {#if groupMembers.length > 0}
    <ul
      class="w-full max-w-xs overflow-y-auto rounded-lg bg-surface border border-border"
      style="max-height: 200px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;"
      aria-label="Group members"
    >
      {#each groupMembers as player (player.id)}
        <li class="text-[14px] text-text-secondary px-4 py-2 border-b border-border last:border-0">
          {player.name}
        </li>
      {/each}
    </ul>
  {/if}

  <!-- Waiting status -->
  <p class="text-base text-text-secondary text-center">The game starts when your host is ready.</p>

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

  <!-- Reward Reveal Overlay (RWRD-01) — persists until next chapter unlock -->
  {#if $gameState && revealedChapterIndex !== null}
    {@const revealChapter = $gameState.chapters[revealedChapterIndex]}
    <div
      class="reward-overlay"
      class:visible={showRewardReveal}
      role="status"
      aria-live="polite"
    >
      <div class="reward-content">
        <p class="reward-label">REWARD UNLOCKED</p>
        <p class="reward-chapter">{revealChapter?.name ?? ""}</p>
        <div class="reward-text-container">
          <p class="reward-text">{revealChapter?.reward ?? ""}</p>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
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

  /* Reward reveal overlay — same base as recap, but persists (UI-SPEC RewardReveal section) */
  .reward-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(15, 15, 15, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }

  .reward-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .reward-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px; /* gap-lg */
    padding: 64px 32px; /* py-3xl px-xl */
    text-align: center;
  }

  .reward-label {
    font-size: 14px;
    color: #9ca3af;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  .reward-chapter {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }

  .reward-text-container {
    box-shadow: 0 0 32px rgba(245, 158, 11, 0.25); /* glow per UI-SPEC */
    border-radius: 12px;
    padding: 8px;
  }

  .reward-text {
    font-size: 40px;
    font-weight: 700;
    color: #f59e0b; /* --color-accent-groom */
    text-align: center;
    line-height: 1.2;
    margin: 0;
  }
</style>
