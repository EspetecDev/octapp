// Wake Lock utility — MOBX-03
// Phase 1: define and export. Phase 3: call from active minigame routes.
// Source: RESEARCH.md Code Examples "Wake Lock Utility"
let lock: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator)) return; // unsupported (older browsers)
  try {
    lock = await navigator.wakeLock.request("screen");
  } catch {
    // Low battery or power save mode — fail silently
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (lock) {
    await lock.release();
    lock = null;
  }
}

// Re-acquire on tab visibility change — WakeLock is auto-released when tab backgrounds
// Phase 3 will add additional trigger points (minigame start/end)
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && lock !== null) {
      acquireWakeLock();
    }
  });
}
