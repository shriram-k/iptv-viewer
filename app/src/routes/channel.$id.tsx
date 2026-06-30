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
  // Absolute-UTC BroadcastEvents from the schedule (R9), else a single live event.
  // SSR-safe: no "now" is computed, so server and client output match.
  const events = broadcastEvents(schedule)
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
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <StructuredData data={videoObject} />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500">
        <Link to="/" className="hover:underline">Home</Link>
        {channel.country && (
          <>
            {' '}<span aria-hidden>/</span>{' '}
            <Link to="/country/$code" params={{ code: channel.country }} className="hover:underline">{channel.country.toUpperCase()}</Link>
          </>
        )}{' '}<span aria-hidden>/</span> {channel.name}
      </nav>
      <h1 className="mb-3 text-xl font-bold">{channel.name}</h1>
      <Player channel={channel} />
      <NowNext schedule={schedule ?? undefined} className="mt-3 text-sm text-gray-600" />
      <section className="mt-4 flex items-center gap-3">
        {channel.logo && <img src={channel.logo} alt="" className="h-12 w-12 rounded object-contain" />}
        <div className="text-sm text-gray-600">
          <p>{[channel.country?.toUpperCase(), ...channel.categories].filter(Boolean).join(' · ')}</p>
          <LivenessHint stream={channel.streams[0]} />
        </div>
      </section>
      {channel.categories[0] && (
        <p className="mt-4 text-sm">
          More:{' '}
          <Link to="/category/$slug" params={{ slug: channel.categories[0] }} className="text-blue-600 hover:underline">{channel.categories[0]} channels</Link>
        </p>
      )}
    </main>
  )
}
