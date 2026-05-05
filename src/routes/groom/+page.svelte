<script lang="ts">
  import { onMount } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { gameState, getStoredPlayerId, storePlayerSession, lastEffect, sendMessage } from "$lib/socket.ts";
  import type { EffectActivatedPayload } from "$lib/socket.ts";
  import { acquireWakeLock, releaseWakeLock } from "$lib/wakeLock.ts";
  import type { Player, Chapter } from "$lib/types.ts";
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

  // Announcement overlay state (GRPX-06, D-07/D-08/D-09)
  // Page-level only — minigame components handle gameplay effects; this is for the theatrical announcement
  let showAnnouncement = $state(false);
  let announcementData = $state<EffectActivatedPayload | null>(null);
  let announceDismissTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;
    announcementData = effect;
    showAnnouncement = true;
    if (announceDismissTimer) clearTimeout(announceDismissTimer);
    announceDismissTimer = setTimeout(() => {
      showAnnouncement = false;
    }, 2000);
  });

  let isSabotage = $derived(
    announcementData?.effectType === "timer_reduce" ||
    announcementData?.effectType === "scramble_options" ||
    announcementData?.effectType === "distraction"
  );

  let activatingPlayerName = $derived(
    $gameState?.players.find((p) => p.id === announcementData?.activatedBy)?.name?.toUpperCase() ?? ""
  );

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

  <!-- Announcement overlay (GRPX-06, D-07/D-08/D-09) — appears on all clients on EFFECT_ACTIVATED -->
  <!-- z-index: 100 — above all overlays per UI-SPEC; pointer-events: none — auto-dismisses, no user interaction -->
  <div
    class="announcement-overlay"
    class:visible={showAnnouncement}
    style="background: {isSabotage ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.85)'};"
    role="status"
    aria-live="assertive"
  >
    <p class="announce-player">{activatingPlayerName}</p>
    <p class="announce-powerup">{isSabotage ? '⚡' : '✨'} {announcementData?.powerUpName ?? ''}</p>
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

  /* Announcement overlay (GRPX-06, D-07/D-08/D-09) — mirrors recap-overlay pattern */
  .announcement-overlay {
    position: fixed;
    inset: 0;
    z-index: 100; /* above all overlays per UI-SPEC */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    opacity: 0;
    pointer-events: none; /* always none — auto-dismisses, no user interaction */
    transition: opacity 200ms ease;
    padding: 64px 32px;
    text-align: center;
  }
  .announcement-overlay.visible {
    opacity: 1;
    pointer-events: none; /* always none — auto-dismisses, no user interaction */
  }
  .announce-player {
    font-size: 64px; /* component-scoped override — theatrical impact, NOT a system token */
    font-weight: 700;
    color: #f9fafb;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.1;
    margin: 0;
  }
  .announce-powerup {
    font-size: 40px; /* --font-size-display token */
    font-weight: 700;
    color: #f9fafb;
    line-height: 1.1;
    margin: 0;
  }
</style>
