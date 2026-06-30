import type { Programme, EpgShard, EpgMeta } from '../data/types'

// Pure now/next + board-gating compute over an EPG schedule. Timezone-correct by
// construction: programmes carry absolute UTC instants and `nowMs` is always
// passed in (the viewer's clock), so there is no server "now" and the result is
// deterministic and testable. See the EPG plan (U5).

/** Effective stop = explicit stop, else the next programme's start (open-ended if last). */
function effectiveStop(programmes: Programme[], i: number): number {
  const p = programmes[i]
  if (p.stopUtcMs != null) return p.stopUtcMs
  const next = programmes[i + 1]
  return next ? next.startUtcMs : Infinity // trailing null-stop → open-ended
}

/**
 * The programme airing at `nowMs` (half-open [start, stop)) and the soonest one
 * starting after it. Assumes the schedule is start-sorted (the pipeline emits it
 * sorted), but sorts defensively so callers can't break it.
 */
export function nowNext(schedule: Programme[], nowMs: number): { current?: Programme; next?: Programme } {
  if (schedule.length === 0) return { current: undefined, next: undefined }
  const programmes = schedule.every((p, i) => i === 0 || p.startUtcMs >= schedule[i - 1].startUtcMs)
    ? schedule
    : schedule.slice().sort((a, b) => a.startUtcMs - b.startUtcMs)

  let current: Programme | undefined
  let next: Programme | undefined
  for (let i = 0; i < programmes.length; i++) {
    const p = programmes[i]
    if (p.startUtcMs <= nowMs && nowMs < effectiveStop(programmes, i)) {
      current = p
    } else if (p.startUtcMs > nowMs) {
      next = p
      break // first one starting after now (programmes are sorted)
    }
  }
  return { current, next }
}

/** Channels in a shard with a programme airing right now (for the Live-now board, R8). */
export function currentlyAiring(shard: EpgShard, nowMs: number): Array<{ channelId: string; current: Programme }> {
  const out: Array<{ channelId: string; current: Programme }> = []
  for (const channelId of Object.keys(shard).sort()) {
    const current = nowNext(shard[channelId], nowMs).current
    if (current) out.push({ channelId, current })
  }
  return out
}

/** Whether the Live-now board should show for a scope: coverage AND enough airing (R6). */
export function boardEligible(meta: EpgMeta | null, scopeKey: string, airingCount: number): boolean {
  if (!meta) return false
  const coverage = meta.coverage[scopeKey]
  if (coverage == null) return false
  return coverage >= meta.config.coverageThreshold && airingCount >= meta.config.minAiring
}
