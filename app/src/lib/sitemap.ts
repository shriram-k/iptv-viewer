import type { ChannelIndex } from '../data/types'

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build a sitemap XML from the channel index: home + per-country/category/channel URLs. */
export function buildSitemap(origin: string, index: ChannelIndex): string {
  const urls = new Set<string>([`${origin}/`])
  const countries = new Set<string>()
  const categories = new Set<string>()
  for (const [id, entry] of Object.entries(index)) {
    urls.add(`${origin}/channel/${encodeURIComponent(id)}`)
    if (entry.country) countries.add(entry.country)
    for (const c of entry.categories) categories.add(c)
  }
  for (const c of countries) urls.add(`${origin}/country/${encodeURIComponent(c)}`)
  for (const c of categories) urls.add(`${origin}/category/${encodeURIComponent(c)}`)
  const body = [...urls].map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
