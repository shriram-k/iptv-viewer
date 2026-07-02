import { ClientOnly } from '@tanstack/react-router'
import { useConsent } from '../analytics/useConsent'
import { usePageViews } from '../analytics/usePageViews'

// Analytics runtime mount. Wrapped in <ClientOnly> so it renders only after hydration —
// no analytics work happens during SSR. `useConsent` loads GA if the visitor already
// granted (returning visitor); `usePageViews` emits manual page_views (inert until GA
// loads). Renders no UI (the consent affordance is <ConsentBanner>).
export function Analytics() {
  return (
    <ClientOnly fallback={null}>
      <AnalyticsInner />
    </ClientOnly>
  )
}

function AnalyticsInner() {
  useConsent() // load GA on mount if consent was previously granted
  usePageViews() // manual SPA page_view (no-op until GA is loaded)
  return null
}
