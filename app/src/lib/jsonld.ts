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
 * Build BroadcastEvent JSON-LD from a channel's schedule (origin R9). Uses
 * absolute UTC instants → server-renderable (crawlers compute currency
 * themselves; no per-second accuracy, no SSR "now"). Returns [] when there's no
 * schedule so the caller can omit the property entirely (silent degradation).
 */
export function broadcastEvents(schedule: Programme[] | null | undefined, max = 5): Array<Record<string, unknown>> {
  if (!schedule || schedule.length === 0) return []
  return schedule.slice(0, max).map((p) => {
    const event: Record<string, unknown> = {
      '@type': 'BroadcastEvent',
      name: p.title,
      startDate: new Date(p.startUtcMs).toISOString(),
      isLiveBroadcast: true,
    }
    if (p.stopUtcMs != null) event.endDate = new Date(p.stopUtcMs).toISOString()
    return event
  })
}
