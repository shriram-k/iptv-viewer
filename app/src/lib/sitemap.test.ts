import { describe, it, expect } from 'vitest'
import { buildSitemap } from './sitemap'
import type { ChannelIndex } from '../data/types'

const index: ChannelIndex = {
  'BBCNews.uk': { country: 'gb', categories: ['news'], name: 'BBC News' },
  'NDTV.in': { country: 'in', categories: ['news'], name: 'NDTV 24x7' },
  'SunTV.in': { country: 'in', categories: ['entertainment'], name: 'Sun TV' },
}

describe('buildSitemap', () => {
  it('includes home, channel, country, and category URLs', () => {
    const xml = buildSitemap('https://iptv.example', index)
    expect(xml).toContain('<loc>https://iptv.example/</loc>')
    expect(xml).toContain('/channel/BBCNews.uk')
    expect(xml).toContain('/country/gb')
    expect(xml).toContain('/country/in')
    expect(xml).toContain('/category/news')
    expect(xml).toContain('/category/entertainment')
    expect(xml.startsWith('<?xml')).toBe(true)
  })

  it('dedupes countries/categories shared across channels', () => {
    const xml = buildSitemap('https://x', index)
    expect(xml.match(/\/country\/in/g)?.length).toBe(1)
    expect(xml.match(/\/category\/news/g)?.length).toBe(1)
  })

  it('empty index → valid sitemap with just home', () => {
    const xml = buildSitemap('https://x', {})
    expect(xml).toContain('<loc>https://x/</loc>')
    expect(xml).toContain('</urlset>')
  })
})
