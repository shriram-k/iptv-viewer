// Browser-ONLY GA4 loader (thin gtag.js shim). Reached SOLELY via `await import()`
// from Analytics.client.tsx, never statically imported by SSR-evaluated code, so it
// stays out of the Cloudflare worker bundle. (A build check greps dist/server.)
//
// Basic Consent Mode: loadGtag() is called ONLY after the visitor grants consent, so
// GA never loads before a grant → zero collection on decline (origin R4/AE2). We own
// consent via gtag primitives (not firebase/analytics, whose setConsent is update-only
// and no-ops post-init). `track()` no-ops until GA is loaded, so instrumentation code
// can call it freely without consent guards.
//
// VITE_GA4_MEASUREMENT_ID is PUBLIC client config (like VITE_FIREBASE_*), not a secret.
// Absent → loadGtag() and track() are inert (analytics fully off).

const SCRIPT_ID = 'ga-gtag' // presence in <head> makes loadGtag idempotent

type GtagWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

/** Load GA4 + register consent=granted. Idempotent, no-op on server or without an id. */
export function loadGtag(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const id = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined
  if (!id) return // no measurement id → analytics off
  if (document.getElementById(SCRIPT_ID)) return // already loaded

  const w = window as GtagWindow
  w.dataLayer = w.dataLayer || []
  // Canonical gtag shim — must forward the `arguments` object (not a spread array),
  // which is how gtag.js consumes consent/config commands.
  function gtag() {
    w.dataLayer!.push(arguments)
  }
  w.gtag = gtag as (...args: unknown[]) => void

  // We only reach here post-grant, so analytics is granted; ad_* stay denied forever
  // (analytics-only site — never granted).
  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  w.gtag('js', new Date())
  w.gtag('config', id, { send_page_view: false }) // SPA: page_view sent manually (usePageViews)

  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s)
}

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
