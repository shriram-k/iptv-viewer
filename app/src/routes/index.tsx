import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'

export const Route = createFileRoute('/')({
  loader: async () => {
    const index = await getChannelIndex(getStore())
    const countries = new Set<string>()
    const categories = new Set<string>()
    for (const entry of Object.values(index)) {
      if (entry.country) countries.add(entry.country)
      for (const c of entry.categories) categories.add(c)
    }
    return { countries: [...countries].sort(), categories: [...categories].sort() }
  },
  head: () => ({ meta: [{ title: 'Free Live TV — browse channels by country & category' }] }),
  component: Home,
})

function Rail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">{label}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function Home() {
  const { countries, categories } = Route.useLoaderData()
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Free Live TV</h1>
      <form
        className="mb-8"
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q')?.toString().trim()
          if (q) navigate({ to: '/search', search: { q } })
        }}
      >
        <input
          name="q"
          type="search"
          aria-label="Search channels"
          placeholder="Search channels, countries, categories…"
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </form>

      {/* Favorites / Recently-watched / Live-now rails render here once their
          features land (localStorage + EPG); omitted while empty. */}

      <Rail label="Browse by country">
        {countries.map((code) => (
          <Link key={code} to="/country/$code" params={{ code }} className="rounded-full border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50">
            {code.toUpperCase()}
          </Link>
        ))}
      </Rail>
      <Rail label="Browse by category">
        {categories.map((slug) => (
          <Link key={slug} to="/category/$slug" params={{ slug }} className="rounded-full border border-gray-200 px-3 py-1 text-sm capitalize hover:bg-gray-50">
            {slug}
          </Link>
        ))}
      </Rail>
    </main>
  )
}
