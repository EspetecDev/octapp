// Sensor normalization scaffold — TECH-05
// Phase 1: define types and normalization function stubs.
// Phase 3: implement the tilt/balance minigame using these.
//
// iOS DeviceMotion reports acceleration in m/s²; Android is the same.
// iOS uses a different axis orientation than Android for some events.
// Normalization ensures consistent x/y/z semantics regardless of platform.

export type SensorReading = {
  /** Normalized: positive x = tilt right, negative x = tilt left */
  x: number;
  /** Normalized: positive y = tilt forward, negative y = tilt backward */
  y: number;
  /** Normalized: positive z = face-up, negative z = face-down */
  z: number;
  /** Source platform detected at runtime */
  platform: "ios" | "android" | "unknown";
};

/**
 * Detect iOS — affects DeviceMotion axis polarity.
 * Must be called inside onMount (browser context only).
 */
export function detectPlatform(): "ios" | "android" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "unknown";
}

/**
 * Normalize a raw DeviceMotionEvent into a consistent SensorReading.
 * iOS polarity inversion: iOS DeviceMotion x/y axes are inverted relative to Android.
 *
 * Phase 3 will call this inside a devicemotion event listener.
 */
export function normalizeSensorData(
  event: DeviceMotionEvent,
  platform: "ios" | "android" | "unknown"
): SensorReading {
  const accel = event.accelerationIncludingGravity;
  const rawX = accel?.x ?? 0;
  const rawY = accel?.y ?? 0;
  const rawZ = accel?.z ?? 0;

  // iOS inverts x and y compared to Android (empirically observed, not spec-defined)
  const iosMultiplier = platform === "ios" ? -1 : 1;

  return {
    x: rawX * iosMultiplier,
    y: rawY * iosMultiplier,
    z: rawZ,
    platform,
  };
}
