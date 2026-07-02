import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createConsentStore } from './consent'

beforeEach(() => localStorage.clear())

describe('createConsentStore', () => {
  it('defaults to "unset" when nothing is stored', () => {
    expect(createConsentStore(localStorage).get()).toBe('unset')
  })

  it('persists and reports a granted/denied choice, notifying subscribers', () => {
    const store = createConsentStore(localStorage)
    const sub = vi.fn()
    store.subscribe(sub)

    store.set('granted')
    expect(store.get()).toBe('granted')
    expect(localStorage.getItem('ftv:consent:v1')).toBe('granted')
    expect(sub).toHaveBeenCalledTimes(1)

    store.set('denied')
    expect(store.get()).toBe('denied')
    expect(sub).toHaveBeenCalledTimes(2)
  })

  it('seeds from an existing stored value', () => {
    localStorage.setItem('ftv:consent:v1', 'denied')
    expect(createConsentStore(localStorage).get()).toBe('denied')
  })

  it('treats an unknown/garbage stored value as "unset"', () => {
    localStorage.setItem('ftv:consent:v1', 'maybe')
    expect(createConsentStore(localStorage).get()).toBe('unset')
  })

  it('syncFromStorage re-reads (cross-tab) and notifies', () => {
    const store = createConsentStore(localStorage)
    const sub = vi.fn()
    store.subscribe(sub)
    localStorage.setItem('ftv:consent:v1', 'granted') // another tab
    store.syncFromStorage()
    expect(store.get()).toBe('granted')
    expect(sub).toHaveBeenCalledTimes(1)
  })

  it('tolerates a throwing Storage (private mode) without crashing', () => {
    const throwing: Storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    }
    const store = createConsentStore(throwing)
    expect(store.get()).toBe('unset')
    expect(() => store.set('granted')).not.toThrow()
    expect(store.get()).toBe('granted') // in-memory holds for the session
  })
})
