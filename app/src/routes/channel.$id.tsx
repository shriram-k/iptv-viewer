import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { fetchChannelData } from '../data/server'
import { Player } from '../components/Player'
import { StructuredData } from '../components/StructuredData'
import { useEffect } from 'react'
import { LivenessHint } from '../components/LivenessHint'
import { NowNext } from '../components/NowNext'
import { FavoriteButton } from '../components/FavoriteButton'
import { recordWatched } from '../lib/useEngagement'
import { trackChannelOpen } from '../analytics/events'
import { useRemoteConfig } from '../lib/useRemoteConfig'
import { broadcastEvents } from '../lib/jsonld'

export const Route = createFileRoute('/channel/$id')({
  loader: async ({ params }) => {
    const data = await fetchChannelData({ data: params.id })
    if (!data.channel) throw notFound()
    return { channel: data.channel, schedule: data.schedule }
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
  const { killed } = useRemoteConfig()
  const isKilled = killed.has(channel.id) // maintainer kill-switch (R8) — hide playback
  // Opening a channel page counts as a watch (recently-watched, client-only) and an
  // aggregate analytics channel_open — but not for a kill-switched channel.
  useEffect(() => {
    if (!isKilled) {
      recordWatched(channel.id)
      trackChannelOpen(channel)
    }
    // channel is invariant per id within the page; key on id so a refetch can't re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, isKilled])
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
      {/* Don't advertise a killed channel as a watchable VideoObject once RC resolves
          (client-side; SSR still emits it until the pipeline removes the channel — R8). */}
      {!isKilled && <StructuredData data={videoObject} />}
      <nav aria-label="Breadcrumb" className="mb-4 font-mono text-xs uppercase tracking-wide text-muted">
        <Link to="/" className="transition hover:text-accent-ink">Home</Link>
        {channel.country && (
          <>
            {' '}<span aria-hidden className="text-line">/</span>{' '}
            <Link to="/country/$code" params={{ code: channel.country }} className="transition hover:text-accent-ink">{channel.country.toUpperCase()}</Link>
          </>
        )}{' '}<span aria-hidden className="text-line">/</span> <span className="text-ink">{channel.name}</span>
      </nav>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{channel.name}</h1>
        <FavoriteButton
          channelId={channel.id}
          className="mt-1 shrink-0 rounded-full border border-line p-2 text-muted transition hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      {isKilled ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl bg-ink p-6 text-center" data-testid="channel-unavailable">
          <p className="text-sm text-white/80">This channel isn’t available.</p>
        </div>
      ) : (
        <>
          <Player channel={channel} />
          <NowNext schedule={schedule ?? undefined} className="mt-4 text-sm text-muted" />
        </>
      )}
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
