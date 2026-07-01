import { Link } from '@tanstack/react-router'
import type { EpgShard, EpgMeta } from '../data/types'
import { currentlyAiring, boardEligible } from '../lib/epg'
import { useNow } from '../lib/useNow'
import { useRemoteConfig } from '../lib/useRemoteConfig'

// "Live now" board (origin R5/R6/R8). Client-only: which channels are airing now
// depends on the viewer's clock (a ticking useNow, so it advances mid-session),
// and the coverage gate must not bake a server "now" into SSR HTML. Renders
// nothing unless the scope passes the coverage + min-airing gate — a covered-
// but-quiet scope (late night) shows no board, never an empty grid (R6b).
const MAX_ROWS = 12 // a curated highlight, not a full duplicate of the channel grid

export function LiveNowBoard({
  shard,
  meta,
  coverage,
  nameById,
}: {
  shard: EpgShard
  meta: EpgMeta | null
  coverage: number
  nameById: Record<string, string>
}) {
  const now = useNow()
  const { killed } = useRemoteConfig() // hook must run before any early return
  if (now == null || !meta) return null

  const airing = currentlyAiring(shard, now).filter((a) => !killed.has(a.channelId)) // R8
  if (!boardEligible(meta, coverage, airing.length)) return null

  const rows = airing.slice(0, MAX_ROWS)

  return (
    <section
      className="mb-8 rounded-2xl border border-accent/20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)6%,var(--color-surface)),var(--color-surface))] p-5"
      data-testid="live-now-board"
    >
      <h2 className="mb-4 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-accent" aria-hidden /> Live now
      </h2>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map(({ channelId, current }) => (
          <li key={channelId}>
            <Link
              to="/channel/$id"
              params={{ id: channelId }}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-white">LIVE</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-ink">{nameById[channelId] ?? channelId}</span>
                <span className="text-muted"> — {current.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
