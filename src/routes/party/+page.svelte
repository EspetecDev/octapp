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
</main>
