import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { track } from './gtag'
import { useConsent } from './useConsent'

// Manual SPA page_view. GA's automatic page_view is disabled (send_page_view:false in
// gtag.client), so we emit one page_view per committed navigation. Gated on consent
// becoming 'granted' so the CURRENT page is counted the moment GA turns on — this covers
// both the landing page for a returning granted visitor and the page a first-time visitor
// clicks Accept on (which the mount-time view missed, since consent was still unset then).
// `track` buffers until GA finishes loading, so nothing is dropped to the async load.

type Loc = { pathname: string; searchStr?: string }

function sendPageView(loc: Loc): void {
  track('page_view', {
    page_path: loc.pathname + (loc.searchStr ?? ''),
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  })
}

export function usePageViews(): void {
  const router = useRouter()
  const { status } = useConsent()
  useEffect(() => {
    if (status !== 'granted') return
    sendPageView(router.state.location) // current page — counts landing + accept-on page
    return router.subscribe('onResolved', ({ toLocation }) => sendPageView(toLocation))
  }, [router, status])
}
