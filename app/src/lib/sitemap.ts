import type { ChannelIndex } from '../data/types'

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Build a sitemap XML from the channel index: home + per-country/category/channel URLs.
 * Priority tiers guide crawl focus — home (1.0) and the country/category hubs (0.8) over
 * the ~10k long-tail channel pages (0.5). `lastmod` (the snapshot's generatedAt date) is
 * emitted per URL when it's a valid YYYY-MM-DD so Google knows how fresh the catalog is.
 */
export function buildSitemap(origin: string, index: ChannelIndex, lastmod?: string): string {
  const countries = new Set<string>()
  const categories = new Set<string>()
  const channels: string[] = []
  for (const [id, entry] of Object.entries(index)) {
    channels.push(`${origin}/channel/${encodeURIComponent(id)}`)
    if (entry.country) countries.add(entry.country)
    for (const c of entry.categories) categories.add(c)
  }

  const day = lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod) ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
  const entry = (loc: string, priority: string) =>
    `  <url><loc>${xmlEscape(loc)}</loc>${day}<priority>${priority}</priority></url>`

  const lines = [entry(`${origin}/`, '1.0')]
  for (const c of countries) lines.push(entry(`${origin}/country/${encodeURIComponent(c)}`, '0.8'))
  for (const c of categories) lines.push(entry(`${origin}/category/${encodeURIComponent(c)}`, '0.8'))
  for (const loc of channels) lines.push(entry(loc, '0.5'))

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`
}
