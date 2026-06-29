import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getStore } from '../data/store'
import { getChannel } from '../data/kv'
import { Player } from '../components/Player'
import { StructuredData } from '../components/StructuredData'

export const Route = createFileRoute('/channel/$id')({
  loader: async ({ params }) => {
    const channel = await getChannel(getStore(), params.id)
    if (!channel) throw notFound()
    return { channel }
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
  const { channel } = Route.useLoaderData()
  const videoObject = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: channel.name,
    description: `Watch ${channel.name} live`,
    thumbnailUrl: channel.logo ?? undefined,
    contentUrl: channel.streams[0]?.url,
    publication: { '@type': 'BroadcastEvent', isLiveBroadcast: true },
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
      <section className="mt-4 flex items-center gap-3">
        {channel.logo && <img src={channel.logo} alt="" className="h-12 w-12 rounded object-contain" />}
        <div className="text-sm text-gray-600">
          <p>{[channel.country?.toUpperCase(), ...channel.categories].filter(Boolean).join(' · ')}</p>
          {channel.streams[0]?.checkedAt && <p className="text-xs text-gray-400">checked {channel.streams[0].checkedAt.slice(0, 10)}</p>}
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
