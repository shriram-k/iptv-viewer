import { createFileRoute, Link } from '@tanstack/react-router'
import { fetchCategoryData } from '../data/server'
import { LiveNowBoard } from '../components/LiveNowBoard'
import { StructuredData } from '../components/StructuredData'
import { useRemoteConfig } from '../lib/useRemoteConfig'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => fetchCategoryData({ data: params.slug }),
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
