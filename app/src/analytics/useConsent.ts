import { useEffect, useState } from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { createConsentStore, CONSENT_KEY, type ConsentStatus, type ConsentStore } from './consent'

// Client-only analytics-consent hook. Mounted-gate: returns 'unset' on the server and
// first paint (so SSR HTML matches — no hydration mismatch), then the real stored value
// after mount. A module-shared singleton store keeps the banner and the analytics mount
// in sync. Granting loads GA immediately; GA is never loaded before a grant (Basic
// Consent Mode → zero collection on decline). Mirrors useRemoteConfig / useEngagement.

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
    const update = () => setStatus(s.get())
    update() // adopt the stored choice after mount
    const unsub = s.subscribe(update)
    if (s.get() === 'granted') void loadGtagClient() // returning granted visitor → load GA
    return unsub
  }, [])

  const accept = () => {
    const s = getStore()
    if (!s) return
    s.set('granted')
    void loadGtagClient() // load GA now, in-session
  }
  const decline = () => getStore()?.set('denied')

  return { status, accept, decline }
}
