<script lang="ts">
  import { onMount } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { gameState, lastEffect, getStoredPlayerId, sendMessage } from "$lib/socket.ts";
  import type { Player } from "$lib/types.ts";
  import type { EffectActivatedPayload } from "$lib/socket.ts";
  import * as m from '$lib/paraglide/messages.js';

  // FIX-01: Block all navigation away from the game during an active session (D-01, D-02, D-03)
  // beforeNavigate cancels SvelteKit client-side navigation
  beforeNavigate(({ cancel }) => {
    cancel();
  });

  let myPlayerId = $state<string | null>(null);

  onMount(() => {
    // Push dummy history entry so Android back button hits this entry first (FIX-01, D-02)
    history.pushState(null, "", window.location.href);
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

  // Economy state
  const EARN_CAP = 5;
  let earnedThisChallenge = $state(0);
  let earnFlash = $state(false);
  let spendingIndex = $state<number | null>(null); // index of item in optimistic loading state
  let spendRejectToast = $state(false);
  let spendToastTimer: ReturnType<typeof setTimeout> | null = null;

  // Announcement overlay state
  let showAnnouncement = $state(false);
  let announcementData = $state<EffectActivatedPayload | null>(null);
  let announceDismissTimer: ReturnType<typeof setTimeout> | null = null;

  // Derived values
  let activeChapter = $derived(
    $gameState?.activeChapterIndex != null
      ? ($gameState.chapters[$gameState.activeChapterIndex] ?? null)
      : null
  );

  // Active challenge: phase is "active" AND minigame not yet done
  let isChallengeLive = $derived(
    $gameState?.phase === "active" &&
    $gameState?.activeChapterIndex !== null &&
    activeChapter !== null &&
    !activeChapter.minigameDone
  );

  let myBalance = $derived($gameState?.tokenBalances?.[myPlayerId ?? ""] ?? 0);

  // Context-filtered shop (D-16/D-17/D-18)
  let filteredShop = $derived(
    ($gameState?.powerUpCatalog ?? [])
      .filter((p) => {
        if (p.effectType === "scramble_options" && activeChapter?.minigameType !== "trivia") return false;
        return true;
      })
      .sort((a, b) => {
        // timer_add first (helpful), then others (sabotages)
        if (a.effectType === "timer_add" && b.effectType !== "timer_add") return -1;
        if (b.effectType === "timer_add" && a.effectType !== "timer_add") return 1;
        return 0;
      })
  );

  let groupPlayers = $derived(($gameState?.players ?? []).filter((p) => p.role === "group"));

  let recentActions = $derived(($gameState?.recentActions ?? []).slice(0, 10));

  let chapterLabel = $derived(
    $gameState?.activeChapterIndex != null && activeChapter
      ? `CHAPTER ${($gameState.activeChapterIndex ?? 0) + 1} — ${activeChapter.name}`
      : ""
  );

  // Announcement overlay derived
  let isSabotage = $derived(
    announcementData?.effectType === "timer_reduce" ||
    announcementData?.effectType === "scramble_options" ||
    announcementData?.effectType === "distraction"
  );

  let activatingPlayerName = $derived(
    $gameState?.players.find((p) => p.id === announcementData?.activatedBy)?.name?.toUpperCase() ?? ""
  );

  // Announcement overlay — triggered by EFFECT_ACTIVATED (same pattern as groom page)
  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;
    announcementData = effect;
    showAnnouncement = true;
    if (announceDismissTimer) clearTimeout(announceDismissTimer);
    announceDismissTimer = setTimeout(() => { showAnnouncement = false; }, 2000);
  });

  // Earn counter reset on chapter change (Pitfall 3)
  // Must be inside initialSyncDone guard to avoid resetting on first STATE_SYNC
  $effect(() => {
    const idx = $gameState?.activeChapterIndex;
    if (!initialSyncDone) return; // initialSyncDone is already declared by recap card logic
    void idx; // reactive dependency — fires when chapter changes
    earnedThisChallenge = 0;
  });

  function handleEarnTap() {
    if (earnedThisChallenge >= EARN_CAP) return;
    earnedThisChallenge += 1;
    sendMessage({ type: "EARN_TOKEN" });
    if ("vibrate" in navigator) navigator.vibrate(50);
    // Green flash
    earnFlash = true;
    setTimeout(() => { earnFlash = false; }, 200);
  }

  function handleSpend(powerUpIndex: number) {
    if (spendingIndex !== null) return; // already pending
    const powerUp = filteredShop[powerUpIndex];
    if (!powerUp || myBalance < powerUp.tokenCost) return;

    // Map filteredShop index back to original powerUpCatalog index
    const catalogIndex = ($gameState?.powerUpCatalog ?? []).indexOf(powerUp);
    if (catalogIndex < 0) return;

    const balanceBefore = myBalance;
    spendingIndex = powerUpIndex;
    sendMessage({ type: "SPEND_TOKEN", powerUpIndex: catalogIndex });

    // Optimistic loading state — server will update balance via STATE_SYNC
    setTimeout(() => {
      // Show reject toast if balance hasn't changed (server rejected the spend)
      if (myBalance === balanceBefore) {
        if (spendToastTimer) clearTimeout(spendToastTimer);
        spendRejectToast = true;
        spendToastTimer = setTimeout(() => { spendRejectToast = false; }, 2000);
      }
      spendingIndex = null;
    }, 500);
  }
