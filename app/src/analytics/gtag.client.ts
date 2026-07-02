// Browser-ONLY GA4 script loader. Reached SOLELY via `await import()` from useConsent
// (createClientOnlyFn), never statically imported by SSR-evaluated code, so the GA
// script URL + load logic stay out of the Cloudflare worker bundle. (A build check
// greps dist/server for `googletagmanager`.)
//
// Basic Consent Mode: loadGtag() runs ONLY after the visitor grants consent, so GA
// never loads before a grant → zero collection on decline (origin R4/AE2). Consent is
// owned via gtag primitives (not firebase/analytics, whose setConsent is update-only).
// Installs the global window.gtag that gtag.ts's track() then uses.
//
// VITE_GA4_MEASUREMENT_ID is PUBLIC client config (like VITE_FIREBASE_*), not a secret.
// Absent → loadGtag() is inert (analytics fully off).

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
