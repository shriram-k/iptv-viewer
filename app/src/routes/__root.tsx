import { HeadContent, Scripts, Link, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Star } from 'lucide-react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#1b1720' },
      { title: 'Free Live TV — a clean guide to free-to-air channels' },
      { name: 'description', content: 'Browse and watch free live TV channels by country and category, with what’s on now and next.' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span>
            Free<span className="text-accent">TV</span>
          </span>
        </Link>
        <Link
          to="/favorites"
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:text-accent-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          activeProps={{ className: 'text-accent-ink' }}
        >
          <Star className="h-4 w-4" aria-hidden /> Favorites
        </Link>
        <form
          action="/search"
          method="get"
          className="hidden w-full max-w-xs items-center sm:flex"
          role="search"
        >
          <input
            name="q"
            type="search"
            aria-label="Search channels"
            placeholder="Search channels…"
            className="w-full rounded-full border border-line bg-surface px-4 py-1.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </form>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-5xl px-4 py-8 text-xs text-muted sm:px-6">
        <p className="max-w-2xl">
          A directory of publicly-listed free-to-air streams. FreeTV is a guide and links to third-party sources — it
          hosts and proxies no video. Availability, region locks, and content are the responsibility of each stream’s
          origin.
        </p>
      </div>
    </footer>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  )
}
