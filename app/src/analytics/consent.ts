// Device-local analytics-consent store. Deny-by-default: analytics is off until the
// visitor explicitly grants (Basic Consent Mode — GA is never loaded before a grant,
// so declining/ignoring means zero collection, honoring origin AE2). Pure logic over
// an injectable Storage so it's unit-testable; the client hook (useConsent) is a thin
// mounted-gate wrapper over a singleton against window.localStorage.
//
// In-memory-backed + subscribe/emit (localStorage doesn't notify same-tab listeners);
// cross-tab changes come in via the `storage` event → syncFromStorage(). Mirrors
// src/lib/engagement.ts.

const CONSENT_KEY = 'ftv:consent:v1' // versioned so a future shape change resets cleanly

export type ConsentStatus = 'unset' | 'granted' | 'denied'

/** Read the stored choice, tolerating absent/unknown/broken values (→ 'unset'). */
function read(storage: Storage): ConsentStatus {
  try {
    const raw = storage.getItem(CONSENT_KEY)
    return raw === 'granted' || raw === 'denied' ? raw : 'unset'
  } catch {
    return 'unset'
  }
}

export interface ConsentStore {
  get(): ConsentStatus
  set(value: 'granted' | 'denied'): void
  /** Re-seed from storage (for the cross-tab `storage` event). */
  syncFromStorage(): void
  subscribe(fn: () => void): () => void
}

/** Create a consent store over the given Storage (window.localStorage in the app). */
export function createConsentStore(storage: Storage): ConsentStore {
  const listeners = new Set<() => void>()
  let status = read(storage)
  const emit = () => listeners.forEach((fn) => fn())

  return {
    get: () => status,
    set(value) {
      status = value
      try {
        storage.setItem(CONSENT_KEY, value)
      } catch {
        /* quota / disabled storage — the in-memory value still holds for the session */
      }
      emit()
    },
    syncFromStorage() {
      status = read(storage)
      emit()
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
