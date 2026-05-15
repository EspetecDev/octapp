<script lang="ts">
  import { onMount } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { gameState, getStoredPlayerId, sendMessage } from "$lib/socket.ts";
  import type { DareProposal, Milestone, Player, PointTier } from "$lib/types.ts";
  import * as m from "$lib/paraglide/messages.js";

  beforeNavigate(({ cancel }) => {
    cancel();
  });

  const POINT_TIERS: PointTier[] = [10, 25, 50];

  let myPlayerId = $state<string | null>(null);
  let dareText = $state("");
  let selectedPoints = $state<PointTier>(25);
  let submitFlash = $state(false);

  onMount(() => {
    history.pushState(null, "", window.location.href);
    myPlayerId = getStoredPlayerId();
  });

  let players = $derived($gameState?.players ?? []);
  let groupPlayers = $derived(players.filter((player: Player) => player.role === "group"));
  let connectedGroupPlayers = $derived(groupPlayers.filter((player) => player.connected));
  let activeChapter = $derived(
    $gameState?.activeChapterIndex != null
      ? ($gameState.chapters[$gameState.activeChapterIndex] ?? null)
      : null
  );
  let chapterLabel = $derived(
    $gameState?.activeChapterIndex != null && activeChapter
      ? m.party_current_chapter({ number: ($gameState.activeChapterIndex ?? 0) + 1, name: activeChapter.name })
      : m.party_lobby_waiting()
  );

  let milestones = $derived([...(($gameState?.milestones ?? []) as Milestone[])].sort((a, b) => a.points - b.points));
  let groomScore = $derived($gameState?.groomScore ?? 0);
  let finalMilestone = $derived(milestones[milestones.length - 1] ?? null);
  let nextMilestone = $derived(milestones.find((milestone) => !milestone.unlocked) ?? finalMilestone);
  let progressPercent = $derived(
    finalMilestone ? Math.min(100, Math.round((groomScore / finalMilestone.points) * 100)) : 0
  );

  let dares = $derived(($gameState?.dareProposals ?? []) as DareProposal[]);
  let votingDares = $derived(dares.filter((dare) => dare.status === "voting"));
  let activeDares = $derived(dares.filter((dare) => dare.status === "active"));
  let resolvedDares = $derived(dares.filter((dare) => ["completed", "failed", "deleted"].includes(dare.status)).slice(0, 6));

  function playerName(playerId: string) {
    return players.find((player) => player.id === playerId)?.name ?? m.party_unknown_player();
  }

  function connectedYesVotes(dare: DareProposal) {
    const connectedIds = new Set(connectedGroupPlayers.map((player) => player.id));
    return dare.votes.filter((id) => connectedIds.has(id)).length;
  }

  function voteLabel(dare: DareProposal) {
    const connectedCount = connectedGroupPlayers.length;
    const needed = Math.floor(connectedCount / 2) + 1;
    return m.party_dare_votes({ yes: connectedYesVotes(dare), needed, total: connectedCount });
  }

  function hasVoted(dare: DareProposal) {
    return myPlayerId ? dare.votes.includes(myPlayerId) : false;
  }

  function statusText(status: DareProposal["status"]) {
    if (status === "completed") return m.party_dare_status_completed();
    if (status === "failed") return m.party_dare_status_failed();
    if (status === "deleted") return m.party_dare_status_deleted();
    if (status === "active") return m.party_dare_status_active();
    return m.party_dare_status_voting();
  }

  function proposeDare() {
    const text = dareText.trim();
    if (text.length < 3) return;
    sendMessage({ type: "PROPOSE_DARE", text, points: selectedPoints });
    dareText = "";
    submitFlash = true;
    setTimeout(() => { submitFlash = false; }, 1200);
  }

  function voteDare(dareId: string) {
    sendMessage({ type: "VOTE_DARE", dareId });
  }
</script>

