import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getChannel, getEpgShard } from '../data/kv'
import { Player } from '../components/Player'
import { StructuredData } from '../components/StructuredData'
import { LivenessHint } from '../components/LivenessHint'
import { NowNext } from '../components/NowNext'
import { broadcastEvents } from '../lib/jsonld'

export const Route = createFileRoute('/channel/$id')({
  loader: async ({ params }) => {
    const store = getStore()
    const channel = await getChannel(store, params.id)
    if (!channel) throw notFound()
    // EPG schedule (absolute UTC times) fetched server-side; now/next is computed
    // client-side. Absent country/coverage → empty → labels silently omitted.
    const schedule = channel.country ? (await getEpgShard(store, channel.country))[channel.id] : undefined
    return { channel, schedule: schedule ?? null }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.channel.name} — watch live` : 'Channel' }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-gray-600">Channel not found.</p>
      <Link to="/" className="text-blue-600 hover:underline">Back home</Link>
    </main>
  ),
  component: ChannelPage,
})

function ChannelPage() {
  const { channel, schedule } = Route.useLoaderData()
  // Absolute-UTC BroadcastEvents for the current + upcoming schedule (R9), else a
  // single generic live event. Emitted via a JSON-LD script (dangerouslySetInnerHTML),
  // so the request-time `now` used to drop past programmes isn't hydration-diffed.
  const events = broadcastEvents(schedule, Date.now())
  const videoObject = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: channel.name,
    description: `Watch ${channel.name} live`,
    thumbnailUrl: channel.logo ?? undefined,
    contentUrl: channel.streams[0]?.url,
    publication: events.length > 0 ? events : { '@type': 'BroadcastEvent', isLiveBroadcast: true },
  }
  // Mobile: player above the fold (rendered before the metadata block).
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <StructuredData data={videoObject} />
      <nav aria-label="Breadcrumb" className="mb-4 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link>
        {channel.country && (
          <>
            {' '}<span aria-hidden className="text-line">/</span>{' '}
            <Link to="/country/$code" params={{ code: channel.country }} className="transition hover:text-accent-ink">{channel.country.toUpperCase()}</Link>
          </>
        )}{' '}<span aria-hidden className="text-line">/</span> <span className="text-ink">{channel.name}</span>
      </nav>
      <h1 className="mb-4 text-2xl font-extrabold sm:text-3xl">{channel.name}</h1>
      <Player channel={channel} />
      <NowNext schedule={schedule ?? undefined} className="mt-4 text-sm text-muted" />
      <section className="mt-5 flex items-center gap-3 border-t border-line pt-5">
        {channel.logo && <img src={channel.logo} alt="" className="h-12 w-12 rounded-md bg-white object-contain p-0.5 ring-1 ring-line" />}
        <div className="text-sm">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">{[channel.country?.toUpperCase(), ...channel.categories].filter(Boolean).join(' · ')}</p>
          <LivenessHint stream={channel.streams[0]} />
        </div>
      </section>
      {channel.categories[0] && (
        <p className="mt-5 text-sm text-muted">
          More:{' '}
          <Link to="/category/$slug" params={{ slug: channel.categories[0] }} className="font-medium text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent">{channel.categories[0]} channels</Link>
        </p>
      )}
    </main>
  )
}
