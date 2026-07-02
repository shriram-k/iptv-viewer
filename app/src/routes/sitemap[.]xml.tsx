import { createFileRoute } from '@tanstack/react-router'
import { fetchChannelIndex } from '../data/server'
import { buildSitemap } from '../lib/sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const origin = new URL(request.url).origin
        const xml = buildSitemap(origin, await fetchChannelIndex())
        return new Response(xml, {
          headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
        })
      },
    },
  },
})
