<script lang="ts">
  import { connectionStatus } from "$lib/socket.ts";

  // Track previous state to control pointer-events during fade-out
  let visible = $derived($connectionStatus === "reconnecting");
</script>

<div
  class="overlay"
  class:visible
  aria-live="assertive"
  aria-label="Reconnecting to game"
>
  <div class="spinner" aria-hidden="true"></div>
  <h2 class="text-2xl font-bold text-text-primary">Reconnecting...</h2>
  <p class="text-base text-text-secondary text-center px-6">
    Hold tight — we'll get you back in the game.
  </p>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    height: 100dvh;
    background: rgba(28, 28, 30, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 100;
    opacity: 0;
    pointer-events: none;
    /* Fade out: 300ms ease-out (UI-SPEC) */
    transition: opacity 300ms cubic-bezier(0.0, 0.0, 0.2, 1);
  }
  .overlay.visible {
    opacity: 1;
    pointer-events: all;
    /* Fade in: 200ms ease-in (UI-SPEC) */
    transition: opacity 200ms ease-in;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #9ca3af;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
