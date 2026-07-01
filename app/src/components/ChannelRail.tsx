import { useEffect, useState } from 'react'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'
import type { Channel, ChannelIndex } from '../data/types'
import { ChannelCard } from './ChannelCard'

// A titled rail of channels resolved from a list of IDs (favorites, history,
// featured). Client-only: the IDs come from localStorage / Remote Config, so we
// resolve metadata from the channel index in an effect and render nothing until
// it's ready — and nothing at all when the list is empty (rails self-omit, per
// "surface when non-empty"). Note: relies on the channel index being readable
// client-side (true today via the bundled fixture; the KV cutover — app/DEPLOY.md
// — must keep the index client-accessible).

/** Build a minimal Channel from an index entry (enough for a rail card). */
function toChannel(id: string, entry: ChannelIndex[string]): Channel {
  return {
    id,
    name: entry.name,
    country: entry.country,
    categories: entry.categories,
    languages: [],
    logo: null,
    guide: null,
    playable: true,
    streams: [],
  }
}

export function ChannelRail({ title, ids }: { title: string; ids: string[] }) {
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

  if (ids.length === 0) return null // empty list → no rail
  const channels = index ? ids.map((id) => (index[id] ? toChannel(id, index[id]) : null)).filter((c): c is Channel => c !== null) : []
  if (index && channels.length === 0) return null // resolved but nothing matches → no rail

  return (
    <section className="mb-10" data-testid="channel-rail">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="rise-in grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((c) => (
          <ChannelCard key={c.id} channel={c} mode="full" />
        ))}
      </div>
    </section>
  )
}
