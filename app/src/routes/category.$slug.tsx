import { createFileRoute, Link } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getCategory, getChannelIndex, getEpgShard, getEpgMeta } from '../data/kv'
import { LiveNowBoard } from '../components/LiveNowBoard'
import { StructuredData } from '../components/StructuredData'
import type { EpgShard } from '../data/types'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const store = getStore()
    const [refs, index, epgMeta] = await Promise.all([getCategory(store, params.slug), getChannelIndex(store), getEpgMeta(store)])
    const items = refs.map((r) => ({ id: r.id, country: r.country, name: index[r.id]?.name ?? r.id }))

    // EPG is sharded per country; a category spans countries, so fetch each
    // distinct country's shard once and union the entries for this category's
    // channels. Category coverage is computed here (epg-meta only has per-country).
    const countries = [...new Set(refs.map((r) => r.country))]
    const shards = await Promise.all(countries.map((c) => getEpgShard(store, c)))
    const byCountry: Record<string, EpgShard> = Object.fromEntries(countries.map((c, i) => [c, shards[i]]))
    const epg: EpgShard = {}
    for (const r of refs) {
      const sched = byCountry[r.country]?.[r.id]
      if (sched) epg[r.id] = sched
    }
    const coverage = items.length ? Object.keys(epg).length / items.length : 0
    return { slug: params.slug, items, epg, epgMeta, coverage }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.slug} channels — free live TV guide` }] }),
  component: CategoryPage,
})

function CategoryPage() {
  const { slug, items, epg, epgMeta, coverage } = Route.useLoaderData()
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: `/channel/${it.id}` })),
  }
  const nameById = Object.fromEntries(items.map((it) => [it.id, it.name]))
  return (
    <main className="mx-auto max-w-5xl p-6">
      <StructuredData data={itemList} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
        <Link to="/" className="hover:underline">Home</Link> <span aria-hidden>/</span> {slug}
      </nav>
      <h1 className="mb-4 text-2xl font-bold capitalize">{slug}</h1>
      <LiveNowBoard shard={epg} meta={epgMeta} coverage={coverage} nameById={nameById} />
      {items.length === 0 ? (
        <p className="text-gray-500">No channels found in this category.</p>
      ) : (
        <ul className="space-y-2" data-testid="category-list">
          {items.map((it) => (
            <li key={it.id}>
              <Link to="/channel/$id" params={{ id: it.id }} className="text-blue-600 hover:underline">
                {it.name}
              </Link>{' '}
              <span className="text-xs text-gray-400">{it.country.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
