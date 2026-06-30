// Single source of truth (app side) for interpreting a stream's `status` (an
// untyped string from the pipeline). Both the channel-card green dot and the
// channel-page liveness hint render the same judgement — "is this stream
// plausibly live enough to show a positive hint?" — so they share one predicate.
//
// NOTE: this set mirrors the pipeline's authoritative DEAD_STATUS in
// pipeline/src/schema.js. The app and pipeline are separate bundles (the app
// must not import Node pipeline code into the edge build), so the values are
// duplicated by necessity; keep them in sync if the pipeline's set changes.
const DEAD = new Set(['error', 'timeout', 'blocked', 'offline'])

/** True when `status` is a known, not-dead, not-unknown value safe to surface as a positive liveness hint. */
export function isPlausiblyLive(status: string | undefined): boolean {
  return !!status && status !== 'unknown' && !DEAD.has(status)
}
