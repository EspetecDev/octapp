<script lang="ts">
  import { sendMessage } from "$lib/socket.ts";
  import RadialCountdown from "./RadialCountdown.svelte";
  import type { Chapter, TriviaQuestion } from "$lib/types.ts";

  let { chapter }: { chapter: Chapter } = $props();

  // Derive the active question (D-12: drawn from triviaPool[servedQuestionIndex])
  let question = $derived<TriviaQuestion | null>(
    chapter.servedQuestionIndex != null
      ? (chapter.triviaPool[chapter.servedQuestionIndex] ?? null)
      : null
  );

  // Shuffle all 4 options once when the question is set (correctAnswer + 3 wrongOptions)
  let shuffledOptions = $derived<string[]>((() => {
    if (!question) return [];
    const opts = [question.correctAnswer, ...question.wrongOptions];
    // Fisher-Yates shuffle
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  })());

  let selectedOption = $state<string | null>(null);    // which option was tapped
  let resultState = $state<"win" | "loss" | null>(null);

  function handleOptionTap(option: string) {
    if (selectedOption !== null || resultState !== null) return; // locked after selection
    selectedOption = option;
    const outcome = option === question?.correctAnswer ? "win" : "loss";
    triggerResult(outcome);
  }

  function handleTimerExpire() {
    if (resultState !== null) return;
    triggerResult("loss");
  }

  function triggerResult(outcome: "win" | "loss") {
    resultState = outcome;
    // Haptic feedback (MINI-06, D-18)
    if ("vibrate" in navigator) {
      navigator.vibrate(outcome === "win" ? 200 : [100, 50, 100]);
    }
    // Auto-advance after 2s (D-18, D-20)
    setTimeout(() => {
      sendMessage({ type: "MINIGAME_COMPLETE", result: outcome });
      resultState = null;
    }, 2000);
  }
</script>

<div class="trivia-screen">
  <!-- Radial countdown (D-13: 15 seconds) -->
  <RadialCountdown duration={15} onExpire={handleTimerExpire} />

  <!-- Question text -->
  {#if question}
    <p class="question-text">{question.question}</p>

    <!-- 2×2 option grid -->
    <div class="options-grid" role="group" aria-label="Answer options">
      {#each shuffledOptions as option}
        <button
          class="option-btn"
          class:selected={selectedOption === option}
          disabled={selectedOption !== null}
          aria-pressed={selectedOption === option}
          onclick={() => handleOptionTap(option)}
        >
          {option}
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-base text-text-secondary text-center">Loading question...</p>
  {/if}

  <!-- Win/Loss result overlay (D-18) — always in DOM, .visible class toggles opacity -->
  <div
    class="result-overlay"
    class:visible={resultState !== null}
    style="background: {resultState === 'win' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};"
    role="status"
    aria-live="polite"
  >
    <p class="result-heading" style="color: {resultState === 'win' ? '#f59e0b' : '#ef4444'};">
      {resultState === "win" ? "CORRECT!" : "WRONG!"}
    </p>
    <p class="result-points" style="color: {resultState === 'win' ? '#22c55e' : '#ef4444'};">
      {resultState === "win" ? "+50 pts" : "−20 pts"}
    </p>
  </div>

  <!-- CSS confetti (win only) — 24 particles -->
  {#if resultState === "win"}
    <div class="confetti-container" aria-hidden="true">
      {#each Array(24) as _, i}
        <div
          class="confetti-piece"
          style="
            left: {Math.random() * 100}%;
            animation-delay: {Math.random() * 800}ms;
            animation-duration: {600 + Math.random() * 400}ms;
            background: {['#f59e0b','#22c55e','#ef4444','#f9fafb'][i % 4]};
          "
        ></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trivia-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100dvh;
    padding: 32px 16px; /* py-xl px-md */
    gap: 24px; /* gap-lg */
    position: relative;
    background: #0f0f0f;
  }

  .question-text {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    text-align: center;
    line-height: 1.3;
    margin: 0;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px; /* gap-sm */
    width: 100%;
  }

  .option-btn {
    min-height: 56px;
    background: #1c1c1e; /* --color-surface */
    border: 2px solid #2d2d2f; /* --color-border */
    border-radius: 12px; /* rounded-xl */
    color: #f9fafb;
    font-size: 16px;
    font-weight: 400;
    text-align: center;
    padding: 8px 16px;
    cursor: pointer;
    transition: transform 100ms ease, border-color 100ms;
  }
  .option-btn:active {
    transform: scale(0.98);
  }
  .option-btn.selected {
    border-color: #f59e0b; /* --color-accent-groom */
  }
  .option-btn:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Result overlay — same pattern as recap overlay */
  .result-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }
  .result-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .result-heading {
    font-size: 40px;
    font-weight: 700;
    text-align: center;
    margin: 0;
  }
  .result-points {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  /* Confetti */
  .confetti-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 49; /* below result overlay */
    overflow: hidden;
  }
  .confetti-piece {
    position: absolute;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 1px;
    animation: confettiFall linear forwards;
  }
  @keyframes confettiFall {
    from { transform: translateY(0); opacity: 1; }
    to   { transform: translateY(-60vh); opacity: 0; }
  }
</style>
