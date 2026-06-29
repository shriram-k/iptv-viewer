// Single source of truth for interpreting a stream's `status` (an untyped string
// from the pipeline). Both the channel-card green dot and the channel-page
// liveness hint render the same judgement — "is this stream plausibly live
// enough to show a positive hint?" — so they share one predicate rather than
// each owning a copy of the dead-status set (which would silently drift).
const DEAD = new Set(['error', 'timeout', 'blocked', 'offline'])

/** True when `status` is a known, not-dead, not-unknown value safe to surface as a positive liveness hint. */
export function isPlausiblyLive(status: string | undefined): boolean {
  return !!status && status !== 'unknown' && !DEAD.has(status)
}
