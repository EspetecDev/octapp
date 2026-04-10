<script lang="ts">
  import { sendMessage, lastEffect } from "$lib/socket.ts";
  import type { EffectActivatedPayload } from "$lib/socket.ts";
  import RadialCountdown from "./RadialCountdown.svelte";

  // Internal card type
  type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

  const EMOJI_SET = ["🍻", "👑", "💀", "🥳", "💍", "🎶"];

  function shuffleCards(): Card[] {
    const deck = [...EMOJI_SET, ...EMOJI_SET].map((emoji, id) => ({
      id,
      emoji,
      flipped: false,
      matched: false,
    }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  let cards = $state<Card[]>(shuffleCards());
  let flippedIndices = $state<number[]>([]);
  let lockBoard = $state(false);
  let resultState = $state<"win" | "loss" | null>(null);

  // Distraction overlay state (D-12)
  let showDistraction = $state(false);
  let distractionKey = $state(0);

  // Effect handler — distraction only for memory minigame (no timer delta, no scramble)
  $effect(() => {
    const effect = $lastEffect;
    if (!effect) return;
    if (effect.effectType === "distraction") {
      distractionKey += 1;
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

  function flipCard(index: number) {
    if (lockBoard || cards[index].flipped || cards[index].matched) return;
    if (resultState !== null) return;

    // Immutable replacement (Pitfall 2: no direct mutation)
    cards = cards.map((c, i) => i === index ? { ...c, flipped: true } : c);
    const newFlipped = [...flippedIndices, index];
    flippedIndices = newFlipped;

    if (newFlipped.length === 2) {
      // Set lock synchronously before any async work (Pitfall 8 guard)
      lockBoard = true;
      const [a, b] = newFlipped;
      if (cards[a].emoji === cards[b].emoji) {
        // Match — mark both matched
        cards = cards.map((c, i) =>
          i === a || i === b ? { ...c, matched: true } : c
        );
        flippedIndices = [];
        lockBoard = false;
        // Check win condition
        if (cards.every(c => c.matched)) {
          triggerResult("win");
        }
      } else {
        // No match — flip back after 800ms
        setTimeout(() => {
          cards = cards.map((c, i) =>
            i === a || i === b ? { ...c, flipped: false } : c
          );
          flippedIndices = [];
          lockBoard = false;
        }, 800);
      }
    }
  }

  function handleTimerExpire() {
    if (resultState !== null) return;
    triggerResult("loss");
  }

  function triggerResult(outcome: "win" | "loss") {
    resultState = outcome;
    if ("vibrate" in navigator) {
      navigator.vibrate(outcome === "win" ? 200 : [100, 50, 100]);
    }
    setTimeout(() => {
      sendMessage({ type: "MINIGAME_COMPLETE", result: outcome });
      resultState = null;
    }, 2000);
  }
</script>

<div class="memory-screen">
  <!-- 30s countdown (D-16) -->
  <RadialCountdown duration={30} onExpire={handleTimerExpire} />

  <!-- 4×3 card grid (D-15) -->
  <div
    class="card-grid"
    role="grid"
    aria-label="Memory card grid"
  >
    {#each cards as card, i (card.id)}
      <div
        class="card-outer"
        role="gridcell"
        onclick={() => flipCard(i)}
        onkeydown={(e) => e.key === "Enter" && flipCard(i)}
        tabindex="0"
        aria-label="Card {i + 1}{card.matched ? ', matched' : ''}"
      >
        <div class="card-inner" class:flipped={card.flipped || card.matched} class:matched={card.matched}>
          <!-- Face-down (front) -->
          <div class="card-face card-front" aria-hidden="true">?</div>
          <!-- Face-up (back) -->
          <div class="card-face card-back" aria-hidden="true">{card.emoji}</div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Win/Loss overlay (D-18) -->
  <div
    class="result-overlay"
    class:visible={resultState !== null}
    style="background: {resultState === 'win' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};"
    role="status"
    aria-live="polite"
  >
    <p class="result-heading" style="color: {resultState === 'win' ? '#f59e0b' : '#ef4444'};">
      {resultState === "win" ? "NAILED IT!" : "TIME'S UP!"}
    </p>
    <p class="result-points" style="color: {resultState === 'win' ? '#22c55e' : '#ef4444'};">
      {resultState === "win" ? "+50 pts" : "−20 pts"}
    </p>
  </div>

  <!-- Confetti (win only) -->
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

  <!-- Distraction overlay — emoji storm (D-12) -->
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
</div>

<style>
  .memory-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100dvh;
    padding: 32px 16px;
    gap: 16px;
    position: relative;
    background: #0f0f0f;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
  }

  .card-outer {
    aspect-ratio: 1;
    perspective: 600px;
    cursor: pointer;
    min-width: 64px;
    min-height: 64px;
  }
  .card-outer:active .card-inner {
    transform: scale(0.95);
  }

  .card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 300ms ease;
  }
  .card-inner.flipped {
    transform: rotateY(180deg);
  }

  .card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 28px;
  }

  .card-front {
    background: #242426;
    border: 2px solid #4a4a4c;
    color: #9ca3af;
    font-size: 20px;
  }

  .card-back {
    background: #242426;
    border: 2px solid #f59e0b;
    transform: rotateY(180deg);
  }

  .card-inner.matched .card-back {
    border-color: #22c55e;
    opacity: 0.6;
  }

  /* Result overlay */
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
    z-index: 49;
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
