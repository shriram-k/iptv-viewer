import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { EpgShard, EpgMeta, Programme } from '../data/types'
import { currentlyAiring, boardEligible } from '../lib/epg'

// "Live now" board (origin R5/R6/R8). Client-only: which channels are airing now
// depends on the viewer's clock, and the coverage gate must not bake a server
// "now" into SSR HTML. Renders nothing unless the scope passes the coverage +
// min-airing gate — a covered-but-quiet scope (late night) shows no board, never
// an empty grid (R6b).
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
  const [airing, setAiring] = useState<Array<{ channelId: string; current: Programme }> | null>(null)

  useEffect(() => {
    if (!meta) {
      setAiring(null)
      return
    }
    const a = currentlyAiring(shard, Date.now())
    setAiring(boardEligible(meta, coverage, a.length) ? a : null)
  }, [shard, meta, coverage])

  if (!airing || airing.length === 0) return null

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="live-now-board">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden /> Live now
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {airing.map(({ channelId, current }) => (
          <li key={channelId}>
            <Link
              to="/channel/$id"
              params={{ id: channelId }}
              className="flex items-center gap-2 rounded p-2 hover:bg-white focus:outline focus:outline-2 focus:outline-blue-500"
            >
              <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">LIVE</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{nameById[channelId] ?? channelId}</span>
                <span className="text-gray-500"> — {current.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
