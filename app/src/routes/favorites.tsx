import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'
import type { Channel, ChannelIndex } from '../data/types'
import { ChannelCard } from '../components/ChannelCard'
import { useFavorites } from '../lib/useEngagement'

export const Route = createFileRoute('/favorites')({
  head: () => ({ meta: [{ title: 'Your favorites — FreeTV' }] }),
  component: FavoritesPage,
})

function toChannel(id: string, entry: ChannelIndex[string]): Channel {
  return { id, name: entry.name, country: entry.country, categories: entry.categories, languages: [], logo: null, guide: null, playable: true, streams: [] }
}

// Favorites are device-local (localStorage), so this page is client-rendered: read
// the favorite IDs, resolve their metadata from the channel index, render a grid.
function FavoritesPage() {
  const favorites = useFavorites()
  const [index, setIndex] = useState<ChannelIndex | null>(null)
  useEffect(() => {
    let cancelled = false
    getChannelIndex(getStore()).then((idx) => !cancelled && setIndex(idx))
    return () => {
      cancelled = true
    }
  }, [])

  const channels = index
    ? favorites.map((id) => (index[id] ? toChannel(id, index[id]) : null)).filter((c): c is Channel => c !== null)
    : []

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link> <span aria-hidden className="text-line">/</span> Favorites
      </nav>
      <h1 className="mb-8 text-3xl font-extrabold sm:text-4xl">Your favorites</h1>
      {favorites.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-muted" data-testid="favorites-empty">
          No favorites yet — tap the <span aria-hidden>★</span> star on any channel to save it here.
        </p>
      ) : (
        <div className="rise-in grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="favorites-grid">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} mode="full" />
          ))}
        </div>
      )}
    </main>
  )
}
