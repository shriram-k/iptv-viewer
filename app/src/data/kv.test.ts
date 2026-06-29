import { describe, it, expect } from 'vitest'
import { fixtureStore } from './fixture'
import { getMeta, getCountry, getCategory, getChannelIndex, getChannel, kvStore } from './kv'

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
})
