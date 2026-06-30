import { describe, it, expect } from 'vitest'
import { toJsonLd, broadcastEvents } from './jsonld'
import type { Programme } from '../data/types'

describe('toJsonLd', () => {
  it('escapes characters that could break out of a <script> block', () => {
    const out = toJsonLd({ name: 'Evil </script><script>alert(1)' })
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c') // < escaped
  })
})

describe('broadcastEvents', () => {
  const start = Date.UTC(2026, 5, 30, 14, 30, 0)
  const stop = Date.UTC(2026, 5, 30, 15, 0, 0)
  const sched: Programme[] = [
    { startUtcMs: start, stopUtcMs: stop, title: 'News at Six' },
    { startUtcMs: stop, stopUtcMs: null, title: 'The Film' },
  ]

  it('builds BroadcastEvents with absolute ISO-UTC times', () => {
    const events = broadcastEvents(sched)
    expect(events).toHaveLength(2)
    expect(events[0]['@type']).toBe('BroadcastEvent')
    expect(events[0].name).toBe('News at Six')
    expect(events[0].startDate).toBe('2026-06-30T14:30:00.000Z')
    expect(events[0].endDate).toBe('2026-06-30T15:00:00.000Z')
  })

  it('omits endDate when stop is null (open-ended)', () => {
    const events = broadcastEvents(sched)
    expect(events[1].endDate).toBeUndefined()
    expect(events[1].startDate).toBe('2026-06-30T15:00:00.000Z')
  })

  it('caps the number of events', () => {
    const many: Programme[] = Array.from({ length: 10 }, (_, i) => ({ startUtcMs: start + i * 3600_000, stopUtcMs: null, title: `P${i}` }))
    expect(broadcastEvents(many, 3)).toHaveLength(3)
  })

  it('returns [] for no schedule (so the caller omits the property)', () => {
    expect(broadcastEvents(null)).toEqual([])
    expect(broadcastEvents([])).toEqual([])
    expect(broadcastEvents(undefined)).toEqual([])
  })

  it('output is identical across calls (absolute times, no "now")', () => {
    expect(broadcastEvents(sched)).toEqual(broadcastEvents(sched))
  })

  it('a title with </script> is neutralized once serialized via toJsonLd', () => {
    const events = broadcastEvents([{ startUtcMs: start, stopUtcMs: stop, title: 'X</script>' }])
    expect(toJsonLd(events)).not.toContain('</script>')
  })
})
