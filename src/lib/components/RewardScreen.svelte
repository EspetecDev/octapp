<script lang="ts">
  import type { Chapter } from "$lib/types.ts";

  let {
    chapter,
    activeChapterIndex,
    chapters,
  }: {
    chapter: Chapter;
    activeChapterIndex: number;
    chapters: Chapter[];
  } = $props();

  // Past rewards: all chapters before the current one that have scavengerDone = true
  let pastRewards = $derived(
    chapters
      .slice(0, activeChapterIndex)
      .filter(ch => ch.scavengerDone)
  );

  // Accordion state — track which past reward is open
  let openIndex = $state<number | null>(null);

  function toggleAccordion(idx: number) {
    openIndex = openIndex === idx ? null : idx;
  }
</script>

<div class="reward-screen">
  <!-- Current reward reveal (D-24, RWRD-02) -->
  <div class="reward-section">
    <p class="reward-label">REWARD UNLOCKED</p>
    <p class="chapter-name">Chapter {activeChapterIndex + 1}</p>
    <div class="reward-card">
      <p class="reward-text">{chapter.reward}</p>
    </div>
  </div>

  <!-- Past rewards accordion (D-25, RWRD-03) — only when activeChapterIndex > 0 -->
  {#if activeChapterIndex > 0 && pastRewards.length > 0}
    <div class="past-section">
      <p class="section-label">Past Rewards</p>
      <div class="accordion">
        {#each pastRewards as pastChapter, i}
          <div class="accordion-item">
            <button
              class="accordion-trigger"
              onclick={() => toggleAccordion(i)}
              aria-expanded={openIndex === i}
            >
              Chapter {i + 1}: {pastChapter.name}
              <span class="accordion-arrow" class:open={openIndex === i}>▼</span>
            </button>
            <div class="accordion-content" class:open={openIndex === i}>
              <p class="accordion-text">{pastChapter.reward}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .reward-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100dvh;
    padding: 48px 16px; /* py-2xl px-md */
    gap: 32px; /* gap-xl */
    background: #0f0f0f;
  }

  .reward-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .reward-label {
    font-size: 14px;
    font-weight: 400;
    color: #9ca3af;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  .chapter-name {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }

  /* "Drop the mic" reward card with glow (UI-SPEC) */
  .reward-card {
    background: #1c1c1e;
    border: 1px solid #f59e0b; /* accent border */
    border-radius: 16px;
    padding: 32px; /* p-xl */
    width: 100%;
    box-shadow: 0 0 24px rgba(245, 158, 11, 0.3); /* glow effect */
  }

  .reward-text {
    font-size: 24px;
    font-weight: 700;
    color: #f59e0b; /* --color-accent-groom */
    text-align: center;
    line-height: 1.3;
    margin: 0;
  }

  /* Past rewards accordion */
  .past-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 14px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 8px;
  }

  .accordion {
    display: flex;
    flex-direction: column;
  }

  .accordion-item {
    border-bottom: 1px solid #2d2d2f;
  }

  .accordion-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 0;
    background: transparent;
    border: none;
    color: #f9fafb;
    font-size: 16px;
    font-weight: 400;
    cursor: pointer;
    text-align: left;
  }

  .accordion-arrow {
    font-size: 12px;
    color: #9ca3af;
    transition: transform 200ms ease;
    display: inline-block;
  }
  .accordion-arrow.open {
    transform: rotate(180deg);
  }

  .accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 200ms ease; /* UI-SPEC: 200ms ease for accordion */
  }
  .accordion-content.open {
    max-height: 200px; /* generous cap — reward text is short */
  }

  .accordion-text {
    font-size: 14px;
    color: #9ca3af;
    padding: 0 0 12px;
    margin: 0;
  }
</style>
