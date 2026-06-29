import type { Stream } from '../data/types'

// Best-effort, time-stamped liveness hint for the channel page (R8). The pipeline
// is daily, so `checkedAt` can be up to a day stale — this is framed as a hint,
// never as a "LIVE" guarantee, and is suppressed entirely for unknown/dead
// statuses so it can never read as a false positive.

// Mirror ChannelCard's dead-status set (no false hint for known-down streams).
const DEAD = new Set(['error', 'timeout', 'blocked', 'offline'])

/**
 * Relative, plain-language liveness hint, or null when no honest hint can be shown.
 * Pure: `now` is passed in so the result is deterministic and testable.
 */
export function livenessHint(stream: Stream | undefined, now: Date): { text: string } | null {
  if (!stream || !stream.status || stream.status === 'unknown' || DEAD.has(stream.status)) return null
  if (!stream.checkedAt) return null

  const checked = new Date(stream.checkedAt).getTime()
  if (Number.isNaN(checked)) return null

  const diffMs = now.getTime() - checked
  if (diffMs < 0) return { text: 'checked just now' } // clock skew — don't show a future time

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return { text: 'checked just now' }
  if (minutes < 60) return { text: `checked ${minutes}m ago` }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { text: `checked ${hours}h ago` }

  const days = Math.floor(hours / 24)
  return { text: `checked ${days}d ago` }
}
