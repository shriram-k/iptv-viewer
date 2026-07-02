import { useResolvedChannels } from '../lib/useResolvedChannels'
import { useRemoteConfig } from '../lib/useRemoteConfig'
import { ChannelCard } from './ChannelCard'

// A titled rail of channels resolved from a list of IDs (favorites, history,
// featured). Client-only: the IDs come from localStorage / Remote Config. Renders
// nothing until there are cards to show — so an empty list, a still-loading index,
// or all-stale IDs never produce a bare titled section (rails self-omit).
// Remote Config's kill-list is filtered out (origin R8).
export function ChannelRail({ title, ids }: { title: string; ids: string[] }) {
  const { killed } = useRemoteConfig()
  const { channels } = useResolvedChannels(ids.filter((id) => !killed.has(id)))
  if (channels.length === 0) return null

  return (
    <section className="mb-10" data-testid="channel-rail">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="rise-in grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((c) => (
          <ChannelCard key={c.id} channel={c} mode="full" />
        ))}
      </div>
    </section>
  )
}
