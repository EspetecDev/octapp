<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';

  let { duration, onExpire, remaining = $bindable(duration) }:
    { duration: number; onExpire: () => void; remaining?: number } = $props();
  const RADIUS = 45;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  $effect(() => {
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  let strokeColor = $derived(
    remaining > duration * 0.5 ? "#22c55e"
    : remaining > duration * 0.25 ? "#f59e0b"
    : "#ef4444"
  );
  let dashOffset = $derived(CIRCUMFERENCE * (1 - remaining / duration));
</script>

<svg viewBox="0 0 100 100" class="w-24 h-24" role="timer" aria-label={m.radial_aria_label({ remaining })}>
  <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#4a4a4c" stroke-width="8"/>
  <circle
    cx="50" cy="50" r={RADIUS}
    fill="none"
    stroke={strokeColor}
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={dashOffset}
    style="transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 1s linear, stroke 300ms ease;"
  />
  <text x="50" y="56" text-anchor="middle" fill="#f9fafb" font-size="24" font-weight="700">{remaining}</text>
</svg>
