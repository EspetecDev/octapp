<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { gameState, sendMessage } from "$lib/socket.ts";
  import type { Player } from "$lib/types.ts";

  let authorized = $state<boolean | null>(null); // null = checking
  let sessionCode = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let token = $state<string>("");

  // Players derived from live game state
  let players = $derived($gameState?.players ?? []);
  let groomPlayer = $derived(players.find((p: Player) => p.role === "groom") ?? null);
  let groupPlayers = $derived(players.filter((p: Player) => p.role === "group"));

  // Chapter control derived values
  let activeChapterIndex = $derived($gameState?.activeChapterIndex ?? null);
  let chapterCount = $derived($gameState?.chapters.length ?? 0);
  let canUnlock = $derived(
    chapterCount > 0 &&
    (activeChapterIndex === null || activeChapterIndex < chapterCount - 1)
  );
  let isLobby = $derived($gameState?.phase === "lobby");
  let scores = $derived($gameState?.scores ?? {});

  function unlockNextChapter() {
    sendMessage({ type: "UNLOCK_CHAPTER" });
  }

  onMount(async () => {
    const adminToken = $page.url.searchParams.get("token") ?? "";
    token = adminToken;
    if (!adminToken) {
      authorized = false;
      errorMsg = "Access denied.";
      return;
    }
    try {
      const res = await fetch(`/api/admin/session?token=${encodeURIComponent(adminToken)}`);
      if (!res.ok) {
        authorized = false;
        errorMsg = "Access denied.";
        return;
      }
      const data = await res.json() as { sessionCode: string };
      sessionCode = data.sessionCode;
      authorized = true;
    } catch {
      authorized = false;
      errorMsg = "Access denied.";
    }
  });
</script>

{#if authorized === null}
  <!-- Loading -->
  <main class="flex min-h-[100dvh] items-center justify-center bg-bg">
    <div class="w-8 h-8 rounded-full border-2 border-accent-admin border-t-transparent animate-spin"></div>
  </main>

{:else if authorized === false}
  <!-- Unauthorized -->
  <main class="flex min-h-[100dvh] items-center justify-center bg-bg">
    <p class="text-[24px] font-bold text-text-primary">Access denied.</p>
  </main>

{:else}
  <!-- Authorized: session code + player list -->
  <main class="flex flex-col min-h-[100dvh] bg-bg">

    <!-- Zone 1 (top 40%): Session code display -->
    <section
      class="flex-shrink-0 flex flex-col items-center justify-center px-6 py-8 gap-3"
      style="height: 40dvh;"
    >
      <div class="rounded-xl border-2 border-accent-admin px-8 py-5 text-center">
        <p class="text-[14px] text-text-secondary mb-1">Share this code</p>
        <p
          class="text-[40px] font-bold text-text-primary tracking-[0.1em]"
          aria-label="Session code: {sessionCode}"
        >
          {sessionCode}
        </p>
        <p class="text-base text-text-secondary mt-1">Players join at this URL</p>
      </div>
      {#if groomPlayer}
        <p class="text-[14px] text-text-secondary">Groom role claimed</p>
      {/if}
    </section>

    <!-- Zone 2: Configure Game (lobby only — disappears after first chapter unlocked, D-03) -->
    {#if isLobby}
      <section class="px-6 pb-4">
        <a
          href="/admin/setup?token={token}"
          class="block text-[14px] text-accent-admin"
        >
          Configure Game
        </a>
      </section>
    {/if}

    <!-- Zone 3: Chapter Control -->
    <section class="px-6 pb-6">
      <p class="text-[14px] text-text-secondary mb-3">Game Progress</p>

      {#if isLobby && chapterCount === 0}
        <!-- No chapters configured yet -->
        <p class="text-base text-text-secondary">No chapters configured. Tap Configure Game to set up before the event.</p>
      {:else if activeChapterIndex === null}
        <!-- Lobby with chapters ready -->
        <p class="text-base text-text-primary mb-3">Chapters ready: {chapterCount}</p>
      {:else}
        <!-- Active game -->
        <p class="text-base text-text-primary mb-3">
          Chapter {activeChapterIndex + 1} of {chapterCount} — active
        </p>
      {/if}

      <!-- Unlock button — only when there's a next chapter to unlock (D-09) -->
      {#if canUnlock}
        <button
          onclick={unlockNextChapter}
          class="w-full min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl"
        >
          {activeChapterIndex === null ? "Unlock Chapter 1" : `Unlock Chapter ${(activeChapterIndex ?? -1) + 2}`}
        </button>
      {:else if chapterCount > 0 && activeChapterIndex !== null && activeChapterIndex >= chapterCount - 1}
        <p class="text-[14px] text-text-secondary">All chapters complete.</p>
      {/if}
    </section>

    <!-- Zone 4: Player list -->
    <section
      class="flex-1 overflow-y-auto px-6 pb-8"
      style="-webkit-overflow-scrolling: touch; overscroll-behavior: contain;"
    >
      <p class="text-[14px] text-text-secondary mb-4">Players in lobby</p>

      {#if players.length === 0}
        <!-- Empty state (UI-SPEC) -->
        <div class="text-center py-12">
          <p class="text-[24px] font-bold text-text-primary mb-2">Waiting for players</p>
          <p class="text-base text-text-secondary">Share the code above. Players join at this URL.</p>
        </div>
      {:else}
        <ul class="flex flex-col gap-2">
          {#each players as player (player.id)}
            <li
              class="
                flex items-center gap-2 h-12 px-3 rounded-lg bg-surface border border-border
                transition-opacity duration-200
                {player.connected ? 'opacity-100' : 'opacity-50'}
                player-chip
              "
            >
              <!-- Connection dot -->
              <div
                class="w-2 h-2 rounded-full flex-shrink-0"
                style="background: {player.connected ? '#22c55e' : '#9ca3af'};"
                aria-hidden="true"
              ></div>
              <!-- Name -->
              <span class="text-base text-text-primary flex-1 truncate">{player.name}</span>
              <!-- Role badge -->
              <span
                class="text-[14px] font-normal px-2 py-0.5 rounded-full"
                style="
                  color: {player.role === 'groom' ? '#0f0f0f' : '#f9fafb'};
                  background: {player.role === 'groom' ? '#f59e0b' : '#ef4444'};
                "
              >
                {player.role === "groom" ? "Groom" : "Group"}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Zone 5: Scores -->
    <section class="px-6 pb-8">
      <p class="text-[14px] text-text-secondary mb-3">Scores</p>

      {#if players.length === 0}
        <p class="text-base text-text-secondary">No players connected yet.</p>
      {:else}
        <ul class="flex flex-col gap-2">
          {#each players as player (player.id)}
            <li
              class="flex items-center h-12 px-4 rounded-lg bg-surface border border-border"
              style="{player.role === 'groom' ? 'border-left: 4px solid #f59e0b;' : ''}"
            >
              <span class="text-base text-text-primary flex-1 truncate">{player.name}</span>
              <span class="text-[24px] font-bold text-text-primary">
                {scores[player.id] ?? 0}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

  </main>
{/if}

<style>
  .player-chip {
    animation: chipAppear 200ms cubic-bezier(0.0, 0.0, 0.2, 1) both;
  }
  @keyframes chipAppear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
