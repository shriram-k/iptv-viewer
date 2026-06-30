import { describe, it, expect } from 'vitest'
import { buildCandidates, classifyFailure, dominantClass, messageFor } from './playback'
import type { FailureClass } from './playback'
import type { Stream } from '../data/types'

function stream(url: string, overrides: Partial<Stream> = {}): Stream {
  const scheme = url.startsWith('https') ? 'https' : 'http'
  return { url, status: 'online', checkedAt: null, scheme, likelyPlayable: true, quality: null, ...overrides }
}

describe('buildCandidates', () => {
  it('preserves snapshot order and marks only http-on-https as browser-blocked', () => {
    const candidates = buildCandidates(
      [stream('https://a/1.m3u8'), stream('http://b/2.m3u8'), stream('https://c/3.m3u8')],
      'https:',
    )
    expect(candidates.map((c) => c.url)).toEqual(['https://a/1.m3u8', 'http://b/2.m3u8', 'https://c/3.m3u8'])
    expect(candidates[0].preflightClass).toBeUndefined()
    expect(candidates[1].preflightClass).toBe('browser-blocked')
    expect(candidates[2].preflightClass).toBeUndefined()
  })

  it('does not pre-mark http streams on an http page (dev)', () => {
    const candidates = buildCandidates([stream('http://b/2.m3u8')], 'http:')
    expect(candidates[0].preflightClass).toBeUndefined()
  })

  it('returns [] for no streams', () => {
    expect(buildCandidates([], 'https:')).toEqual([])
  })

  it('returns a single candidate with no preflightClass for one https stream', () => {
    const candidates = buildCandidates([stream('https://a/1.m3u8')], 'https:')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].preflightClass).toBeUndefined()
  })
})

describe('classifyFailure', () => {
  it('classifies http-on-https as browser-blocked (mixed content)', () => {
    expect(classifyFailure({ scheme: 'http' }, 'https:', true)).toBe('browser-blocked')
  })

  it('classifies 403 and 451 as region-restricted', () => {
    expect(classifyFailure({ scheme: 'https', responseCode: 403 }, 'https:', true)).toBe('region-restricted')
    expect(classifyFailure({ scheme: 'https', responseCode: 451 }, 'https:', true)).toBe('region-restricted')
  })

  it('classifies 404, 410 and 5xx as dead', () => {
    for (const code of [404, 410, 500, 503]) {
      expect(classifyFailure({ scheme: 'https', responseCode: code }, 'https:', true)).toBe('dead')
    }
  })

  it('classifies a status-less failure while offline as dead (do not blame the channel)', () => {
    const cls = classifyFailure({ scheme: 'https', responseCode: 0 }, 'https:', false)
    expect(cls).toBe('dead')
  })

  it('classifies a status-less failure while online as browser-blocked, with conservative copy', () => {
    const cls = classifyFailure({ scheme: 'https', responseCode: 0 }, 'https:', true)
    expect(cls).toBe('browser-blocked')
    const msg = messageFor(cls)
    expect(msg).not.toMatch(/region/i)
    expect(msg).not.toMatch(/CORS/i)
  })

  it('classifies timeout / parse / codec / media failures (no code) as dead', () => {
    expect(classifyFailure({ scheme: 'https', details: 'manifestLoadTimeOut' }, 'https:', true)).toBe('dead')
    expect(classifyFailure({ scheme: 'https', details: 'manifestParsingError' }, 'https:', true)).toBe('dead')
    expect(classifyFailure({ scheme: 'https', details: 'manifestIncompatibleCodecsError' }, 'https:', true)).toBe('dead')
    expect(classifyFailure({ scheme: 'https', fatalType: 'mediaError' }, 'https:', true)).toBe('dead')
  })
})

describe('dominantClass', () => {
  it('prefers region-restricted over dead over browser-blocked', () => {
    expect(dominantClass(['browser-blocked', 'region-restricted', 'dead'])).toBe('region-restricted')
    expect(dominantClass(['browser-blocked', 'dead'])).toBe('dead')
    expect(dominantClass(['browser-blocked'])).toBe('browser-blocked')
  })

  it('returns a safe default (dead) for no attempts', () => {
    expect(dominantClass([])).toBe('dead')
  })
})

describe('messageFor', () => {
  it('returns a non-empty string for every failure class', () => {
    const classes: FailureClass[] = ['dead', 'browser-blocked', 'region-restricted']
    for (const c of classes) {
      expect(messageFor(c).length).toBeGreaterThan(0)
    }
  })
})
