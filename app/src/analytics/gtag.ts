// GA4 emit side — SSR-safe and inert until GA is loaded. `track()` is called from
// instrumentation in SSR-reachable components (Player, routes), so this module must
// be safe to import anywhere: it touches `window.gtag` only inside guarded functions
// and never loads the GA script itself. The script injection lives in the client-only
// gtag.client.ts (dynamic-imported from useConsent), so the googletagmanager URL never
// enters the SSR worker bundle.
//
// gtag.client.ts (loadGtag) and this module communicate via the global `window.gtag`
// that loadGtag installs — not via imports — so the load path stays isolated.

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

/** True once GA has been loaded (consent granted + a measurement id present). */
export function isGtagLoaded(): boolean {
  return typeof window !== 'undefined' && typeof (window as GtagWindow).gtag === 'function'
}

/** Emit a GA4 event. No-op until GA is loaded (i.e. before consent) — safe to call anywhere. */
export function track(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const gtag = (window as GtagWindow).gtag
  if (typeof gtag !== 'function') return // not loaded (no consent / no id) → inert
  gtag('event', name, params)
}
