// queryOptions per entity. Loaders call ensureQueryData(...) for SSR prefetch +
// hydration; the snapshot only changes on publish, so staleTime is high.
import { queryOptions } from '@tanstack/react-query'
import { getCategory, getChannel, getChannelIndex, getCountry, getMeta, getEpgShard, getEpgMeta, type SnapshotStore } from './kv'

const DAY = 1000 * 60 * 60 * 24
// EPG is time-relevant (the job refreshes ~every 6h and "now" advances), so it
// gets a short staleTime rather than the catalog's day-long cache.
const EPG_STALE = 1000 * 60 * 15

export const metaQuery = (store: SnapshotStore) =>
  queryOptions({ queryKey: ['meta'], queryFn: () => getMeta(store), staleTime: DAY })

export const countryQuery = (store: SnapshotStore, code: string) =>
  queryOptions({ queryKey: ['country', code.toLowerCase()], queryFn: () => getCountry(store, code), staleTime: DAY })

export const categoryQuery = (store: SnapshotStore, slug: string) =>
  queryOptions({ queryKey: ['category', slug.toLowerCase()], queryFn: () => getCategory(store, slug), staleTime: DAY })

export const channelIndexQuery = (store: SnapshotStore) =>
  queryOptions({ queryKey: ['channel-index'], queryFn: () => getChannelIndex(store), staleTime: DAY })

export const channelQuery = (store: SnapshotStore, id: string) =>
  queryOptions({ queryKey: ['channel', id], queryFn: () => getChannel(store, id), staleTime: DAY })

export const epgShardQuery = (store: SnapshotStore, code: string) =>
  queryOptions({ queryKey: ['epg', code.toLowerCase()], queryFn: () => getEpgShard(store, code), staleTime: EPG_STALE })

export const epgMetaQuery = (store: SnapshotStore) =>
  queryOptions({ queryKey: ['epg-meta'], queryFn: () => getEpgMeta(store), staleTime: EPG_STALE })
