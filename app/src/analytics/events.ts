// Aggregate-only, identity-free GA4 event taxonomy (origin R1/R2/R3). Small typed
// wrappers over track() so event names + params live in one place. snake_case names,
// reserved-name-safe. Every param is a non-identifying dimension — never a user id,
// session id, IP, or precise location. All calls no-op until consent (track()), so
// callers need no guards.

import { track } from './gtag'
import type { Channel } from '../data/types'
import type { FailureClass } from '../lib/playback'

// Identity-free dimensions for a channel. Primary category/language only (arrays don't
// map to a single GA dimension). channel_id is a raw param (~10k distinct values →
// (other)-bucketed if registered as a dimension; group by country_code/category instead).
function channelDims(channel: Channel): Record<string, string> {
  const dims: Record<string, string> = { channel_id: channel.id }
  if (channel.country) dims.country_code = channel.country
  if (channel.categories[0]) dims.category = channel.categories[0]
  if (channel.languages[0]) dims.language = channel.languages[0]
  return dims
}

/** Channel page opened. */
export function trackChannelOpen(channel: Channel): void {
  track('channel_open', channelDims(channel))
}

/** Playback attempt started (before first frame). */
export function trackStreamPlay(channel: Channel): void {
  track('stream_play', channelDims(channel))
}

/** First frame reached — time-to-first-frame in ms. */
export function trackPlaySuccess(channel: Channel, firstFrameMs: number): void {
  track('play_success', { ...channelDims(channel), first_frame_ms: Math.max(0, Math.round(firstFrameMs)) })
}

/** Playback failed, tagged with the stable failure class. */
export function trackStreamError(channel: Channel, failureClass: FailureClass): void {
  track('stream_error', { ...channelDims(channel), failure_class: failureClass })
}

/** How long a channel was watched (seconds), emitted on teardown. */
export function trackWatchDuration(channel: Channel, seconds: number): void {
  const rounded = Math.round(seconds)
  if (rounded <= 0) return // round first, so a sub-second play doesn't emit seconds:0
  track('watch_duration', { ...channelDims(channel), seconds: rounded })
}

/** A search was performed. `search_term` is aggregate search intent — never an identifier. */
export function trackSearch(term: string): void {
  const t = term.trim()
  if (!t) return
  track('search_perform', { search_term: t })
}
