import { describe, it, expect } from 'vitest'
import { fixtureStore } from './fixture'
import { getMeta, getCountry, getCategory, getChannel, getEpgShard, getEpgMeta, kvStore } from './kv'
import { kvKeys } from './keys'

const store = fixtureStore()

describe('KV data layer (fixture)', () => {
  it('reads meta', async () => {
    const meta = await getMeta(store)
    expect(meta?.counts.channels).toBe(3)
  })

  it('reads a country shard (full channel records)', async () => {
    const gb = await getCountry(store, 'gb')
    expect(gb.map((c) => c.id)).toEqual(['BBCNews.uk'])
    expect(gb[0].streams[0].url).toContain('https://')
  })

  it('country lookup is case-insensitive', async () => {
    expect(await getCountry(store, 'GB')).toHaveLength(1)
  })

  it('reads a category shard as refs', async () => {
    const news = await getCategory(store, 'news')
    expect(news).toEqual([
      { id: 'BBCNews.uk', country: 'gb' },
      { id: 'NDTV.in', country: 'in' },
    ])
  })

  it('resolves a channel by id via the index', async () => {
    const ch = await getChannel(store, 'NDTV.in')
    expect(ch?.name).toBe('NDTV 24x7')
    expect(ch?.country).toBe('in')
  })

  it('unknown country → empty array (no throw)', async () => {
    expect(await getCountry(store, 'zz')).toEqual([])
  })

  it('unknown channel id → null (no throw)', async () => {
    expect(await getChannel(store, 'Ghost.zz')).toBeNull()
  })

  it('malformed KV value → treated as absent, not thrown', async () => {
    const bad = kvStore({ get: async () => '{not json' })
    expect(await getMeta(bad)).toBeNull()
    expect(await getCountry(bad, 'gb')).toEqual([])
  })

  it('reads an EPG shard for a covered country', async () => {
    const epg = await getEpgShard(store, 'in')
    expect(Object.keys(epg)).toContain('NDTV.in')
    expect(epg['NDTV.in'][0]).toHaveProperty('startUtcMs')
    expect(epg['NDTV.in'][0]).toHaveProperty('title')
  })

  it('EPG shard for an uncovered country → {} (silent degradation)', async () => {
    expect(await getEpgShard(store, 'gb')).toEqual({})
  })

  it('reads EPG meta (coverage + config)', async () => {
    const meta = await getEpgMeta(store)
    expect(meta?.coverage.in).toBeGreaterThan(0)
    expect(meta?.config.coverageThreshold).toBeTypeOf('number')
  })

  it('malformed EPG value → {} / null, never thrown', async () => {
    const bad = kvStore({ get: async () => 'nope' })
    expect(await getEpgShard(bad, 'in')).toEqual({})
    expect(await getEpgMeta(bad)).toBeNull()
  })

  it('EPG key builders match the pipeline producer contract', () => {
    // Mirror of pipeline/src/schema.js kvKey.epg/epgMeta — a drift guard.
    expect(kvKeys.epg('GB')).toBe('epg:gb')
    expect(kvKeys.epgMeta()).toBe('epg-meta')
  })
})
