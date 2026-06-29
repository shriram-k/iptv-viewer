import { createFileRoute, Link } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({ q: String(search.q ?? '') }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    const q = deps.q.trim().toLowerCase()
    const index = await getChannelIndex(getStore())
    const countries = new Set<string>()
    const categories = new Set<string>()
    const channels: { id: string; name: string; country: string }[] = []
    for (const [id, entry] of Object.entries(index)) {
      if (entry.country) countries.add(entry.country)
      for (const c of entry.categories) categories.add(c)
      if (q && (entry.name.toLowerCase().includes(q) || id.toLowerCase().includes(q))) {
        channels.push({ id, name: entry.name, country: entry.country })
      }
    }
    return {
      q: deps.q,
      channels,
      countries: q ? [...countries].filter((c) => c.includes(q)) : [],
      categories: q ? [...categories].filter((c) => c.toLowerCase().includes(q)) : [],
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.q ? `Search: ${loaderData.q}` : 'Search' }] }),
  component: SearchPage,
})

function SearchPage() {
  const { q, channels, countries, categories } = Route.useLoaderData()
  const empty = channels.length === 0 && countries.length === 0 && categories.length === 0
  return (
    <main className="mx-auto max-w-3xl p-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
        <Link to="/" className="hover:underline">Home</Link> <span aria-hidden>/</span> Search
      </nav>
      <h1 className="mb-4 text-2xl font-bold">Search{q ? `: ${q}` : ''}</h1>
      {!q && <p className="text-gray-500">Type a query to search channels, countries, and categories.</p>}
      {q && empty && <p className="text-gray-500" data-testid="zero-results">No results for “{q}”. Try browsing by country or category from the home page.</p>}

      {channels.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Channels</h2>
          <ul className="space-y-1">
            {channels.map((c) => (
              <li key={c.id}>
                <Link to="/channel/$id" params={{ id: c.id }} className="text-blue-600 hover:underline">{c.name}</Link>{' '}
                <span className="text-xs text-gray-400">{c.country.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {countries.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {countries.map((code) => (
              <Link key={code} to="/country/$code" params={{ code }} className="rounded-full border px-3 py-1 text-sm">{code.toUpperCase()}</Link>
            ))}
          </div>
        </section>
      )}
      {categories.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((slug) => (
              <Link key={slug} to="/category/$slug" params={{ slug }} className="rounded-full border px-3 py-1 text-sm capitalize">{slug}</Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
