<script lang="ts">
  import { onMount } from "svelte";
  import { sendMessage, lastEffect } from "$lib/socket.ts";
  import type { EffectActivatedPayload } from "$lib/socket.ts";
  import { normalizeSensorData, detectPlatform } from "$lib/sensors.ts";
  import RadialCountdown from "./RadialCountdown.svelte";
  import type { Chapter } from "$lib/types.ts";

  let { chapter }: { chapter: Chapter } = $props();

  let platform = $state<"ios" | "android" | "unknown">("unknown");
  let sensorPermission = $state<"pending" | "granted" | "denied" | "not-required">("pending");
  let meterFill = $state(0);   // 0–1
  let resultState = $state<"win" | "loss" | null>(null);
  let timerRunning = $state(false);

  // Distraction overlay state (D-12)
  let showDistraction = $state(false);
  let distractionKey = $state(0);

  // Effect handler — distraction only for sensor minigame (no timer delta, no scramble)
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

  onMount(() => {
    platform = detectPlatform();
    if (platform !== "ios") {
      // Android / desktop — no permission gate needed (D-11)
      sensorPermission = "not-required";
      timerRunning = true;
    }
  });

  // Called ONLY from button onclick — iOS 13+ requires user gesture (Pitfall 1)
  async function handleEnableTap() {
    const DevMot = DeviceMotionEvent as any;
    if (typeof DevMot.requestPermission === "function") {
      try {
        const result = await DevMot.requestPermission();
        sensorPermission = result === "granted" ? "granted" : "denied";
      } catch {
        sensorPermission = "denied";
      }
    } else {
      sensorPermission = "not-required";
    }
    if (sensorPermission === "granted" || sensorPermission === "not-required") {
      timerRunning = true;
    }
  }

  // Start sensor loop AFTER permission granted (D-10, Pitfall 5 cleanup)
  $effect(() => {
    if (sensorPermission !== "granted" && sensorPermission !== "not-required") return;
    if (resultState !== null) return; // don't restart after result

    const handler = (event: DeviceMotionEvent) => {
      if (resultState !== null) return;
      const reading = normalizeSensorData(event, platform);
      // x ranges approx -9.8 to +9.8 (m/s² gravity)
      // tilt-right = positive x; normalize to 0–1 clamped (D-08, D-09)
      const normalized = Math.max(0, Math.min(1, (reading.x + 9.8) / 9.8));
      meterFill = normalized;
      if (normalized >= 0.8) {
        // Win immediately when ≥80% (D-09)
        window.removeEventListener("devicemotion", handler);
        triggerResult("win");
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler); // Pitfall 5 cleanup
  });

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

<div class="sensor-screen">
  {#if sensorPermission === "pending" && platform === "ios"}
    <!-- Permission gate (MINI-07, D-11, UI-SPEC) -->
    <div class="gate-content" role="dialog" aria-label="Sensor permission required">
      <h1 class="gate-heading">Motion Access Needed</h1>
      <p class="gate-body">Tap the button below to enable the tilt sensor.</p>
      <button class="enable-btn" onclick={handleEnableTap}>
        Enable Sensor
      </button>
    </div>

  {:else if sensorPermission === "denied"}
    <!-- Permission denied state -->
    <div class="gate-content">
      <h1 class="gate-heading">Sensor Unavailable</h1>
      <p class="gate-body">Motion access was denied. Ask someone nearby for help.</p>
    </div>

  {:else}
    <!-- Active sensor challenge -->
    {#if timerRunning}
      <RadialCountdown duration={30} onExpire={handleTimerExpire} />
    {/if}

    <p class="tilt-hint">Tilt RIGHT to fill the bar</p>

    <!-- Vertical meter container -->
    <div class="meter-container" aria-label="Tilt meter" role="progressbar" aria-valuenow={Math.round(meterFill * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div class="meter-fill" style="height: {meterFill * 100}%;"></div>
      <!-- 80% target line -->
      <div class="meter-target" style="bottom: 80%;" aria-hidden="true">
        <span class="meter-target-label">GOAL</span>
      </div>
    </div>

    <!-- Percentage readout -->
    <p class="meter-pct">{Math.round(meterFill * 100)}%</p>
  {/if}

  <!-- Win/Loss overlay — shared pattern (D-18) -->
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
  .sensor-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100dvh;
    padding: 32px 16px;
    gap: 32px; /* gap-xl */
    position: relative;
    background: #0f0f0f;
  }

  /* Permission gate */
  .gate-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 100dvh;
    padding: 32px;
    text-align: center;
  }
  .gate-heading {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }
  .gate-body {
    font-size: 16px;
    color: #9ca3af;
    margin: 0;
  }
  .enable-btn {
    width: 100%;
    min-height: 56px;
    background: #f59e0b;
    color: #0f0f0f;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: opacity 100ms, transform 100ms;
  }
  .enable-btn:active { opacity: 0.8; transform: scale(0.98); }

  /* Active sensor */
  .tilt-hint {
    font-size: 14px;
    color: #9ca3af;
    margin: 0;
  }

  .meter-container {
    position: relative;
    height: 240px;
    width: 48px;
    background: #242426;
    border: 1px solid #4a4a4c;
    border-radius: 9999px;
    overflow: hidden;
  }
  .meter-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #f59e0b;
    border-radius: inherit;
    transition: height 80ms linear; /* Claude's Discretion: 80ms linear from UI-SPEC */
  }
  .meter-target {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    border-top: 2px dashed rgba(245,158,11,0.5);
  }
  .meter-target-label {
    position: absolute;
    right: -36px;
    top: -8px;
    font-size: 14px;
    color: rgba(245,158,11,0.7);
    white-space: nowrap;
  }
  .meter-pct {
    font-size: 40px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }

  /* Result overlay (shared pattern) */
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

  /* Confetti (shared pattern) */
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
