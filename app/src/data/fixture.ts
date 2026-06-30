// In-memory fixture snapshot for local dev + tests (workerd has no fs, so the
// dev store is bundled data, not files). Shapes match the KV read contract.
import type { SnapshotStore } from './kv'
import { kvKeys } from './keys'

function stream(url: string, status = 'online') {
  const scheme = url.startsWith('https') ? 'https' : 'http'
  return { url, status, checkedAt: '2026-06-29T00:00:00Z', scheme, likelyPlayable: scheme === 'https' && status === 'online', quality: null }
}

const BBC = {
  id: 'BBCNews.uk', name: 'BBC News', country: 'gb', categories: ['news'], languages: ['eng'],
  logo: 'https://example.com/bbc.png', guide: null, playable: true,
  streams: [stream('https://example.com/bbc.m3u8'), stream('http://example.com/bbc-legacy.m3u8', 'online')],
}
const NDTV = {
  id: 'NDTV.in', name: 'NDTV 24x7', country: 'in', categories: ['news'], languages: ['eng', 'hin'],
  logo: null, guide: { site: 'example.com', siteId: 'ndtv', lang: 'en' }, playable: true,
  streams: [stream('https://example.com/ndtv.m3u8')],
}
const SUN = {
  id: 'SunTV.in', name: 'Sun TV', country: 'in', categories: ['entertainment'], languages: ['tam'],
  logo: null, guide: null, playable: false,
  streams: [stream('https://example.com/suntv.m3u8', 'timeout')],
}

// A small now-relative EPG schedule so dev always shows a live now/next + board.
// (Fixture is dev/test only; now/next correctness is tested deterministically in
// lib/epg.test.ts with an injected `now`.) India gets a schedule; GB gets none,
// to exercise silent degradation.
const HOUR = 3600_000
function schedule(now: number, titles: string[]): { startUtcMs: number; stopUtcMs: number; title: string }[] {
  // titles[1] is "now"; one slot before, the rest after — each one hour long.
  return titles.map((title, i) => ({ startUtcMs: now + (i - 1) * HOUR, stopUtcMs: now + i * HOUR, title }))
}
const NOW = Date.now()
const EPG_IN = {
  'NDTV.in': schedule(NOW, ['NDTV Newshour', 'NDTV Live at Now', 'The Big Fight', 'Prime Time']),
  'SunTV.in': schedule(NOW, ['Morning Serial', 'Sun Now Showing', 'Evening Movie', 'Late Night']),
}

const DATA: Record<string, unknown> = {
  [kvKeys.meta()]: { version: 1, generatedAt: '2026-06-29T00:00:00Z', counts: { channels: 3, countries: 2, categories: 2 } },
  [kvKeys.country('gb')]: [BBC],
  [kvKeys.country('in')]: [NDTV, SUN],
  [kvKeys.category('news')]: [{ id: 'BBCNews.uk', country: 'gb' }, { id: 'NDTV.in', country: 'in' }],
  [kvKeys.category('entertainment')]: [{ id: 'SunTV.in', country: 'in' }],
  [kvKeys.channelIndex()]: {
    'BBCNews.uk': { country: 'gb', categories: ['news'], name: 'BBC News' },
    'NDTV.in': { country: 'in', categories: ['news'], name: 'NDTV 24x7' },
    'SunTV.in': { country: 'in', categories: ['entertainment'], name: 'Sun TV' },
  },
  [kvKeys.epg('in')]: EPG_IN,
  [kvKeys.epgMeta()]: {
    generatedAt: new Date(NOW).toISOString(),
    coverage: { in: 0.5 },
    // minAiring 2 so the 2-channel fixture board renders in dev.
    config: { coverageThreshold: 0.2, minAiring: 2, bracketHours: 36 },
  },
}

export function fixtureStore(): SnapshotStore {
  return {
    async get(key: string) {
      return key in DATA ? JSON.stringify(DATA[key]) : null
    },
  }
}
