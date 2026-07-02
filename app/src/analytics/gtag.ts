// GA4 emit side — SSR-safe, gated on LIVE consent, and race-proof. `track()` is called
// from instrumentation in SSR-reachable components (Player, routes), so this module must
// be safe to import anywhere: it touches `window.gtag` only inside guarded functions and
// never loads the GA script (that lives in the client-only gtag.client.ts).
//
// Consent is read fresh from storage on every emit (the store writes localStorage
// synchronously), so a decline — including one made in another tab — stops emission
// immediately, and a grant takes effect without depending on React effect ordering.
// Events fired after a grant but before the async GA script installs are BUFFERED and
// replayed by flushQueue() once GA loads, so the landing page_view / early events aren't
// dropped. Before consent the queue is never touched → zero buffering, zero collection.

import { CONSENT_KEY } from './consent'

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

let queue: Array<[string, Record<string, unknown> | undefined]> = []

/** Live consent read — the store persists synchronously, so this reflects the current
 *  choice (this tab or another) with no cached state to go stale. */
function granted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(CONSENT_KEY) === 'granted'
  } catch {
    return false
  }
}

/** Reflect a consent change to an already-loaded GA and drop buffered events on revoke.
 *  Called by useConsent whenever the choice changes (this tab or cross-tab). */
export function syncConsent(): void {
  if (typeof window === 'undefined') return
  const on = granted()
  if (!on) queue = [] // revoked → discard anything buffered but not yet sent
  const gtag = (window as GtagWindow).gtag
  if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: on ? 'granted' : 'denied' })
}

/** Replay events buffered while GA was loading. Called once GA installs window.gtag. */
export function flushQueue(): void {
  if (typeof window === 'undefined' || !granted()) return
  const gtag = (window as GtagWindow).gtag
  if (typeof gtag !== 'function') return
  const pending = queue
  queue = []
  for (const [name, params] of pending) gtag('event', name, params)
}

/** Emit a GA4 event. No-op unless consent is granted; buffers until GA finishes loading. */
export function track(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !granted()) return
  const gtag = (window as GtagWindow).gtag
  if (typeof gtag === 'function') gtag('event', name, params)
  else queue.push([name, params]) // granted but script still loading → buffer for flushQueue
}
