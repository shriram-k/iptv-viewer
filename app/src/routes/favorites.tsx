import { createFileRoute, Link } from '@tanstack/react-router'
import { ChannelCard } from '../components/ChannelCard'
import { useFavorites } from '../lib/useEngagement'
import { useResolvedChannels } from '../lib/useResolvedChannels'
import { useRemoteConfig } from '../lib/useRemoteConfig'

export const Route = createFileRoute('/favorites')({
  head: () => ({ meta: [{ title: 'Your favorites — FreeTV' }] }),
  component: FavoritesPage,
})

// Favorites are device-local (localStorage), so this page is client-rendered: read
// the favorite IDs, resolve their metadata from the channel index, render a grid.
function FavoritesPage() {
  const favorites = useFavorites()
  const { killed } = useRemoteConfig()
  const { channels: resolved, loading } = useResolvedChannels(favorites) // unfiltered → distinguishes stale vs killed
  const channels = resolved.filter((c) => !killed.has(c.id)) // hide kill-listed for display (R8)

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
      ) : loading ? (
        <p className="text-muted">Loading…</p>
      ) : resolved.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-muted" data-testid="favorites-stale">
          Your saved channels are no longer in the catalog.
        </p>
      ) : channels.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-muted" data-testid="favorites-unavailable">
          Your favorites are temporarily unavailable.
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
