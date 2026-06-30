import { useEffect, useState } from 'react'
import type { Programme } from '../data/types'
import { nowNext } from '../lib/epg'

// Client-only "Now / Next" label. "Now" depends on the viewer's clock, so we
// render nothing on the server / first paint and compute after mount (no
// hydration mismatch — same pattern as LivenessHint). When no schedule exists
// for the channel, renders nothing at all (silent degradation, origin R7).
export function NowNext({ schedule, className }: { schedule?: Programme[]; className?: string }) {
  const [labels, setLabels] = useState<{ now?: string; next?: string } | null>(null)

  useEffect(() => {
    if (!schedule || schedule.length === 0) {
      setLabels(null)
      return
    }
    const { current, next } = nowNext(schedule, Date.now())
    if (!current && !next) {
      setLabels(null)
      return
    }
    setLabels({ now: current?.title, next: next?.title })
  }, [schedule])

  if (!labels) return null
  // A block <span> (not <p>) so it's valid inside ChannelCard's <a>/<span> tree.
  return (
    <span className={`block truncate ${className ?? 'text-xs text-gray-500'}`} data-testid="now-next">
      {labels.now && (
        <span>
          <span className="font-medium text-gray-700">Now:</span> {labels.now}
        </span>
      )}
      {labels.now && labels.next && <span aria-hidden> · </span>}
      {labels.next && (
        <span>
          <span className="font-medium text-gray-700">Next:</span> {labels.next}
        </span>
      )}
    </span>
  )
}
