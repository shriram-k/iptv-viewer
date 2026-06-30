import type { Programme } from '../data/types'
import { nowNext } from '../lib/epg'
import { useNow } from '../lib/useNow'

// Client-only "Now / Next" label. "Now" depends on the viewer's clock, so it's
// computed against a ticking `useNow()` (null on server/first paint → no
// hydration mismatch; advances so the label doesn't freeze mid-session). When no
// schedule exists for the channel, renders nothing (silent degradation, R7).
export function NowNext({ schedule, className }: { schedule?: Programme[]; className?: string }) {
  const now = useNow()
  if (now == null || !schedule || schedule.length === 0) return null

  const { current, next } = nowNext(schedule, now)
  if (!current && !next) return null

  // A block <span> (not <p>) so it's valid inside ChannelCard's <a>/<span> tree.
  return (
    <span className={`block truncate ${className ?? 'text-xs text-gray-500'}`} data-testid="now-next">
      {current && (
        <span>
          <span className="font-medium text-gray-700">Now:</span> {current.title}
        </span>
      )}
      {current && next && <span aria-hidden> · </span>}
      {next && (
        <span>
          <span className="font-medium text-gray-700">Next:</span> {next.title}
        </span>
      )}
    </span>
  )
}
