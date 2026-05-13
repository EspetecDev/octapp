<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { gameState, sendMessage } from "$lib/socket.ts";
  import type { DareProposal, Milestone, Player } from "$lib/types.ts";
  import * as m from '$lib/paraglide/messages.js';

  let authorized = $state<boolean | null>(null); // null = checking
  let sessionCode = $state<string | null>(null);
  let hasActiveSession = $state(false);
  let groomToken = $state<string | null>(null);
  let origin = $state<string>("");
  let errorMsg = $state<string | null>(null);
  let token = $state<string>("");
  let copiedKey = $state<string | null>(null);

  let groupUrl = $derived(`${origin}/`);
  let groomUrl = $derived(`${origin}/groom${groomToken ? `?token=${groomToken}` : ""}`);

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
  let activeChapter = $derived(
    activeChapterIndex !== null ? ($gameState?.chapters[activeChapterIndex] ?? null) : null
  );
  let milestones = $derived([...(($gameState?.milestones ?? []) as Milestone[])].sort((a, b) => a.points - b.points));
  let groomScore = $derived($gameState?.groomScore ?? 0);
  let finalMilestone = $derived(milestones[milestones.length - 1] ?? null);
  let progressPercent = $derived(finalMilestone ? Math.min(100, Math.round((groomScore / finalMilestone.points) * 100)) : 0);
  let dares = $derived(($gameState?.dareProposals ?? []) as DareProposal[]);
  let votingDares = $derived(dares.filter((dare) => dare.status === "voting"));
  let activeDares = $derived(dares.filter((dare) => dare.status === "active"));
  let resolvedDares = $derived(dares.filter((dare) => ["completed", "failed", "deleted"].includes(dare.status)).slice(0, 6));

  function unlockNextChapter() {
    sendMessage({ type: "UNLOCK_CHAPTER" });
  }

  function resetGame() {
    if (!confirm(m.admin_dash_reset_confirm())) return;
    sendMessage({ type: "RESET_GAME" });
  }

  function repeatChapter() {
    sendMessage({ type: "REPEAT_CHAPTER" });
  }

  function resolveDare(dareId: string, result: "completed" | "failed") {
    sendMessage({ type: "RESOLVE_DARE", dareId, result });
  }

  function deleteDare(dareId: string) {
    if (!confirm(m.admin_dash_delete_dare_confirm())) return;
    sendMessage({ type: "DELETE_DARE", dareId });
  }

  function playerName(playerId: string) {
    return players.find((player) => player.id === playerId)?.name ?? m.admin_dash_unknown_player();
  }

  function connectedYesVotes(dare: DareProposal) {
    const connectedIds = new Set(groupPlayers.filter((player) => player.connected).map((player) => player.id));
    return dare.votes.filter((id) => connectedIds.has(id)).length;
  }

  function voteLabel(dare: DareProposal) {
    const connectedCount = groupPlayers.filter((player) => player.connected).length;
    const needed = Math.floor(connectedCount / 2) + 1;
    return m.admin_dash_dare_votes({ yes: connectedYesVotes(dare), needed, total: connectedCount });
  }

  function dareStatus(status: DareProposal["status"]) {
    if (status === "completed") return m.admin_dash_dare_status_completed();
    if (status === "failed") return m.admin_dash_dare_status_failed();
    if (status === "deleted") return m.admin_dash_dare_status_deleted();
    if (status === "active") return m.admin_dash_dare_status_active();
    return m.admin_dash_dare_status_voting();
  }

  async function copyLink(url: string, key: string) {
    await navigator.clipboard.writeText(url);
    copiedKey = key;
    setTimeout(() => { copiedKey = null; }, 2000);
  }

  onMount(async () => {
    origin = window.location.origin;
    const adminToken = $page.url.searchParams.get("token") ?? "";
    token = adminToken;
    if (!adminToken) {
      authorized = false;
      errorMsg = m.admin_dash_access_denied();
      return;
    }
    try {
      const res = await fetch(`/api/admin/session?token=${encodeURIComponent(adminToken)}`);
      if (!res.ok) {
        authorized = false;
        errorMsg = m.admin_dash_access_denied();
        return;
      }
      const data = await res.json() as { sessionCode: string | null; groomToken: string | null; hasActiveSession: boolean };
      sessionCode = data.sessionCode;
      groomToken = data.groomToken;
      hasActiveSession = data.hasActiveSession;
      authorized = true;
    } catch {
      authorized = false;
      errorMsg = m.admin_dash_access_denied();
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
    <p class="text-[24px] font-bold text-text-primary">{m.admin_dash_access_denied()}</p>
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
        <p class="text-[14px] text-text-secondary mb-1">{m.admin_dash_share_code_label()}</p>
        <p
          class="text-[40px] font-bold text-text-primary tracking-[0.1em]"
          aria-label={m.admin_dash_session_aria_label({ code: sessionCode ?? '' })}
        >
          {sessionCode ?? "------"}
        </p>
        <p class="text-base text-text-secondary mt-1">
          {hasActiveSession ? m.admin_dash_players_join_url() : "Launch a config to create a session code."}
        </p>
      </div>
      {#if groomPlayer}
        <p class="text-[14px] text-text-secondary">{m.admin_dash_groom_role_claimed()}</p>
      {/if}

      <!-- Shareable links -->
      <div class="flex flex-col gap-2 w-full">
        <!-- Group link -->
        <div class="flex items-center gap-3 rounded-lg bg-surface border border-border px-3 py-2">
          <span class="text-[14px] text-text-secondary w-12 flex-shrink-0">{m.admin_dash_group_link_label()}</span>
          <span class="text-[12px] text-text-primary flex-1 truncate font-mono">{groupUrl}</span>
          <button
            onclick={() => copyLink(groupUrl, "group")}
            class="text-[12px] text-accent-admin flex-shrink-0 min-w-[52px] text-right"
          >
            {copiedKey === "group" ? m.admin_dash_copied_btn() : m.admin_dash_copy_btn()}
          </button>
        </div>
        <!-- Groom link -->
        <div class="flex items-center gap-3 rounded-lg bg-surface border border-border px-3 py-2">
          <span class="text-[14px] text-text-secondary w-12 flex-shrink-0">{m.admin_dash_groom_link_label()}</span>
          <span class="text-[12px] text-text-primary flex-1 truncate font-mono">{groomUrl}</span>
          <button
            onclick={() => copyLink(groomUrl, "groom")}
            class="text-[12px] text-accent-admin flex-shrink-0 min-w-[52px] text-right"
          >
            {copiedKey === "groom" ? m.admin_dash_copied_btn() : m.admin_dash_copy_btn()}
          </button>
        </div>
      </div>
    </section>

    <!-- Zone 2: Configure Game (lobby only — disappears after first chapter unlocked, D-03) -->
    {#if !hasActiveSession || isLobby}
      <section class="px-6 pb-4">
        <a
          href="/admin/setup?token={token}"
          class="block text-[14px] text-accent-admin"
        >
          {hasActiveSession ? m.admin_dash_configure_link() : "Open game configs"}
        </a>
      </section>
    {/if}

    <!-- Zone 3: Chapter Control -->
    <section class="px-6 pb-6">
      <p class="text-[14px] text-text-secondary mb-3">{m.admin_dash_game_progress_header()}</p>

      {#if !hasActiveSession}
        <p class="text-base text-text-secondary">No active session. Launch a saved config when you are ready to test.</p>
      {:else if isLobby && chapterCount === 0}
        <!-- No chapters configured yet -->
        <p class="text-base text-text-secondary">{m.admin_dash_no_chapters()}</p>
      {:else if activeChapterIndex === null}
        <!-- Lobby with chapters ready -->
        <p class="text-base text-text-primary mb-3">{m.admin_dash_chapters_ready({ count: chapterCount })}</p>
      {:else}
        <!-- Active game -->
        <p class="text-base text-text-primary mb-3">
          {m.admin_dash_chapter_active({ current: (activeChapterIndex ?? 0) + 1, total: chapterCount })}
        </p>
      {/if}

      <!-- Unlock button — only when there's a next chapter to unlock (D-09) -->
      {#if canUnlock}
        <button
          onclick={unlockNextChapter}
          class="w-full min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl"
        >
          {activeChapterIndex === null ? m.admin_dash_unlock_first() : m.admin_dash_unlock_next({ number: (activeChapterIndex ?? -1) + 2 })}
        </button>
      {:else if chapterCount > 0 && activeChapterIndex !== null && activeChapterIndex >= chapterCount - 1}
        <p class="text-[14px] text-text-secondary">{m.admin_dash_all_complete()}</p>
      {/if}

      <!-- Admin override: Confirm Found — visible when minigame done but scavenger not yet confirmed -->
      {#if activeChapter?.minigameDone && !activeChapter?.scavengerDone}
        <button
          onclick={() => sendMessage({ type: "SCAVENGER_DONE" })}
          class="w-full min-h-[48px] bg-surface border border-border text-text-primary font-bold rounded-xl mt-3"
          style="min-height: 48px;"
        >
          {m.admin_dash_confirm_found_btn()}
        </button>
      {/if}

      <!-- Repeat Chapter — visible when a chapter is active (resets its progress) -->
      {#if activeChapterIndex !== null}
        <button
          onclick={repeatChapter}
          class="w-full min-h-[48px] bg-surface border border-border text-text-primary font-bold rounded-xl mt-3"
        >
          {m.admin_dash_repeat_chapter_btn({ number: (activeChapterIndex ?? 0) + 1 })}
        </button>
      {/if}

      <!-- Reset Game — always visible, destructive -->
      <button
        onclick={resetGame}
        class="w-full min-h-[48px] rounded-xl mt-3 font-bold"
        style="background: #ef4444; color: #f9fafb;"
      >
        {m.admin_dash_reset_btn()}
      </button>
    </section>

    <!-- Zone 4: Global progress and dares -->
    <section class="px-6 pb-8">
      <div class="progress-panel">
        <div class="progress-row">
          <span>{m.admin_dash_global_score_label()}</span>
          <strong>{m.admin_dash_score_points({ score: groomScore })}</strong>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" style="width: {progressPercent}%;"></div>
        </div>
        <div class="milestone-list">
          {#each milestones as milestone (milestone.id)}
            <div class:unlocked={milestone.unlocked}>
              <span>{m.admin_dash_milestone_points({ points: milestone.points })}</span>
              <strong>{milestone.reward}</strong>
            </div>
          {/each}
        </div>
      </div>

      <p class="text-[14px] text-text-secondary mt-6 mb-3">{m.admin_dash_active_dares_header()}</p>
      {#if activeDares.length === 0}
        <p class="text-base text-text-secondary">{m.admin_dash_active_dares_empty()}</p>
      {:else}
        <ul class="admin-dare-list">
          {#each activeDares as dare (dare.id)}
            <li>
              <div class="admin-dare-top">
                <span>{m.admin_dash_dare_points({ points: dare.points })}</span>
                <small>{m.admin_dash_dare_proposed_by({ name: playerName(dare.proposedBy) })}</small>
              </div>
              <p>{dare.text}</p>
              <div class="admin-dare-actions">
                <button class="complete" onclick={() => resolveDare(dare.id, "completed")}>{m.admin_dash_complete_dare_btn()}</button>
                <button onclick={() => resolveDare(dare.id, "failed")}>{m.admin_dash_fail_dare_btn()}</button>
                <button class="delete" aria-label={m.admin_dash_delete_dare_aria()} onclick={() => deleteDare(dare.id)}>×</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      <p class="text-[14px] text-text-secondary mt-6 mb-3">{m.admin_dash_voting_dares_header()}</p>
      {#if votingDares.length === 0}
        <p class="text-base text-text-secondary">{m.admin_dash_voting_dares_empty()}</p>
      {:else}
        <ul class="admin-dare-list">
          {#each votingDares as dare (dare.id)}
            <li>
              <div class="admin-dare-top">
                <span>{m.admin_dash_dare_points({ points: dare.points })}</span>
                <small>{voteLabel(dare)}</small>
              </div>
              <p>{dare.text}</p>
              <button class="delete full" onclick={() => deleteDare(dare.id)}>{m.admin_dash_delete_dare_btn()}</button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if resolvedDares.length > 0}
        <p class="text-[14px] text-text-secondary mt-6 mb-3">{m.admin_dash_resolved_dares_header()}</p>
        <ul class="resolved-list">
          {#each resolvedDares as dare (dare.id)}
            <li><span>{dare.text}</span><strong>{dareStatus(dare.status)}</strong></li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Zone 5: Player list -->
    <section
      class="flex-1 overflow-y-auto px-6 pb-8"
      style="-webkit-overflow-scrolling: touch; overscroll-behavior: contain;"
    >
      <p class="text-[14px] text-text-secondary mb-4">{m.admin_dash_players_header()}</p>

      {#if players.length === 0}
        <!-- Empty state (UI-SPEC) -->
        <div class="text-center py-12">
          <p class="text-[24px] font-bold text-text-primary mb-2">{m.admin_dash_waiting_heading()}</p>
          <p class="text-base text-text-secondary">{m.admin_dash_waiting_body()}</p>
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
                {player.role === "groom" ? m.admin_dash_role_groom() : m.admin_dash_role_group()}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Zone 6: Legacy scores mirror -->
    <section class="px-6 pb-8">
      <p class="text-[14px] text-text-secondary mb-3">{m.admin_dash_scores_header()}</p>

      {#if players.length === 0}
        <p class="text-base text-text-secondary">{m.admin_dash_no_players()}</p>
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
  .progress-panel {
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #242426;
    padding: 16px;
  }

  .progress-row,
  .admin-dare-top,
  .resolved-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .progress-row span {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .progress-row strong {
    color: #f59e0b;
    font-size: 24px;
  }

  .progress-track {
    height: 12px;
    overflow: hidden;
    border-radius: 9999px;
    background: #0f0f0f;
    margin: 12px 0;
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f59e0b, #22c55e);
  }

  .milestone-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .milestone-list div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    padding: 8px 12px;
  }

  .milestone-list div.unlocked {
    border-color: #22c55e;
  }

  .milestone-list span,
  .admin-dare-top span {
    color: #f59e0b;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .milestone-list strong {
    color: #f9fafb;
    font-size: 14px;
    text-align: right;
  }

  .admin-dare-list,
  .resolved-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
  }

  .admin-dare-list li,
  .resolved-list li {
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #242426;
    padding: 12px;
  }

  .admin-dare-top small {
    color: #9ca3af;
    font-size: 12px;
  }

  .admin-dare-list p {
    color: #f9fafb;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    margin: 8px 0 12px;
  }

  .admin-dare-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 44px;
    gap: 8px;
  }

  .admin-dare-actions button,
  .admin-dare-list button.full {
    min-height: 44px;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #0f0f0f;
    color: #f9fafb;
    font-weight: 700;
  }

  .admin-dare-actions .complete {
    border-color: #22c55e;
    color: #22c55e;
  }

  .admin-dare-actions .delete,
  .admin-dare-list button.delete {
    border-color: #ef4444;
    color: #ef4444;
  }

  .resolved-list span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f9fafb;
  }

  .resolved-list strong {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
  }

  .player-chip {
    animation: chipAppear 200ms cubic-bezier(0.0, 0.0, 0.2, 1) both;
  }
  @keyframes chipAppear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
