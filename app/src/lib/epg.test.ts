import { describe, it, expect } from 'vitest'
import { nowNext, currentlyAiring, boardEligible } from './epg'
import type { Programme, EpgShard, EpgMeta } from '../data/types'

const H = 3600_000
const T0 = Date.UTC(2026, 5, 30, 12, 0, 0) // a fixed reference "now"

function prog(startOffsetH: number, stopOffsetH: number | null, title: string): Programme {
  return { startUtcMs: T0 + startOffsetH * H, stopUtcMs: stopOffsetH == null ? null : T0 + stopOffsetH * H, title }
}

// schedule: [10:00-11:00 Past], [11:00-12:00 Earlier], [12:00-13:00 Now], [13:00-14:00 Next]
const schedule = [prog(-2, -1, 'Past'), prog(-1, 0, 'Earlier'), prog(0, 1, 'Now'), prog(1, 2, 'Next')]

describe('nowNext', () => {
  it('finds the current and next programme bracketing now', () => {
    const r = nowNext(schedule, T0 + 30 * 60 * 1000) // 12:30
    expect(r.current?.title).toBe('Now')
    expect(r.next?.title).toBe('Next')
  })

  it('treats the interval as half-open: now exactly at a start is current', () => {
    const r = nowNext(schedule, T0) // exactly 12:00
    expect(r.current?.title).toBe('Now')
  })

  it('uses the next programme start as the effective stop when stop is null', () => {
    const sched = [prog(0, null, 'Open'), prog(1, 2, 'Following')]
    expect(nowNext(sched, T0 + 30 * 60 * 1000).current?.title).toBe('Open')
  })

  it('a trailing null-stop programme is open-ended (current until something else)', () => {
    const sched = [prog(-1, 0, 'Before'), prog(0, null, 'Last')]
    expect(nowNext(sched, T0 + 5 * H).current?.title).toBe('Last')
  })

  it('before the first programme → no current, next is the first', () => {
    const r = nowNext(schedule, T0 - 5 * H)
    expect(r.current).toBeUndefined()
    expect(r.next?.title).toBe('Past')
  })

  it('after the last bounded programme → no current, no next', () => {
    const r = nowNext(schedule, T0 + 10 * H)
    expect(r.current).toBeUndefined()
    expect(r.next).toBeUndefined()
  })

  it('far-offset viewer still resolves within a ±day-bracketed schedule', () => {
    // Schedule entries 20h on either side of now (as the pipeline's ±36h window allows).
    const sched = [prog(-20, -19, 'Yesterday'), prog(-1, 1, 'Spanning'), prog(19, 20, 'Tomorrow')]
    expect(nowNext(sched, T0).current?.title).toBe('Spanning')
  })

  it('empty schedule → both undefined', () => {
    expect(nowNext([], T0)).toEqual({ current: undefined, next: undefined })
  })
})

describe('currentlyAiring', () => {
  const shard: EpgShard = {
    'A.in': [prog(0, 1, 'A now')],
    'B.in': [prog(1, 2, 'B later')], // not airing now
    'C.in': [prog(-1, 1, 'C now')],
  }
  it('returns only channels with a current programme', () => {
    const airing = currentlyAiring(shard, T0 + 10 * 60 * 1000)
    expect(airing.map((a) => a.channelId).sort()).toEqual(['A.in', 'C.in'])
    expect(airing.find((a) => a.channelId === 'A.in')?.current.title).toBe('A now')
  })
  it('deterministic order (by channelId)', () => {
    const airing = currentlyAiring(shard, T0 + 10 * 60 * 1000)
    expect(airing.map((a) => a.channelId)).toEqual(['A.in', 'C.in'])
  })
})

describe('boardEligible', () => {
  const meta: EpgMeta = {
    generatedAt: 'x',
    coverage: { in: 0.5, gb: 0.05 },
    config: { coverageThreshold: 0.2, minAiring: 3, bracketHours: 36 },
  }
  it('true when coverage exceeds threshold AND airing >= minAiring', () => {
    expect(boardEligible(meta, 'in', 3)).toBe(true)
  })
  it('false when coverage below threshold', () => {
    expect(boardEligible(meta, 'gb', 10)).toBe(false)
  })
  it('false when too few currently airing (e.g. late night)', () => {
    expect(boardEligible(meta, 'in', 2)).toBe(false)
  })
  it('false when the scope has no coverage entry', () => {
    expect(boardEligible(meta, 'fr', 10)).toBe(false)
  })
  it('false when meta is null', () => {
    expect(boardEligible(null, 'in', 10)).toBe(false)
  })
})
