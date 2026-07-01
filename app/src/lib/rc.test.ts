import { describe, it, expect } from 'vitest'
import { deriveRcState } from './rc'

describe('deriveRcState', () => {
  it('parses a valid announcement, kill-list, and featured collections', () => {
    const s = deriveRcState({
      announcement: 'Maintenance Sunday',
      killed_channel_ids: '["a.uk","b.in"]',
      featured_collections: '[{"title":"Top News","channelIds":["a.uk"]},{"title":"Sport","channelIds":["c.us"]}]',
    })
    expect(s.announcement).toBe('Maintenance Sunday')
    expect([...s.killed].sort()).toEqual(['a.uk', 'b.in'])
    expect(s.collections).toHaveLength(2)
    expect(s.collections[0]).toEqual({ title: 'Top News', channelIds: ['a.uk'] })
  })

  it('malformed JSON in any field falls back to empty (never throws)', () => {
    const s = deriveRcState({ announcement: 'ok', killed_channel_ids: '{not json', featured_collections: 'nope' })
    expect(s.announcement).toBe('ok')
    expect(s.killed.size).toBe(0)
    expect(s.collections).toEqual([])
  })

  it('all-default/empty input yields empty state', () => {
    const s = deriveRcState({})
    expect(s.announcement).toBe('')
    expect(s.killed.size).toBe(0)
    expect(s.collections).toEqual([])
  })

  it('deduplicates ids in the kill-list into the Set', () => {
    const s = deriveRcState({ killed_channel_ids: '["x","x","y"]' })
    expect([...s.killed].sort()).toEqual(['x', 'y'])
  })

  it('drops malformed collection entries (missing/empty title, bad channelIds)', () => {
    const s = deriveRcState({
      featured_collections: '[{"title":"Good","channelIds":["a"]},{"channelIds":["b"]},{"title":"NoIds"},{"title":"BadIds","channelIds":"x"},{"title":"  ","channelIds":["c"]}]',
    })
    expect(s.collections).toEqual([{ title: 'Good', channelIds: ['a'] }]) // empty/whitespace title also dropped
  })

  it('ignores non-string entries inside the kill-list and channelIds', () => {
    const s = deriveRcState({
      killed_channel_ids: '["a",1,null,"b"]',
      featured_collections: '[{"title":"C","channelIds":["a",2,"b"]}]',
    })
    expect([...s.killed].sort()).toEqual(['a', 'b'])
    expect(s.collections[0].channelIds).toEqual(['a', 'b'])
  })
})
