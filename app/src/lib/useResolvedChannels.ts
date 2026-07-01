import { useEffect, useState } from 'react'
import { fetchChannelsByIds } from '../data/server'
import type { Channel, ChannelIndex } from '../data/types'

// Resolve a list of channel IDs (favorites, history, featured) to Channel records —
// client-only, since the IDs come from localStorage / Remote Config. Shared by the
// home rails and the /favorites page so the id→Channel contract lives in one place.
//
// Resolves through the `fetchChannelsByIds` server fn (a Worker RPC on the client)
// so KV stays server-only AND only the requested entries cross the wire (not the
// whole index). Any RPC failure resolves to empty — the rail just renders nothing
// rather than spinning forever.

/** Minimal Channel from an index entry — enough for a card (no streams/logo). */
function toChannel(id: string, entry: ChannelIndex[string]): Channel {
  return { id, name: entry.name, country: entry.country, categories: entry.categories, languages: [], logo: null, guide: null, playable: true, streams: [] }
}

export function useResolvedChannels(ids: string[]): { channels: Channel[]; loading: boolean } {
  const [resolved, setResolved] = useState<ChannelIndex | null>(null)
  const key = ids.join(',') // re-resolve when the id set changes (e.g. a new favorite)
  useEffect(() => {
    let cancelled = false
    fetchChannelsByIds({ data: ids })
      .then((idx) => !cancelled && setResolved(idx))
      .catch(() => !cancelled && setResolved({})) // failure → empty, never hang
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const channels = resolved
    ? ids.map((id) => (resolved[id] ? toChannel(id, resolved[id]) : null)).filter((c): c is Channel => c !== null)
    : []
  return { channels, loading: resolved === null }
}
