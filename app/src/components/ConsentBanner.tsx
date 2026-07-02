import { useConsent } from '../analytics/useConsent'

// Lightweight analytics-consent affordance. Renders only when the choice is unset
// (mounted-gate via useConsent → nothing on server/first paint, so no hydration
// mismatch). Deny-by-default: nothing loads until Accept. The site stays fully usable
// whether the banner is answered or ignored (it's a non-blocking bar, not a modal).
export function ConsentBanner() {
  const { status, accept, decline } = useConsent()
  if (status !== 'unset') return null

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          We use privacy-friendly, aggregate analytics (no accounts, no ads, no personal
          data) to see what’s watched and what fails. The site works either way.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-accent hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
