import { useEffect, useState } from 'react'
import { createEngagement, type Engagement } from './engagement'

// Client-only access to the engagement store. Returns defaults ([] / no-op) on the
// server and first paint, then reads localStorage after mount and re-renders on any
// change (in-app subscribe + cross-tab `storage` event) — the useNow/LivenessHint
// mounted-gate pattern, so there's never a hydration mismatch.

let singleton: Engagement | null = null
function getStore(): Engagement | null {
  if (typeof window === 'undefined') return null
  if (singleton) return singleton
  try {
    // Accessing window.localStorage itself can throw (blocked-storage contexts).
    singleton = createEngagement(window.localStorage)
  } catch {
    return null // degrade to no favorites rather than crashing a render
  }
  return singleton
}

function useStoreList(read: (s: Engagement) => string[]): string[] {
  const [value, setValue] = useState<string[]>([]) // identical on server + first client render
  useEffect(() => {
    const store = getStore()
    if (!store) return
    const update = () => setValue(read(store))
    update()
    const unsub = store.subscribe(update)
    const onStorage = () => store.syncFromStorage() // cross-tab → re-seed memory + emit
    window.addEventListener('storage', onStorage)
    return () => {
      unsub()
      window.removeEventListener('storage', onStorage)
    }
    // read is stable per call site; the store is a singleton — run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return value
}

export function useFavorites(): string[] {
  return useStoreList((s) => s.listFavorites())
}

export function useHistory(): string[] {
  return useStoreList((s) => s.listHistory())
}

/** Favorite state + toggle for one channel (client-only). */
export function useFavorite(id: string): { active: boolean; toggle: () => void } {
  const favorites = useFavorites()
  return { active: favorites.includes(id), toggle: () => getStore()?.toggleFavorite(id) }
}

/** Record a channel as recently-watched (call on play-start; no-op on the server). */
export function recordWatched(id: string): void {
  getStore()?.recordWatched(id)
}
