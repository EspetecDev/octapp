// Disable SSR for entire app — all routes use browser APIs (WebSocket, navigator, DeviceMotion)
// Source: MOBX-05, RESEARCH.md Pattern 4
export const ssr = false;
export const prerender = false;
