# Milestones

## v1.1 Deployment & Testing (Shipped: 2026-04-13)

**Phases completed:** 7 phases, 27 plans, 25 tasks

**Key accomplishments:**

- SvelteKit 5 + Bun WebSocket server foundation — join by 6-char code, full real-time state sync, mobile-first Tailwind v4 design, Railway-compatible Dockerfile
- ReconnectingWebSocket with exponential-backoff + iOS heartbeat guard; game/connection Svelte stores; reconnecting overlay wired to root layout
- Admin pre-event setup (chapters, trivia, scavenger clues, rewards, power-up catalog) and live-night chapter control with recap card overlay on all devices
- Trivia, memory/matching, and sensor-based minigames for the groom — radial countdown, haptics, win/loss overlays; scavenger hunt flow + reward reveal
- Group token economy — earn button, context-filtered shop, power-ups and sabotages with live announcements to all players
- Railway production deploy — HTTPS, WebSocket confirmed, ADMIN_TOKEN secured; multi-device validation passed (admin + groom + party on real hardware); Android back button guard + server crash protection hardened

---