<main class="party-screen">
  <section class="score-panel">
    <div class="score-row">
      <span>{m.party_score_label()}</span>
      <strong>{m.party_score_points({ score: groomScore })}</strong>
    </div>
    <div class="progress-track" aria-hidden="true">
      <div class="progress-fill" style="width: {progressPercent}%;"></div>
    </div>
    <div class="milestone-strip" aria-label={m.party_milestones_aria_label()}>
      {#each milestones as milestone (milestone.id)}
        <span class:unlocked={milestone.unlocked}>{milestone.points}</span>
      {/each}
    </div>
    <p class="next-reward">
      {#if nextMilestone && !nextMilestone.unlocked}
        {m.party_next_milestone({ points: nextMilestone.points, reward: nextMilestone.reward })}
      {:else if finalMilestone?.unlocked}
        {m.party_all_milestones_unlocked()}
      {:else}
        {m.party_no_milestones()}
      {/if}
    </p>
    <p class="chapter-context">{chapterLabel}</p>
  </section>

  <section class="proposal-panel">
    <p class="section-header">{m.party_propose_dare_header()}</p>
    <textarea
      rows="3"
      maxlength="160"
      placeholder={m.party_propose_dare_placeholder()}
      bind:value={dareText}
    ></textarea>

    <div class="tier-row" aria-label={m.party_point_tiers_aria_label()}>
      {#each POINT_TIERS as tier}
        <button
          class:selected={selectedPoints === tier}
          onclick={() => { selectedPoints = tier; }}
        >
          {m.party_point_tier({ points: tier })}
        </button>
      {/each}
    </div>

    <button class="submit-dare" class:submitted={submitFlash} disabled={dareText.trim().length < 3} onclick={proposeDare}>
      {submitFlash ? m.party_dare_submitted_btn() : m.party_submit_dare_btn()}
    </button>
  </section>

  <section class="list-section">
    <p class="section-header">{m.party_voting_dares_header()}</p>
    {#if votingDares.length === 0}
      <p class="empty-text">{m.party_voting_dares_empty()}</p>
    {:else}
      <ul class="dare-list">
        {#each votingDares as dare (dare.id)}
          <li class="dare-card">
            <div class="dare-card-top">
              <span class="points-badge">{m.party_point_tier({ points: dare.points })}</span>
              <span class="vote-count">{voteLabel(dare)}</span>
            </div>
            <p class="dare-text">{dare.text}</p>
            <p class="dare-meta">{m.party_dare_proposed_by({ name: playerName(dare.proposedBy) })}</p>
            <button class="vote-btn" disabled={hasVoted(dare)} onclick={() => voteDare(dare.id)}>
              {hasVoted(dare) ? m.party_dare_voted_btn() : m.party_dare_vote_btn()}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="list-section">
    <p class="section-header">{m.party_active_dares_header()}</p>
    {#if activeDares.length === 0}
      <p class="empty-text">{m.party_active_dares_empty()}</p>
    {:else}
      <ul class="dare-list">
        {#each activeDares as dare (dare.id)}
          <li class="dare-card active">
            <div class="dare-card-top">
              <span class="points-badge">{m.party_point_tier({ points: dare.points })}</span>
              <span class="active-badge">{m.party_dare_active_badge()}</span>
            </div>
            <p class="dare-text">{dare.text}</p>
            <p class="dare-meta">{m.party_host_resolves_dare()}</p>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="list-section">
    <p class="section-header">{m.party_resolved_dares_header()}</p>
    {#if resolvedDares.length === 0}
      <p class="empty-text">{m.party_resolved_dares_empty()}</p>
    {:else}
      <ul class="compact-list">
        {#each resolvedDares as dare (dare.id)}
          <li>
            <span>{dare.text}</span>
            <strong>{statusText(dare.status)}</strong>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  .party-screen {
    min-height: 100dvh;
    background: #0f0f0f;
    color: #f9fafb;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .score-panel,
  .proposal-panel,
  .dare-card {
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #242426;
    padding: 16px;
  }

  .score-row,
  .dare-card-top,
  .compact-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .score-row span,
  .section-header {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0;
  }

  .score-row strong {
    font-size: 24px;
    color: #f59e0b;
  }

  .progress-track {
    height: 12px;
    overflow: hidden;
    border-radius: 9999px;
    background: #0f0f0f;
    margin: 12px 0 10px;
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f59e0b, #22c55e);
    transition: width 180ms ease;
  }

  .milestone-strip {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .milestone-strip span,
  .points-badge,
  .active-badge {
    border: 1px solid #4a4a4c;
    border-radius: 9999px;
    padding: 2px 8px;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .milestone-strip span.unlocked,
  .active-badge {
    border-color: #22c55e;
    color: #22c55e;
  }

  .next-reward,
  .chapter-context,
  .empty-text,
  .dare-meta {
    color: #9ca3af;
    font-size: 14px;
    line-height: 1.4;
    margin: 8px 0 0;
  }

  .proposal-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  textarea {
    width: 100%;
    resize: none;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #0f0f0f;
    color: #f9fafb;
    font-size: 16px;
    line-height: 1.4;
    padding: 12px;
  }

  .tier-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .tier-row button,
  .submit-dare,
  .vote-btn {
    min-height: 44px;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    background: #0f0f0f;
    color: #f9fafb;
    font-weight: 700;
  }

  .tier-row button.selected {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.18);
  }

  .submit-dare {
    border-color: #ef4444;
    background: #ef4444;
  }

  .submit-dare.submitted {
    border-color: #22c55e;
    background: #22c55e;
    color: #0f0f0f;
  }

  button:disabled {
    opacity: 0.45;
  }

  .list-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dare-list,
  .compact-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dare-card.active {
    border-color: rgba(34, 197, 94, 0.6);
  }

  .points-badge {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .vote-count {
    color: #9ca3af;
    font-size: 12px;
  }

  .dare-text {
    color: #f9fafb;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    margin: 10px 0 0;
  }

  .vote-btn {
    width: 100%;
    margin-top: 12px;
    border-color: #ef4444;
    color: #ef4444;
  }

  .compact-list li {
    min-height: 44px;
    border: 1px solid #4a4a4c;
    border-radius: 8px;
    padding: 8px 12px;
    background: #242426;
  }

  .compact-list span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f9fafb;
  }

  .compact-list strong {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
  }
</style>
