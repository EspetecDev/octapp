<script lang="ts">
  import { gameState, sendMessage } from "$lib/socket.ts";
  import type { Chapter } from "$lib/types.ts";

  let { chapter }: { chapter: Chapter } = $props();

  // Track whether hint has been requested (show hint text after STATE_SYNC acknowledges)
  // Hint text is already in chapter.scavengerHint — shown when hintRequested is true
  // and chapter.scavengerHint is non-empty (D-22, D-23)
  let hintRequested = $state(false);

  function requestHint() {
    hintRequested = true;
    sendMessage({ type: "HINT_REQUEST" });
  }

  function foundIt() {
    sendMessage({ type: "SCAVENGER_DONE" });
  }

  // Hint button only visible if chapter has a hint configured (D-23)
  let hasHint = $derived(!!chapter.scavengerHint && chapter.scavengerHint.trim().length > 0);
</script>

<div class="scavenger-screen">
  <!-- Top section: clue -->
  <div class="top-section">
    <p class="section-label">SCAVENGER CLUE</p>
    <div class="clue-card">
      <p class="clue-text">{chapter.scavengerClue}</p>
    </div>
  </div>

  <!-- Middle section: hint (only if configured) -->
  {#if hasHint}
    <div class="hint-section">
      {#if !hintRequested}
        <button class="hint-btn" onclick={requestHint}>
          Request Hint (−10 pts)
        </button>
      {:else}
        <p class="hint-label">HINT</p>
        <div class="hint-card">
          <p class="hint-text">{chapter.scavengerHint}</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Bottom section: CTA -->
  <div class="bottom-section">
    <button class="found-btn" onclick={foundIt}>
      I Found It!
    </button>
  </div>
</div>

<style>
  .scavenger-screen {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding: 48px 16px; /* py-2xl px-md */
    gap: 32px; /* gap-xl */
    justify-content: space-between;
    background: #0f0f0f;
  }

  .top-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-label {
    font-size: 14px;
    font-weight: 400;
    color: #9ca3af;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  .clue-card {
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 16px; /* rounded-2xl */
    padding: 24px; /* p-lg */
  }

  .clue-text {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    line-height: 1.3;
    text-align: center;
    margin: 0;
  }

  .hint-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hint-btn {
    width: 100%;
    min-height: 48px;
    background: transparent;
    border: 1px solid #4a4a4c;
    border-radius: 12px;
    color: #9ca3af;
    font-size: 16px;
    font-weight: 400;
    cursor: pointer;
    transition: border-color 100ms, color 100ms, transform 100ms;
  }
  .hint-btn:active {
    border-color: #f9fafb;
    color: #f9fafb;
    transform: scale(0.98);
  }

  .hint-label {
    font-size: 14px;
    color: #9ca3af;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  .hint-card {
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 12px;
    padding: 16px; /* p-md */
  }

  .hint-text {
    font-size: 16px;
    color: #f9fafb;
    margin: 0;
  }

  .bottom-section {
    display: flex;
    flex-direction: column;
  }

  .found-btn {
    width: 100%;
    min-height: 56px;
    background: #f59e0b; /* --color-accent-groom */
    color: #0f0f0f;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: opacity 100ms, transform 100ms;
  }
  .found-btn:active {
    opacity: 0.8;
    transform: scale(0.98);
  }
</style>
