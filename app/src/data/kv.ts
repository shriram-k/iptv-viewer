// U2 — KV data layer. A small store abstraction over the snapshot keys so the
// app reads the same shapes in prod (Cloudflare KV binding) and in dev/test
// (in-memory fixture). Getters are pure over the store, so they're unit-testable.

import { kvKeys } from './keys'
import type { Channel, CategoryRef, ChannelIndex, Meta, EpgShard, EpgMeta } from './types'

// Edge cache TTLs (seconds) passed to KV `get` so a key read once is served from
// the colo cache instead of a billed origin read on every request — the difference
// between a crawler burning ~30k reads walking every channel page and a few hundred.
// The pipeline republishes the catalog daily and EPG every ~6h, so this staleness is
// safe: CATALOG_TTL caps how long a snapshot change takes to propagate; EPG uses a
// shorter TTL so now/next stays fresh. (KV cacheTtl minimum is 60s.)
const CATALOG_TTL = 21_600 // 6h — channel-index, country/category shards, meta
const EPG_TTL = 3_600 // 1h — schedule shards + epg-meta

/** Minimal read surface both KV and the fixture satisfy. `cacheTtl` is honored by
 *  the KV binding and ignored by the fixture. */
export interface SnapshotStore {
  get(key: string, cacheTtl?: number): Promise<string | null>
}

/** Wrap a Cloudflare KV namespace binding. */
export function kvStore(binding: {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>
}): SnapshotStore {
  return { get: (key, cacheTtl) => binding.get(key, cacheTtl != null ? { cacheTtl } : undefined) }
}

async function readJson<T>(store: SnapshotStore, key: string, cacheTtl?: number): Promise<T | null> {
  const raw = await store.get(key, cacheTtl)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null // malformed value → treat as absent, never throw into a render
  }
}

export function getMeta(store: SnapshotStore) {
  return readJson<Meta>(store, kvKeys.meta(), CATALOG_TTL)
}

export async function getCountry(store: SnapshotStore, code: string): Promise<Channel[]> {
  return (await readJson<Channel[]>(store, kvKeys.country(code), CATALOG_TTL)) ?? []
}

export async function getCategory(store: SnapshotStore, slug: string): Promise<CategoryRef[]> {
  return (await readJson<CategoryRef[]>(store, kvKeys.category(slug), CATALOG_TTL)) ?? []
}

export async function getChannelIndex(store: SnapshotStore): Promise<ChannelIndex> {
  return (await readJson<ChannelIndex>(store, kvKeys.channelIndex(), CATALOG_TTL)) ?? {}
}

/** Resolve a channel by id: index → its country shard → the full record. */
export async function getChannel(store: SnapshotStore, id: string): Promise<Channel | null> {
  const index = await getChannelIndex(store)
  const entry = index[id]
  if (!entry) return null
  const channels = await getCountry(store, entry.country)
  return channels.find((c) => c.id === id) ?? null
}

/** One country's EPG schedule shard; `{}` when absent (silent degradation). */
export async function getEpgShard(store: SnapshotStore, code: string): Promise<EpgShard> {
  return (await readJson<EpgShard>(store, kvKeys.epg(code), EPG_TTL)) ?? {}
}

/** EPG coverage + config; null when EPG hasn't been published. */
export function getEpgMeta(store: SnapshotStore): Promise<EpgMeta | null> {
  return readJson<EpgMeta>(store, kvKeys.epgMeta(), EPG_TTL)
}
