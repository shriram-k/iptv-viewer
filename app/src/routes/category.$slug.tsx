import { createFileRoute, Link } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getCategory, getChannelIndex } from '../data/kv'
import { StructuredData } from '../components/StructuredData'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const store = getStore()
    const [refs, index] = await Promise.all([getCategory(store, params.slug), getChannelIndex(store)])
    return { slug: params.slug, items: refs.map((r) => ({ id: r.id, country: r.country, name: index[r.id]?.name ?? r.id })) }
  },
  head: ({ params }) => ({ meta: [{ title: `${params.slug} channels — free live TV guide` }] }),
  component: CategoryPage,
})

function CategoryPage() {
  const { slug, items } = Route.useLoaderData()
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: `/channel/${it.id}` })),
  }
  return (
    <main className="mx-auto max-w-5xl p-6">
      <StructuredData data={itemList} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
        <Link to="/" className="hover:underline">Home</Link> <span aria-hidden>/</span> {slug}
      </nav>
      <h1 className="mb-4 text-2xl font-bold capitalize">{slug}</h1>
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
