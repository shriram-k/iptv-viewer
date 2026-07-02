// Pick the snapshot store: the Cloudflare KV binding in production, otherwise the
// bundled fixture (local dev + tests). Kept free of any `cloudflare:workers` import
// so it stays isomorphic — the binding is passed in from the server-only boundary
// (src/data/server.ts). See app/DEPLOY.md.
import { kvStore, type SnapshotStore } from './kv'
import { fixtureStore } from './fixture'

export interface AppEnv {
  // Cloudflare KV binding the pipeline publishes to (wrangler.jsonc SNAPSHOT_KV).
  // `get` takes an options bag so reads can pass `cacheTtl` (edge-cache the read).
  SNAPSHOT_KV?: { get(key: string, options?: { cacheTtl?: number }): Promise<string | null> }
}

export function getStore(env?: AppEnv): SnapshotStore {
  // Dev/test always use the bundled fixture — the Cloudflare Vite plugin provides a
  // real-but-EMPTY Miniflare KV binding in `vite dev`, so gating on binding presence
  // would serve empty data locally. `import.meta.env.DEV` is inlined by Vite (true
  // under dev, false in the built Worker), so this is safe on both server and client.
  if (import.meta.env.DEV) return fixtureStore()
  if (env?.SNAPSHOT_KV) return kvStore(env.SNAPSHOT_KV)
  return fixtureStore() // prod safety net before the KV namespace is seeded
}
