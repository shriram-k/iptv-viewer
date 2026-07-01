import { useEffect, useState } from 'react'
import { deriveRcState, type RcState } from './rc'

// Client-only Remote Config reader. Returns defaults on the server and first paint
// (so SSR HTML matches — no hydration mismatch), then fills in after a single
// fetch shared across all consumers. Firebase is reached only via dynamic import
// here, so it never enters the SSR worker bundle. Every path falls back to
// defaults, so the site is fully functional whether or not RC ever loads.

const DEFAULT_STATE: RcState = { announcement: '', killed: new Set(), collections: [] }

let shared: RcState = DEFAULT_STATE
let started = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

async function ensureLoaded(): Promise<void> {
  if (started || typeof window === 'undefined') return
  started = true
  try {
    const { getRC } = await import('./remoteConfig.client')
    const rc = await getRC()
    if (!rc) return // unconfigured / unsupported → stay on defaults
    const { fetchAndActivate, getString } = await import('firebase/remote-config')
    await fetchAndActivate(rc)
    shared = deriveRcState({
      announcement: getString(rc, 'announcement'),
      killed_channel_ids: getString(rc, 'killed_channel_ids'),
      featured_collections: getString(rc, 'featured_collections'),
    })
    emit()
  } catch {
    /* offline / throttled / misconfigured → keep defaults; site works */
  }
}

export function useRemoteConfig(): RcState {
  const [state, setState] = useState<RcState>(DEFAULT_STATE)
  useEffect(() => {
    const update = () => setState(shared)
    update() // adopt already-loaded config if a prior consumer fetched it
    listeners.add(update)
    void ensureLoaded()
    return () => {
      listeners.delete(update)
    }
  }, [])
  return state
}
