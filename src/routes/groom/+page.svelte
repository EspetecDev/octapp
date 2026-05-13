<script lang="ts">
  import { onMount } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { gameState, getStoredPlayerId, storePlayerSession, sendMessage } from "$lib/socket.ts";
  import { acquireWakeLock, releaseWakeLock } from "$lib/wakeLock.ts";
  import type { DareProposal, Milestone, Player, Chapter } from "$lib/types.ts";
  import * as m from '$lib/paraglide/messages.js';
  // Component imports — implemented in Plans 03, 04, 05, 06
  // These files will be created by downstream plans; import them now for the router to work
  import TriviaMinigame from "$lib/components/TriviaMinigame.svelte";
  import MemoryMinigame from "$lib/components/MemoryMinigame.svelte";
  import ScavengerScreen from "$lib/components/ScavengerScreen.svelte";
  import RewardScreen from "$lib/components/RewardScreen.svelte";

  // FIX-01: Block all navigation away from the game during an active session (D-01, D-02, D-03)
  // beforeNavigate cancels SvelteKit client-side navigation
  beforeNavigate(({ cancel }) => {
    cancel();
  });

  let myPlayerId = $state<string | null>(null);
  let myPlayer = $derived<Player | null>(
    myPlayerId ? ($gameState?.players.find((p: Player) => p.id === myPlayerId) ?? null) : null
  );

  let activeChapter = $derived<Chapter | null>(
    $gameState?.activeChapterIndex != null
      ? ($gameState.chapters[$gameState.activeChapterIndex] ?? null)
      : null
  );

  let screen = $derived.by<"waiting" | "minigame" | "scavenger" | "reward">(() => {
    if (!$gameState || $gameState.phase === "lobby" || activeChapter === null) return "waiting";
    if (!activeChapter.minigameDone) return "minigame";
    if (!activeChapter.scavengerDone) return "scavenger";
    return "reward";
  });

  let milestones = $derived([...(($gameState?.milestones ?? []) as Milestone[])].sort((a, b) => a.points - b.points));
  let groomScore = $derived($gameState?.groomScore ?? 0);
  let finalMilestone = $derived(milestones[milestones.length - 1] ?? null);
  let nextMilestone = $derived(milestones.find((milestone) => !milestone.unlocked) ?? finalMilestone);
  let progressPercent = $derived(
    finalMilestone ? Math.min(100, Math.round((groomScore / finalMilestone.points) * 100)) : 0
  );
  let activeDares = $derived((($gameState?.dareProposals ?? []) as DareProposal[]).filter((dare) => dare.status === "active"));

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

  $effect(() => {
    if (screen === "minigame") {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  });

  onMount(async () => {
    // Push dummy history entry so Android back button hits this entry first (FIX-01, D-02)
    history.pushState(null, "", window.location.href);
    const storedId = getStoredPlayerId();
    if (storedId) {
      myPlayerId = storedId;
      return;
    }
    // No stored session — auto-join as groom without going through the join form
    const groomToken = new URLSearchParams(window.location.search).get("token") ?? "";
    try {
      const res = await fetch("/api/groom/join", {
        method: "POST",
        headers: groomToken ? { "x-groom-token": groomToken } : {},
      });
      if (res.ok) {
        const { playerId, sessionCode } = await res.json() as { playerId: string; sessionCode: string };
        storePlayerSession(playerId, sessionCode);
        myPlayerId = playerId;
        sendMessage({ type: "REJOIN", playerId, sessionCode });
      }
    } catch {
      // ignore — page will show "Loading..." until connection is established
    }
  });
</script>

<main
  class="flex flex-col min-h-[100dvh] bg-bg"
  style="--color-accent: var(--color-accent-groom);"
>
  {#if screen === "waiting"}
    <div class="flex flex-col items-center justify-center flex-1 gap-6 px-5">
      <!-- Role badge pill -->
      <div
        class="px-6 py-2 rounded-full"
        style="background: #f59e0b;"
        aria-label={m.groom_role_aria_label()}
      >
        <span class="text-[24px] font-bold" style="color: #0f0f0f;">{m.groom_role_badge()}</span>
      </div>

      <!-- Player display name -->
      {#if myPlayer}
        <p class="text-[40px] font-bold text-text-primary">{myPlayer.name}</p>
      {:else}
        <p class="text-[40px] font-bold text-text-primary">{m.groom_loading()}</p>
      {/if}

      <!-- Waiting status -->
      <p class="text-base text-text-secondary text-center">{m.groom_waiting()}</p>

      <!-- Three-dot pulse (UI-SPEC Animation Contract: 1200ms, staggered 400ms) -->
      <div class="flex gap-2" aria-hidden="true">
        <div class="dot" style="animation-delay: 0ms;"></div>
        <div class="dot" style="animation-delay: 400ms;"></div>
        <div class="dot" style="animation-delay: 800ms;"></div>
      </div>
    </div>
  {:else if screen === "minigame"}
    {#if activeChapter?.minigameType === "trivia"}
      <TriviaMinigame chapter={activeChapter} />
    {:else if activeChapter?.minigameType === "memory"}
      <MemoryMinigame />
    {/if}
  {:else if screen === "scavenger"}
    <ScavengerScreen chapter={activeChapter} />
  {:else if screen === "reward"}
    <RewardScreen chapter={activeChapter} activeChapterIndex={$gameState?.activeChapterIndex ?? 0} chapters={$gameState?.chapters ?? []} />
  {/if}

  {#if $gameState}
    <aside class="groom-score-hud" aria-label={m.groom_score_aria_label()}>
      <div class="hud-row">
        <span>{m.groom_score_label()}</span>
        <strong>{m.groom_score_points({ score: groomScore })}</strong>
      </div>
      <div class="hud-track" aria-hidden="true">
        <div class="hud-fill" style="width: {progressPercent}%;"></div>
      </div>
      <p>
        {#if nextMilestone && !nextMilestone.unlocked}
          {m.groom_next_milestone({ points: nextMilestone.points, reward: nextMilestone.reward })}
        {:else if finalMilestone?.unlocked}
          {m.groom_all_milestones_unlocked()}
        {:else}
          {m.groom_no_milestones()}
        {/if}
      </p>
    </aside>
  {/if}

  {#if activeDares.length > 0}
    <aside class="groom-dares-panel">
      <p class="groom-dares-title">{m.groom_active_dares_header()}</p>
      {#each activeDares.slice(0, 2) as dare (dare.id)}
        <div class="groom-dare">
          <span>{m.groom_dare_points({ points: dare.points })}</span>
          <strong>{dare.text}</strong>
        </div>
      {/each}
    </aside>
  {/if}

  <!-- Recap Card Overlay (GAME-05) — shown on chapter unlock, auto-dismisses after 3s -->
  <!-- Rendered outside screen blocks so it overlays all screens via position: fixed -->
  {#if $gameState && recapChapterIndex !== null}
    <div
      class="recap-overlay"
      class:visible={showRecap}
      aria-live="polite"
      role="status"
    >
      <div class="recap-content">
        <p class="recap-label">{m.groom_recap_label()}</p>
        <p class="recap-number">{recapChapterIndex + 1}</p>
        <p class="recap-chapter-name">
          {$gameState.chapters[recapChapterIndex]?.name ?? ""}
        </p>
        <p class="recap-progress">{m.groom_recap_progress({ current: recapChapterIndex + 1, total: $gameState.chapters.length })}</p>
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

  .groom-score-hud {
    position: fixed;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 40;
    padding: 10px 12px;
    border: 1px solid rgba(245, 158, 11, 0.55);
    border-radius: 8px;
    background: rgba(36, 36, 38, 0.92);
    backdrop-filter: blur(10px);
    pointer-events: none;
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .hud-row span,
  .groom-dares-title {
    color: #9ca3af;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0;
  }

  .hud-row strong {
    color: #f59e0b;
    font-size: 18px;
  }

  .hud-track {
    height: 8px;
    overflow: hidden;
    border-radius: 9999px;
    background: #0f0f0f;
    margin: 8px 0 6px;
  }

  .hud-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f59e0b, #22c55e);
  }

  .groom-score-hud p {
    color: #f9fafb;
    font-size: 12px;
    line-height: 1.3;
    margin: 0;
  }

  .groom-dares-panel {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid rgba(239, 68, 68, 0.55);
    border-radius: 8px;
    background: rgba(36, 36, 38, 0.92);
  }

  .groom-dare {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .groom-dare span {
    flex-shrink: 0;
    color: #f59e0b;
    border: 1px solid #f59e0b;
    border-radius: 9999px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 700;
  }

  .groom-dare strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f9fafb;
    font-size: 14px;
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