</script>

<main
  class="flex flex-col min-h-[100dvh] bg-bg"
  style="--color-accent: var(--color-accent-group);"
>
  {#if isChallengeLive}
    <!-- GroupEconomyScreen — active challenge layout (D-05, UI-SPEC Zone 1/2/3) -->

    <!-- Zone 1: Groom Progress Bar (fixed height 48px) -->
    <div class="groom-progress-bar">
      <span class="text-[14px] text-text-secondary uppercase tracking-widest truncate">{chapterLabel}</span>
      <span class="text-[24px] font-bold text-text-primary">
        {activeChapter?.servedQuestionIndex != null ? "⏱" : m.party_waiting_for_groom()}
      </span>
    </div>

    <!-- Zone 2: Earn Area (flex-1, centered) -->
    <div class="earn-zone">
      <!-- Token balance display (display size, 40px bold) -->
      <p class="text-[40px] font-bold text-text-primary text-center">
        {myBalance === 1 ? m.party_token_balance_single({ count: myBalance }) : m.party_token_balance_plural({ count: myBalance })}
      </p>

      <!-- Earned counter -->
      <p class="text-[14px] text-text-secondary text-center">
        {m.party_earned_counter({ earned: earnedThisChallenge })}
      </p>

      <!-- Chapter label above earn button -->
      <p class="text-[14px] text-text-secondary uppercase tracking-widest text-center">{chapterLabel}</p>

      <!-- Earn button -->
      <button
        class="earn-btn"
        class:earn-capped={earnedThisChallenge >= EARN_CAP}
        class:earn-flash={earnFlash}
        disabled={earnedThisChallenge >= EARN_CAP}
        aria-label={m.party_earn_aria_label()}
        aria-disabled={earnedThisChallenge >= EARN_CAP}
        ontouchend={handleEarnTap}
        onclick={handleEarnTap}
      >
        {earnedThisChallenge >= EARN_CAP ? m.party_earn_btn_capped() : m.party_earn_btn_active()}
      </button>
    </div>

    <!-- Zone 3: Shop (fixed max-height 40vh, overflow scroll) -->
    <div class="shop-zone">
      <p class="text-[14px] text-text-secondary uppercase tracking-[0.15em] mb-3">{m.party_shop_header()}</p>

      {#if filteredShop.length === 0}
        <p class="text-[14px] text-text-secondary text-center py-4">{m.party_shop_empty()}</p>
      {:else}
        <ul class="shop-list" aria-label={m.party_shop_aria_label()}>
          {#each filteredShop as powerUp, i}
            {@const canAfford = myBalance >= powerUp.tokenCost}
            {@const isPending = spendingIndex === i}
            <li
              class="shop-item"
              class:shop-item-unaffordable={!canAfford}
            >
              <div class="shop-item-info">
                <p class="text-[16px] font-bold text-text-primary leading-snug">{powerUp.name}</p>
                <p class="text-[14px] text-text-secondary" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{powerUp.description}</p>
              </div>
              <div class="shop-item-actions">
                <span class="cost-badge">{m.party_shop_cost_badge({ cost: powerUp.tokenCost })}</span>
                <button
                  class="spend-btn"
                  disabled={!canAfford || isPending}
                  style={isPending ? "opacity: 0.5;" : ""}
                  aria-label={m.party_shop_spend_aria_label({ cost: powerUp.tokenCost, name: powerUp.name })}
                  onclick={() => handleSpend(i)}
                >
                  {m.party_shop_spend_btn()}
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

  {:else}
    <!-- SocialWaitingScreen — lobby / between challenges (D-06) -->
    <div class="social-screen">

      <!-- Token Balances section -->
      <p class="section-header">{m.party_balances_header()}</p>
      <ul class="balances-list" aria-label={m.party_balances_aria_label()}>
        {#each groupPlayers as player (player.id)}
          <li class="balance-row">
            <span class="text-[16px] font-bold text-text-primary">{player.name}</span>
            <span class="balance-pill">💰 {$gameState?.tokenBalances?.[player.id] ?? 0}</span>
          </li>
        {/each}
        {#if groupPlayers.length === 0}
          <li class="px-4 py-3 text-[14px] text-text-secondary">{m.party_balances_empty()}</li>
        {/if}
      </ul>

      <!-- Recent Actions feed -->
      <p class="section-header">{m.party_actions_header()}</p>
      {#if recentActions.length === 0}
        <div class="empty-feed">
          <p class="text-[14px] font-bold text-text-primary">{m.party_actions_empty_heading()}</p>
          <p class="text-[14px] text-text-secondary">{m.party_actions_empty_body()}</p>
        </div>
      {:else}
        <ul class="actions-list" aria-label={m.party_actions_aria_label()}>
          {#each recentActions as action (action.timestamp)}
            <li class="action-row">
              <p class="text-[16px] text-text-primary">{action.playerName} used {action.powerUpName}</p>
              <p class="text-[14px] text-text-secondary">{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Waiting status (shown in lobby) -->
      {#if $gameState?.phase === "lobby"}
        <p class="text-base text-text-secondary text-center mt-4">{m.party_lobby_waiting()}</p>
      {/if}
    </div>
  {/if}

  <!-- Recap Card Overlay (GAME-05) — shown on chapter unlock, auto-dismisses after 3s -->
  {#if $gameState && recapChapterIndex !== null}
    <div
      class="recap-overlay"
      class:visible={showRecap}
      aria-live="polite"
      role="status"
    >
      <div class="recap-content">
        <p class="recap-label">{m.party_recap_label()}</p>
        <p class="recap-number">{recapChapterIndex + 1}</p>
        <p class="recap-chapter-name">
          {$gameState.chapters[recapChapterIndex]?.name ?? ""}
        </p>
        <p class="recap-progress">{m.party_recap_progress({ current: recapChapterIndex + 1, total: $gameState.chapters.length })}</p>
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
        <p class="reward-label">{m.party_reward_unlocked_label()}</p>
        <p class="reward-chapter">{revealChapter?.name ?? ""}</p>
        <div class="reward-text-container">
          <p class="reward-text">{revealChapter?.reward ?? ""}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Announcement overlay (GRPX-06, D-07/D-08/D-09) — all clients -->
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

  <!-- Spend reject toast -->
  {#if spendRejectToast}
    <div class="spend-toast" role="alert" aria-live="assertive">
      {m.party_spend_reject_toast()}
    </div>
  {/if}
</main>

<style>
  /* Zone 1: Groom progress bar */
  .groom-progress-bar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: #242426;
    border-bottom: 1px solid #4a4a4c;
    flex-shrink: 0;
  }

  /* Zone 2: Earn area */
  .earn-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
  }

  .earn-btn {
    width: 100%;
    max-width: 360px;
    height: 80px;
    background: #ef4444;
    color: #f9fafb;
    font-size: 24px;
    font-weight: 700;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: transform 100ms ease, background-color 200ms ease;
    min-height: 80px;
  }
  .earn-btn:active { transform: scale(0.95); }
  .earn-btn.earn-capped {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .earn-btn.earn-flash { background: #22c55e; }

  /* Zone 3: Shop */
  .shop-zone {
    max-height: 40vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 16px;
    border-top: 1px solid #4a4a4c;
    flex-shrink: 0;
  }

  .shop-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .shop-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    padding: 12px 16px;
    min-height: 64px;
  }
  .shop-item-unaffordable { opacity: 0.4; }

  .shop-item-info { flex: 1; min-width: 0; }
  .shop-item-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .cost-badge {
    font-size: 14px;
    color: #9ca3af;
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 9999px;
    padding: 2px 8px;
    white-space: nowrap;
  }

  .spend-btn {
    height: 36px;
    min-width: 48px;
    padding: 0 12px;
    background: #ef4444;
    color: #f9fafb;
    font-size: 14px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    min-height: 36px;
  }
  .spend-btn:disabled { cursor: not-allowed; }

  /* Social waiting screen */
  .social-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px 16px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .section-header {
    font-size: 14px;
    color: #9ca3af;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: 0;
  }

  .balances-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #242426;
    overflow: hidden;
  }
  .balance-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #4a4a4c;
    min-height: 44px;
  }
  .balance-row:last-child { border-bottom: none; }
  .balance-pill {
    font-size: 14px;
    color: #f9fafb;
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 9999px;
    padding: 2px 10px;
  }

  .actions-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .action-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 16px;
    border-bottom: 1px solid #4a4a4c;
    min-height: 44px;
  }
  .action-row:last-child { border-bottom: none; }

  .empty-feed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 24px 16px;
    text-align: center;
  }

  /* Announcement overlay (z-100, above all overlays) */
  .announcement-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
    padding: 64px 32px;
    text-align: center;
  }
  .announcement-overlay.visible {
    opacity: 1;
    pointer-events: none;
  }
  .announce-player {
    font-size: 64px;
    font-weight: 700;
    color: #f9fafb;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.1;
    margin: 0;
  }
  .announce-powerup {
    font-size: 40px;
    font-weight: 700;
    color: #f9fafb;
    line-height: 1.1;
    margin: 0;
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

  /* Spend reject toast */
  .spend-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    color: #f9fafb;
    z-index: 200;
    white-space: nowrap;
  }
</style>
