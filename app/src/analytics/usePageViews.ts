import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { track } from './gtag'

// Manual SPA page_view: GA's automatic page_view is disabled (send_page_view:false in
// gtag.client), so we emit one page_view per committed navigation — including the first
// view. `track` no-ops until GA is loaded, so this is inert before consent. Runs inside
// the client-only <Analytics> boundary, so it fires post-hydration (no double-count).

type Loc = { pathname: string; searchStr?: string }

function sendPageView(loc: Loc): void {
  track('page_view', {
    page_path: loc.pathname + (loc.searchStr ?? ''),
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  })
}

export function usePageViews(): void {
  const router = useRouter()
  useEffect(() => {
    sendPageView(router.state.location) // first view, once
    return router.subscribe('onResolved', ({ toLocation }) => sendPageView(toLocation))
  }, [router])
}
