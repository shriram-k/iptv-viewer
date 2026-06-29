// Pick the snapshot store: the Cloudflare KV binding when present (prod / wrangler
// dev with a seeded namespace), otherwise the bundled fixture (local dev + tests).
import { kvStore, type SnapshotStore } from './kv'
import { fixtureStore } from './fixture'

export interface AppEnv {
  // Cloudflare KV binding the pipeline publishes to (added in wrangler.jsonc, U9).
  SNAPSHOT_KV?: { get(key: string): Promise<string | null> }
}

export function getStore(env?: AppEnv): SnapshotStore {
  if (env?.SNAPSHOT_KV) return kvStore(env.SNAPSHOT_KV)
  return fixtureStore()
}
