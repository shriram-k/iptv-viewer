import type { Programme } from '../data/types'

// JSON-LD-safe serialization — mirrors the pipeline's pipeline/src/sanitize.js
// toJsonLd: escape characters that could break out of a <script> block or the
// line (U+2028/U+2029). Built via new RegExp from escaped ASCII to keep this
// source free of literal control/separator bytes.
const UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g')

export function toJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(UNSAFE, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
}

/**
 * Build BroadcastEvent JSON-LD from a channel's schedule (origin R9). Emits
 * absolute UTC instants for the currently-airing + upcoming programmes (past
 * ones, which the ±day shard front-loads, are dropped so crawlers don't index
 * finished shows), flagging `isLiveBroadcast` only for the one airing at `now`.
 * `now` is the server request time — fine for SEO (no per-second accuracy), and
 * the output goes through a dangerouslySetInnerHTML script, so it isn't subject
 * to React hydration diffing. Returns [] when there's nothing to show so the
 * caller can fall back to a generic live event.
 */
export function broadcastEvents(
  schedule: Programme[] | null | undefined,
  now: number,
  max = 5,
): Array<Record<string, unknown>> {
  if (!schedule || schedule.length === 0) return []
  return schedule
    .filter((p) => (p.stopUtcMs ?? Infinity) > now) // current + upcoming only
    .slice(0, max)
    .map((p) => {
      const live = p.startUtcMs <= now && now < (p.stopUtcMs ?? Infinity)
      const event: Record<string, unknown> = {
        '@type': 'BroadcastEvent',
        name: p.title,
        startDate: new Date(p.startUtcMs).toISOString(),
        isLiveBroadcast: live,
      }
      if (p.stopUtcMs != null) event.endDate = new Date(p.stopUtcMs).toISOString()
      return event
    })
}
