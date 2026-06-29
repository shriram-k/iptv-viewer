// U2 — KV data layer. A small store abstraction over the snapshot keys so the
// app reads the same shapes in prod (Cloudflare KV binding) and in dev/test
// (in-memory fixture). Getters are pure over the store, so they're unit-testable.

import { kvKeys } from './keys'
import type { Channel, CategoryRef, ChannelIndex, Meta } from './types'

/** Minimal read surface both KV and the fixture satisfy. */
export interface SnapshotStore {
  get(key: string): Promise<string | null>
}

/** Wrap a Cloudflare KV namespace binding. */
export function kvStore(binding: { get(key: string): Promise<string | null> }): SnapshotStore {
  return { get: (key) => binding.get(key) }
}

async function readJson<T>(store: SnapshotStore, key: string): Promise<T | null> {
  const raw = await store.get(key)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null // malformed value → treat as absent, never throw into a render
  }
}

export function getMeta(store: SnapshotStore) {
  return readJson<Meta>(store, kvKeys.meta())
}

export async function getCountry(store: SnapshotStore, code: string): Promise<Channel[]> {
  return (await readJson<Channel[]>(store, kvKeys.country(code))) ?? []
}

export async function getCategory(store: SnapshotStore, slug: string): Promise<CategoryRef[]> {
  return (await readJson<CategoryRef[]>(store, kvKeys.category(slug))) ?? []
}

export async function getChannelIndex(store: SnapshotStore): Promise<ChannelIndex> {
  return (await readJson<ChannelIndex>(store, kvKeys.channelIndex())) ?? {}
}

/** Resolve a channel by id: index → its country shard → the full record. */
export async function getChannel(store: SnapshotStore, id: string): Promise<Channel | null> {
  const index = await getChannelIndex(store)
  const entry = index[id]
  if (!entry) return null
  const channels = await getCountry(store, entry.country)
  return channels.find((c) => c.id === id) ?? null
}
