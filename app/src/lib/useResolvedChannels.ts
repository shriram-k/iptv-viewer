import { useEffect, useState } from 'react'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'
import type { Channel, ChannelIndex } from '../data/types'

// Resolve a list of channel IDs (favorites, history, featured) to Channel records
// via the channel index — client-only, since the IDs come from localStorage /
// Remote Config. Shared by the home rails and the /favorites page so the id→Channel
// contract lives in one place. Returns `loading` until the index resolves.
//
// Note: relies on the channel index being readable client-side (true today via the
// bundled fixture; the KV cutover — app/DEPLOY.md — must keep it client-accessible).

/** Minimal Channel from an index entry — enough for a card (no streams/logo). */
function toChannel(id: string, entry: ChannelIndex[string]): Channel {
  return { id, name: entry.name, country: entry.country, categories: entry.categories, languages: [], logo: null, guide: null, playable: true, streams: [] }
}

export function useResolvedChannels(ids: string[]): { channels: Channel[]; loading: boolean } {
  const [index, setIndex] = useState<ChannelIndex | null>(null)
  useEffect(() => {
    let cancelled = false
    getChannelIndex(getStore()).then((idx) => {
      if (!cancelled) setIndex(idx)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const channels = index
    ? ids.map((id) => (index[id] ? toChannel(id, index[id]) : null)).filter((c): c is Channel => c !== null)
    : []
  return { channels, loading: index === null }
}
