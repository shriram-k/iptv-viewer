import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getChannelIndex } from '../data/kv'
import { ChannelRail } from '../components/ChannelRail'
import { useFavorites, useHistory } from '../lib/useEngagement'
import { useRemoteConfig } from '../lib/useRemoteConfig'

export const Route = createFileRoute('/')({
  loader: async () => {
    const index = await getChannelIndex(getStore())
    const countries = new Set<string>()
    const categories = new Set<string>()
    for (const entry of Object.values(index)) {
      if (entry.country) countries.add(entry.country)
      for (const c of entry.categories) categories.add(c)
    }
    return {
      countries: [...countries].sort(),
      categories: [...categories].sort(),
      total: Object.keys(index).length,
    }
  },
  head: () => ({ meta: [{ title: 'Free Live TV — browse channels by country & category' }] }),
  component: Home,
})

function ChipRail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">{label}</h2>
      <div className="rise-in flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function Home() {
  const { countries, categories, total } = Route.useLoaderData()
  const navigate = useNavigate()
  const favorites = useFavorites()
  const history = useHistory()
  const { collections } = useRemoteConfig() // maintainer-featured rails (R7)
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero */}
      <section className="border-b border-line py-12 sm:py-16">
        <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent-ink">
          <span aria-hidden className="live-dot inline-block h-2 w-2 rounded-full bg-accent" />
          On air now
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
          Free live TV,<br />
          <span className="text-muted">without the guesswork.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          A clean guide to {total.toLocaleString()}+ free-to-air channels — browse by country or category,
          see what’s on now, and press play.
        </p>
        <form
          className="mt-8 max-w-xl"
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
            className="w-full rounded-full border border-line bg-surface px-5 py-3 text-base shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </form>
      </section>

      {/* Device-local engagement + maintainer-featured rails (client-only; self-omit while empty). */}
      <div className="pt-10">
        <ChannelRail title="Your favorites" ids={favorites} />
        <ChannelRail title="Recently watched" ids={history} />
        {collections.map((c) => (
          <ChannelRail key={c.title} title={c.title} ids={c.channelIds} />
        ))}
      </div>

      <div className="py-10">
        <ChipRail label="Browse by country">
          {countries.map((code, i) => (
            <Link
              key={code}
              to="/country/$code"
              params={{ code }}
              style={{ '--i': i } as React.CSSProperties}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-sm tracking-wide text-ink transition hover:border-ink hover:bg-ink hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {code.toUpperCase()}
            </Link>
          ))}
        </ChipRail>
        <ChipRail label="Browse by category">
          {categories.map((slug, i) => (
            <Link
              key={slug}
              to="/category/$slug"
              params={{ slug }}
              style={{ '--i': i } as React.CSSProperties}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm capitalize text-ink transition hover:border-accent hover:text-accent-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {slug}
            </Link>
          ))}
        </ChipRail>
      </div>
    </main>
  )
}
