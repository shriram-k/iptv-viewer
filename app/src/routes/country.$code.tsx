import { createFileRoute, Link } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getCountry, getEpgShard, getEpgMeta } from '../data/kv'
import { ChannelCard } from '../components/ChannelCard'
import { LiveNowBoard } from '../components/LiveNowBoard'
import { StructuredData } from '../components/StructuredData'

export const Route = createFileRoute('/country/$code')({
  loader: async ({ params }) => {
    const store = getStore()
    const [channels, epg, epgMeta] = await Promise.all([
      getCountry(store, params.code),
      getEpgShard(store, params.code),
      getEpgMeta(store),
    ])
    return { code: params.code, channels, epg, epgMeta }
  },
  head: ({ params }) => ({
    meta: [{ title: `Live TV channels in ${params.code.toUpperCase()} — free streaming guide` }],
  }),
  component: CountryPage,
})

function CountryPage() {
  const { code, channels, epg, epgMeta } = Route.useLoaderData()
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: channels.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `/channel/${c.id}` })),
  }
  const nameById = Object.fromEntries(channels.map((c) => [c.id, c.name]))
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <StructuredData data={itemList} />
      <nav aria-label="Breadcrumb" className="mb-5 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link> <span aria-hidden className="text-line">/</span> {code.toUpperCase()}
      </nav>
      <header className="mb-8 flex items-baseline gap-3">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Live TV in {code.toUpperCase()}</h1>
        <span className="font-mono text-sm text-muted">{channels.length} channels</span>
      </header>
      <LiveNowBoard shard={epg} meta={epgMeta} coverage={epgMeta?.coverage[code.toLowerCase()] ?? 0} nameById={nameById} />
      {channels.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-muted">No channels found for this country.</p>
      ) : (
        <div className="rise-in grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="channel-grid">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} mode="full" schedule={epg[c.id]} />
          ))}
        </div>
      )}
    </main>
  )
}
