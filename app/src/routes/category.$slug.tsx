import { createFileRoute, Link } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getCategory, getChannelIndex, getEpgShard, getEpgMeta } from '../data/kv'
import { LiveNowBoard } from '../components/LiveNowBoard'
import { StructuredData } from '../components/StructuredData'
import { useRemoteConfig } from '../lib/useRemoteConfig'
import type { EpgShard } from '../data/types'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const store = getStore()
    const [refs, index, epgMeta] = await Promise.all([getCategory(store, params.slug), getChannelIndex(store), getEpgMeta(store)])
    const items = refs.map((r) => ({ id: r.id, country: r.country, name: index[r.id]?.name ?? r.id }))

    // EPG is sharded per country; a category spans countries. Only fetch shards
    // for countries that actually have EPG coverage (per epg-meta) — avoids N
    // pointless KV reads for EPG-less countries on a broad category, and keeps
    // category coverage from being diluted by those countries (which would hide
    // the board even when the covered slice is airing).
    const covered = new Set(
      [...new Set(refs.map((r) => r.country))].filter((c) => epgMeta?.coverage[c] != null),
    )
    const countries = [...covered]
    const shards = await Promise.all(countries.map((c) => getEpgShard(store, c)))
    const byCountry: Record<string, EpgShard> = Object.fromEntries(countries.map((c, i) => [c, shards[i]]))
    const epg: EpgShard = {}
    for (const r of refs) {
      const sched = byCountry[r.country]?.[r.id]
      if (sched) epg[r.id] = sched
    }
    // Coverage denominator = this category's channels in covered countries only.
    const relevant = items.filter((it) => covered.has(it.country))
    const coverage = relevant.length ? Object.keys(epg).length / relevant.length : 0
    return { slug: params.slug, items, epg, epgMeta, coverage }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.slug} channels — free live TV guide` }] }),
  component: CategoryPage,
})

function CategoryPage() {
  const { slug, items: allItems, epg, epgMeta, coverage } = Route.useLoaderData()
  const { killed } = useRemoteConfig() // hide kill-listed channels (R8)
  const items = allItems.filter((it) => !killed.has(it.id))
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: `/channel/${it.id}` })),
  }
  const nameById = Object.fromEntries(items.map((it) => [it.id, it.name]))
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <StructuredData data={itemList} />
      <nav aria-label="Breadcrumb" className="mb-5 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link> <span aria-hidden className="text-line">/</span> {slug}
      </nav>
      <header className="mb-8 flex items-baseline gap-3">
        <h1 className="text-3xl font-extrabold capitalize sm:text-4xl">{slug}</h1>
        <span className="font-mono text-sm text-muted">{items.length} channels</span>
      </header>
      <LiveNowBoard shard={epg} meta={epgMeta} coverage={coverage} nameById={nameById} />
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-muted">No channels found in this category.</p>
      ) : (
        <ul className="rise-in grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="category-list">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                to="/channel/$id"
                params={{ id: it.id }}
                className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 transition hover:border-ink/25 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="truncate font-medium text-ink">{it.name}</span>
                <span className="ml-auto font-mono text-xs text-muted">{it.country.toUpperCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
