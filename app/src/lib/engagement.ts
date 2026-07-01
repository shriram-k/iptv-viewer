// Device-local engagement store: favorites + recently-watched, in localStorage.
// No account, no network, no cloud user data (origin R1-R4). Pure logic over an
// injectable Storage so it's fully unit-testable; the client hooks (useEngagement)
// are thin mounted-gate wrappers over a singleton created against window.localStorage.
//
// In-memory-backed: the current lists are held in memory (seeded from storage) and
// written through best-effort. So toggling works within the session even when
// persistence fails (Safari private mode / quota / disabled storage) instead of
// silently reverting, and reads are cheap (no JSON.parse per subscriber).
// localStorage doesn't notify same-tab listeners, so we expose subscribe/emit;
// cross-tab changes come in via the `storage` event → syncFromStorage().

// Versioned keys so a future shape change resets cleanly instead of crashing on old data.
const FAV_KEY = 'ftv:fav:v1'
const HIST_KEY = 'ftv:hist:v1'
export const MAX_HISTORY = 12

/** Read a JSON string[] from a key, tolerating absent/malformed values (→ []). */
function readList(storage: Storage, key: string): string[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export interface Engagement {
  isFavorite(id: string): boolean
  toggleFavorite(id: string): void
  listFavorites(): string[]
  recordWatched(id: string): void
  listHistory(): string[]
  /** Re-seed the in-memory lists from storage (for the cross-tab `storage` event). */
  syncFromStorage(): void
  subscribe(fn: () => void): () => void
}

/** Create an engagement store over the given Storage (window.localStorage in the app). */
export function createEngagement(storage: Storage): Engagement {
  const listeners = new Set<() => void>()
  let favorites = readList(storage, FAV_KEY)
  let history = readList(storage, HIST_KEY)

  const emit = () => listeners.forEach((fn) => fn())
  const persist = (key: string, list: string[]) => {
    try {
      storage.setItem(key, JSON.stringify(list))
    } catch {
      /* quota / disabled storage — the in-memory value still holds for the session */
    }
  }

  return {
    isFavorite: (id) => favorites.includes(id),
    listFavorites: () => favorites,
    toggleFavorite(id) {
      favorites = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id]
      persist(FAV_KEY, favorites)
      emit()
    },
    listHistory: () => history,
    recordWatched(id) {
      history = [id, ...history.filter((x) => x !== id)].slice(0, MAX_HISTORY) // newest-first, deduped, capped
      persist(HIST_KEY, history)
      emit()
    },
    syncFromStorage() {
      favorites = readList(storage, FAV_KEY)
      history = readList(storage, HIST_KEY)
      emit()
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
