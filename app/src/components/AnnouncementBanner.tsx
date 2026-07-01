import { useRemoteConfig } from '../lib/useRemoteConfig'

// Site-wide maintainer announcement (Remote Config). Client-only: renders nothing
// on the server / first paint and when the announcement is empty (the default),
// so it appears only when the maintainer sets one — no deploy needed.
export function AnnouncementBanner() {
  const { announcement } = useRemoteConfig()
  if (!announcement) return null
  return (
    <div role="status" data-testid="announcement" className="bg-accent px-4 py-2 text-center text-sm font-medium text-white">
      {announcement}
    </div>
  )
}
