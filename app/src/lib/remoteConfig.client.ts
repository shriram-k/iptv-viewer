// Browser-ONLY Firebase Remote Config init. The RC SDK uses window + IndexedDB and
// must never run in the Cloudflare SSR worker — so this module is reached SOLELY
// via `await import()` inside useRemoteConfig's effect, never statically imported
// by SSR-evaluated code. (A build check greps the worker bundle for `firebase`.)
//
// Config keys are PUBLIC web identifiers (via VITE_FIREBASE_*), not secrets. When
// they're absent, getRC() returns null → the app runs on RC defaults (no control
// plane, fully functional).
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getRemoteConfig, isSupported, fetchAndActivate, getString, type RemoteConfig } from 'firebase/remote-config'
import { RC_DEFAULTS, deriveRcState, type RcState } from './rc'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

let rcPromise: Promise<RemoteConfig | null> | null = null

/** Get the initialized RemoteConfig, or null (unconfigured / unsupported / failed). */
export function getRC(): Promise<RemoteConfig | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (rcPromise) return rcPromise
  rcPromise = (async () => {
    try {
      if (!firebaseConfig.apiKey) return null // no Firebase project → RC off
      if (!(await isSupported())) return null // no IndexedDB (private mode etc.) → RC off
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
      const rc = getRemoteConfig(app)
      rc.settings.minimumFetchIntervalMillis = 30 * 60 * 1000 // 30 min — respects the free-tier throttle
      rc.settings.fetchTimeoutMillis = 10_000
      rc.defaultConfig = RC_DEFAULTS
      return rc
    } catch {
      return null // any init failure → defaults
    }
  })()
  return rcPromise
}

/**
 * Fetch + activate RC and return the parsed state, or null when RC is off/failed.
 * All Firebase access is confined to this .client module so the SSR-reachable
 * useRemoteConfig hook never references firebase/* (TanStack Start import guard).
 */
export async function loadRcState(): Promise<RcState | null> {
  const rc = await getRC()
  if (!rc) return null
  await fetchAndActivate(rc)
  return deriveRcState({
    announcement: getString(rc, 'announcement'),
    killed_channel_ids: getString(rc, 'killed_channel_ids'),
    featured_collections: getString(rc, 'featured_collections'),
  })
}
