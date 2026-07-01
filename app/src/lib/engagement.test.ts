import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEngagement, MAX_HISTORY } from './engagement'

// A minimal in-memory Storage double.
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
  }
}

describe('engagement store — favorites', () => {
  let store: ReturnType<typeof createEngagement>
  beforeEach(() => {
    store = createEngagement(fakeStorage())
  })

  it('toggles a favorite on and off', () => {
    expect(store.isFavorite('a')).toBe(false)
    store.toggleFavorite('a')
    expect(store.isFavorite('a')).toBe(true)
    store.toggleFavorite('a')
    expect(store.isFavorite('a')).toBe(false)
  })

  it('lists favorites in insertion order', () => {
    store.toggleFavorite('a')
    store.toggleFavorite('b')
    store.toggleFavorite('c')
    expect(store.listFavorites()).toEqual(['a', 'b', 'c'])
  })

  it('persists across a fresh store over the same storage (reload)', () => {
    const backing = fakeStorage()
    createEngagement(backing).toggleFavorite('x')
    expect(createEngagement(backing).isFavorite('x')).toBe(true)
  })

  it('empty/absent storage → no favorites (cleared = normal empty)', () => {
    expect(store.listFavorites()).toEqual([])
  })
})

describe('engagement store — history', () => {
  let store: ReturnType<typeof createEngagement>
  beforeEach(() => {
    store = createEngagement(fakeStorage())
  })

  it('records watched, most-recent first', () => {
    store.recordWatched('a')
    store.recordWatched('b')
    expect(store.listHistory()).toEqual(['b', 'a'])
  })

  it('dedupes: re-watching moves an id to the front', () => {
    store.recordWatched('a')
    store.recordWatched('b')
    store.recordWatched('a')
    expect(store.listHistory()).toEqual(['a', 'b'])
  })

  it(`caps history at ${MAX_HISTORY}`, () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) store.recordWatched(`c${i}`)
    const hist = store.listHistory()
    expect(hist).toHaveLength(MAX_HISTORY)
    expect(hist[0]).toBe(`c${MAX_HISTORY + 4}`) // newest
    expect(hist).not.toContain('c0') // oldest dropped
  })
})

describe('engagement store — resilience & reactivity', () => {
  it('malformed JSON in a key is treated as empty, never throws', () => {
    const backing = fakeStorage()
    backing.setItem('ftv:fav:v1', '{not json')
    const store = createEngagement(backing)
    expect(store.listFavorites()).toEqual([])
    expect(() => store.toggleFavorite('a')).not.toThrow()
  })

  it('notifies subscribers on every mutation (same-tab reactivity)', () => {
    const store = createEngagement(fakeStorage())
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    store.toggleFavorite('a')
    store.recordWatched('b')
    expect(fn).toHaveBeenCalledTimes(2)
    unsub()
    store.toggleFavorite('c')
    expect(fn).toHaveBeenCalledTimes(2) // no longer notified
  })

  it('favoriting still works in-session when persistence throws (private mode / quota)', () => {
    const throwing: Storage = { ...fakeStorage(), setItem: () => { throw new Error('QuotaExceeded') } }
    const store = createEngagement(throwing)
    expect(() => store.toggleFavorite('a')).not.toThrow()
    expect(store.isFavorite('a')).toBe(true) // in-memory value holds despite the failed write
  })

  it('syncFromStorage re-seeds in-memory lists (cross-tab change) and notifies', () => {
    const backing = fakeStorage()
    const store = createEngagement(backing)
    const fn = vi.fn()
    store.subscribe(fn)
    backing.setItem('ftv:fav:v1', JSON.stringify(['other-tab'])) // another tab wrote
    store.syncFromStorage()
    expect(store.listFavorites()).toEqual(['other-tab'])
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
