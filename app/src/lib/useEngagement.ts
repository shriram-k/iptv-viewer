import { useEffect, useState } from 'react'
import { createEngagement, type Engagement } from './engagement'

// Client-only access to the engagement store. Returns defaults ([] / no-op) on the
// server and first paint, then reads localStorage after mount and re-renders on any
// change (in-app subscribe + cross-tab `storage` event) — the useNow/LivenessHint
// mounted-gate pattern, so there's never a hydration mismatch.

let singleton: Engagement | null = null
function getStore(): Engagement | null {
  if (typeof window === 'undefined') return null
  if (!singleton) singleton = createEngagement(window.localStorage)
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
    window.addEventListener('storage', update) // cross-tab
    return () => {
      unsub()
      window.removeEventListener('storage', update)
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
