import { createFileRoute } from '@tanstack/react-router'
import { fetchSitemapData } from '../data/server'
import { buildSitemap } from '../lib/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const origin = new URL(request.url).origin
        const { index, lastmod } = await fetchSitemapData()
        const xml = buildSitemap(origin, index, lastmod ?? undefined)
        return new Response(xml, {
          headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
        })
      },
    },
  },
})
