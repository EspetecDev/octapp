<script lang="ts">
  import { sendMessage, lastEffect } from "$lib/socket.ts";
  import type { EffectActivatedPayload } from "$lib/socket.ts";
  import RadialCountdown from "./RadialCountdown.svelte";
  import type { Chapter, TriviaQuestion } from "$lib/types.ts";

  let { chapter }: { chapter: Chapter } = $props();

  // Derive the active question (D-12: drawn from triviaPool[servedQuestionIndex])
  let question = $derived<TriviaQuestion | null>(
    chapter.servedQuestionIndex != null
      ? (chapter.triviaPool[chapter.servedQuestionIndex] ?? null)
      : null
  );

  // shuffleSeed forces $derived re-evaluation on scramble_options effect (Pitfall 7)
  let shuffleSeed = $state(0);

  // Shuffle all 4 options; reads shuffleSeed as reactive dependency for forced re-shuffle
  let shuffledOptions = $derived<string[]>((() => {
    void shuffleSeed; // reactive dependency — forces re-evaluation when shuffleSeed increments
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

  // timerRemaining is bound to RadialCountdown so timer_add/timer_reduce effects can adjust it
  let timerRemaining = $state<number>(15);

  // Timer delta flash state (D-10)
  let showTimerFlash = $state(false);
  let timerFlashDelta = $state<number>(0);

  // Distraction overlay state (D-12)
  let showDistraction = $state(false);
  let distractionKey = $state(0);

  // Effect handler — responds to EFFECT_ACTIVATED for gameplay effects
  // Pitfall 5: announcement overlay is handled on groom page ONLY; minigame handles gameplay effects only
  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;

    if (effect.effectType === "timer_add" || effect.effectType === "timer_reduce") {
      const delta = effect.delta ?? (effect.effectType === "timer_add" ? 5 : -5);
      timerRemaining = Math.max(0, timerRemaining + delta); // Pitfall 2: clamp to 0
      timerFlashDelta = delta;
      showTimerFlash = true;
      setTimeout(() => { showTimerFlash = false; }, 1000);
    }

    if (effect.effectType === "scramble_options") {
      shuffleSeed += 1; // Pitfall 7: force $derived re-evaluation
    }

    if (effect.effectType === "distraction") {
      distractionKey += 1; // new key = destroy+remount emoji storm
      showDistraction = true;
      setTimeout(() => { showDistraction = false; }, 4000);
    }
  });

  const BACHELOR_EMOJIS = ["🍻", "👑", "💀", "🥳", "💍", "🎶"];
  function generateEmojiSpread() {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      emoji: BACHELOR_EMOJIS[i % BACHELOR_EMOJIS.length],
      x: Math.round(5 + Math.random() * 85),
      delay: Math.round(Math.random() * 1200),
      duration: Math.round(2800 + Math.random() * 1000),
    }));
  }

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
  <!-- Radial countdown (D-13: 15 seconds) — bind:remaining allows timer_add/timer_reduce effects to adjust it -->
  <RadialCountdown duration={15} bind:remaining={timerRemaining} onExpire={handleTimerExpire} />

  <!-- Timer delta flash (D-10, UI-SPEC TimerDeltaFlash) -->
  {#if showTimerFlash}
    <div class="timer-flash" style="color: {timerFlashDelta > 0 ? '#f59e0b' : '#ef4444'};">
      {timerFlashDelta > 0 ? '+' : ''}{timerFlashDelta}s
    </div>
  {/if}

  <!-- Distraction overlay — emoji storm (D-12, UI-SPEC DistractionOverlay) -->
  {#key distractionKey}
    {#if showDistraction}
      <div class="emoji-storm" aria-hidden="true">
        {#each generateEmojiSpread() as item (item.id)}
          <span
            class="emoji-float"
            style="left: {item.x}%; animation-delay: {item.delay}ms; animation-duration: {item.duration}ms;"
          >{item.emoji}</span>
        {/each}
      </div>
    {/if}
  {/key}

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
    background: #242426; /* --color-surface */
    border: 2px solid #4a4a4c; /* --color-border */
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

  /* Timer delta flash (D-10) */
  .timer-flash {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 700;
    animation: flashFade 1000ms ease forwards;
    pointer-events: none;
    z-index: 10;
  }
  @keyframes flashFade {
    0%   { opacity: 1; }
    20%  { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Distraction overlay — emoji storm (D-12) */
  .emoji-storm {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
    overflow: hidden;
  }
  .emoji-float {
    position: absolute;
    bottom: -40px;
    font-size: 32px;
    animation: floatUp ease-out forwards;
  }
  @keyframes floatUp {
    from { transform: translateY(0); opacity: 0.9; }
    to   { transform: translateY(-110vh); opacity: 0; }
  }
</style>
