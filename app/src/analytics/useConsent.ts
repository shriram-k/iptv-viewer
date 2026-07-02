import { useEffect, useState } from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { createConsentStore, CONSENT_KEY, type ConsentStatus, type ConsentStore } from './consent'
import { syncConsent, flushQueue } from './gtag'

// Client-only analytics-consent hook. Mounted-gate: returns 'unset' on the server and
// first paint (so SSR HTML matches — no hydration mismatch), then the real stored value
// after mount. A module-shared singleton store keeps the banner and the analytics mount
// in sync. Consent changes (this tab OR cross-tab) flow through applyConsent, which loads
// GA on grant (once) and tells a loaded GA to stop on revoke. GA is never loaded before a
// grant (Basic Consent Mode → zero collection on decline). Mirrors useRemoteConfig.

// createClientOnlyFn marks this browser-only: the GA-script loader (gtag.client) is
// reached solely via dynamic import here, so it never enters the SSR worker bundle.
const loadGtagClient = createClientOnlyFn(async () => {
  const { loadGtag } = await import('./gtag.client')
  loadGtag()
})

let store: ConsentStore | null = null
function getStore(): ConsentStore | null {
  if (typeof window === 'undefined') return null
  if (store) return store
  try {
    store = createConsentStore(window.localStorage)
    // App-lifetime cross-tab sync — added once, on the singleton's creation.
    window.addEventListener('storage', (e) => {
      if (e.key === CONSENT_KEY) store?.syncFromStorage()
    })
  } catch {
    store = null
  }
  return store
}

let loadStarted = false
/** React to a consent value: reflect it to a loaded GA, and on grant load GA once then
 *  flush events buffered while it loaded. Idempotent — safe to call on every emit. */
function applyConsent(status: ConsentStatus): void {
  syncConsent() // reflect to a loaded GA (grant/deny) + drop buffered events on revoke
  if (status !== 'granted') return
  if (loadStarted) {
    flushQueue()
    return
  }
  loadStarted = true
  void loadGtagClient().then(flushQueue) // load GA once, then replay buffered events
}

export interface UseConsent {
  status: ConsentStatus
  accept: () => void
  decline: () => void
}

export function useConsent(): UseConsent {
  const [status, setStatus] = useState<ConsentStatus>('unset')
  useEffect(() => {
    const s = getStore()
    if (!s) return
    const sync = () => {
      const st = s.get()
      setStatus(st)
      applyConsent(st) // grant (incl. returning + cross-tab) loads GA; revoke stops it
    }
    sync() // adopt the stored choice after mount
    return s.subscribe(sync)
  }, [])

  // accept/decline just persist; the subscribe→sync→applyConsent path does the loading.
  const accept = () => getStore()?.set('granted')
  const decline = () => getStore()?.set('denied')

  return { status, accept, decline }
}
