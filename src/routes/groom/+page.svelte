<script lang="ts">
  import { onMount } from "svelte";
  import { gameState, getStoredPlayerId } from "$lib/socket.ts";
  import type { Player } from "$lib/types.ts";

  let myPlayerId = $state<string | null>(null);
  let myPlayer = $derived<Player | null>(
    myPlayerId ? ($gameState?.players.find((p: Player) => p.id === myPlayerId) ?? null) : null
  );

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
</style>
