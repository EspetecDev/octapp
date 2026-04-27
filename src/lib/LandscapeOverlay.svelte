<!-- Pure CSS landscape overlay — no JS required (MOBX-04, RESEARCH.md Pattern 6) -->
<!-- This element is always in the DOM; the @media query toggles display -->

<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
</script>

<div class="landscape-overlay" aria-hidden="true">
  <!-- Inline SVG: rotate phone icon, 48px, #9ca3af color -->
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Phone body rotated 90deg -->
    <rect x="14" y="8" width="20" height="32" rx="3" stroke="#9ca3af" stroke-width="2.5" fill="none" transform="rotate(90 24 24)" />
    <!-- Rotation arrow -->
    <path
      d="M8 16 A16 16 0 0 1 24 8"
      stroke="#9ca3af"
      stroke-width="2.5"
      stroke-linecap="round"
      fill="none"
    />
    <polyline points="24,4 24,10 30,7" fill="#9ca3af" stroke="none" />
  </svg>
  <h2>{m.landscape_heading()}</h2>
  <p>{m.landscape_body()}</p>
</div>

<style>
  .landscape-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 200;
    background: #0f0f0f;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    text-align: center;
    padding: 32px;
  }
  @media (orientation: landscape) {
    .landscape-overlay {
      display: flex;
    }
  }
  h2 {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }
  p {
    font-size: 16px;
    color: #9ca3af;
    margin: 0;
  }
</style>
