/**
 * Service worker registration — calls the virtual module that
 * `vite-plugin-pwa` injects at build time.
 *
 * During `vite dev` the plugin resolves `virtual:pwa-register` to an
 * inert shim (PWA is disabled in dev by default). In production this
 * registers the SW and wires the `updated` callback so we can prompt
 * the user when a fresh build is available.
 *
 * We auto-update silently: when a new SW activates the plugin's
 * generated `registerSW({ immediate: true })` takes the new bundle on
 * the next reload, which happens seamlessly as users switch tabs.
 */

// The virtual-module path is provided by vite-plugin-pwa; TS picks it
// up via the `vite-plugin-pwa/client` ambient types referenced in
// `src/vite-env.d.ts`.
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, _registration) {
    // Noop — telemetry hook for future use.
  },
  onNeedRefresh() {
    // A fresh build is waiting. Auto-refresh on the next idle navigation
    // so the user never has to click anything; this is safe because
    // our store state is either in-URL (share links) or explicitly
    // client-owned (MockChain), and both are rebuildable on reload.
    void updateSW();
  },
  onOfflineReady() {
    // Could surface a toast: "Ready to work offline".
  },
});
