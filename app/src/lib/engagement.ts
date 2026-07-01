// Device-local engagement store: favorites + recently-watched, in localStorage.
// No account, no network, no cloud user data (origin R1-R4). Pure logic over an
// injectable Storage so it's fully unit-testable; the client hooks (useEngagement)
// are thin mounted-gate wrappers over a singleton created against window.localStorage.
//
// localStorage doesn't notify same-tab listeners, so we expose subscribe/emit —
// favoriting on a card updates the home rail live.

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
  subscribe(fn: () => void): () => void
}

/** Create an engagement store over the given Storage (window.localStorage in the app). */
export function createEngagement(storage: Storage): Engagement {
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())
  const write = (key: string, list: string[]) => {
    try {
      storage.setItem(key, JSON.stringify(list))
    } catch {
      /* quota / disabled storage — favorites just won't persist */
    }
    emit()
  }

  return {
    isFavorite: (id) => readList(storage, FAV_KEY).includes(id),
    listFavorites: () => readList(storage, FAV_KEY),
    toggleFavorite(id) {
      const favs = readList(storage, FAV_KEY)
      const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]
      write(FAV_KEY, next)
    },
    listHistory: () => readList(storage, HIST_KEY),
    recordWatched(id) {
      const prev = readList(storage, HIST_KEY).filter((x) => x !== id) // dedupe
      write(HIST_KEY, [id, ...prev].slice(0, MAX_HISTORY)) // newest-first, capped
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
