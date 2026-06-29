import { describe, it, expect } from 'vitest'
import { livenessHint } from './liveness'
import type { Stream } from '../data/types'

const NOW = new Date('2026-06-29T12:00:00Z')

function stream(checkedAt: string | null, status = 'online'): Stream {
  return { url: 'https://x/y.m3u8', status, checkedAt, scheme: 'https', likelyPlayable: true, quality: null }
}

describe('livenessHint', () => {
  it('renders an informative hint for a stream checked hours ago', () => {
    const hint = livenessHint(stream('2026-06-29T08:00:00Z'), NOW)
    expect(hint?.text).toMatch(/4h/)
    expect(hint?.text).toMatch(/ago/)
  })

  it('renders a day-scale hint (and never "LIVE") for a 30-hours-stale check', () => {
    const hint = livenessHint(stream('2026-06-28T06:00:00Z'), NOW)
    expect(hint?.text).toBe('checked 1d ago')
    expect(hint?.text).not.toMatch(/LIVE/i)
  })

  it('says "just now" under a minute and "Nm ago" for a few minutes', () => {
    expect(livenessHint(stream('2026-06-29T11:59:30Z'), NOW)?.text).toBe('checked just now')
    expect(livenessHint(stream('2026-06-29T11:45:00Z'), NOW)?.text).toBe('checked 15m ago')
  })

  it('suppresses the hint for dead statuses', () => {
    for (const status of ['timeout', 'offline', 'error', 'blocked']) {
      expect(livenessHint(stream('2026-06-29T11:00:00Z', status), NOW)).toBeNull()
    }
  })

  it('suppresses the hint when checkedAt is missing or status is unknown', () => {
    expect(livenessHint(stream(null), NOW)).toBeNull()
    expect(livenessHint(stream('2026-06-29T11:00:00Z', 'unknown'), NOW)).toBeNull()
  })

  it('returns null for an undefined stream', () => {
    expect(livenessHint(undefined, NOW)).toBeNull()
  })
})
