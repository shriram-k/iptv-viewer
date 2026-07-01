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
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link> <span aria-hidden className="text-line">/</span> Search
      </nav>
      <h1 className="mb-6 text-3xl font-extrabold sm:text-4xl">Search{q ? <span className="text-muted">: {q}</span> : ''}</h1>
      {!q && <p className="text-muted">Type a query to search channels, countries, and categories.</p>}
      {q && empty && <p className="rounded-xl border border-line bg-surface p-6 text-muted" data-testid="zero-results">No results for “{q}”. Try browsing by country or category from the home page.</p>}

      {channels.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">Channels</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {channels.map((c) => (
              <li key={c.id}>
                <Link to="/channel/$id" params={{ id: c.id }} className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 transition hover:border-ink/25 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span className="truncate font-medium text-ink">{c.name}</span>
                  <span className="ml-auto font-mono text-xs text-muted">{c.country.toUpperCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {countries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {countries.map((code) => (
              <Link key={code} to="/country/$code" params={{ code }} className="rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-sm text-ink transition hover:border-ink hover:bg-ink hover:text-paper">{code.toUpperCase()}</Link>
            ))}
          </div>
        </section>
      )}
      {categories.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((slug) => (
              <Link key={slug} to="/category/$slug" params={{ slug }} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm capitalize text-ink transition hover:border-accent hover:text-accent-ink">{slug}</Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
