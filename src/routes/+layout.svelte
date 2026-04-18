<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import ReconnectingOverlay from "$lib/ReconnectingOverlay.svelte";
  import LandscapeOverlay from "$lib/LandscapeOverlay.svelte";
  import { createSocket, destroySocket } from "$lib/socket.ts";
  import { initLocale } from "$lib/i18n/locale.svelte.ts";

  onMount(() => {
    initLocale();   // INFRA-03, INFRA-04: reads window.__initialLocale → sets paraglide locale → $state syncs
    createSocket();
  });

  onDestroy(() => {
    destroySocket();
  });
</script>

<!-- Overlays sit above all page content at all times -->
<ReconnectingOverlay />
<LandscapeOverlay />

<!-- Page content -->
<slot />
