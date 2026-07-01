// Server-only data boundary. All Cloudflare KV reads run here, inside createServerFn
// handlers, so the KV binding (env.SNAPSHOT_KV) and the `cloudflare:workers` import
// never reach the client bundle — the Start Vite plugin strips server-fn bodies
// client-side. Route loaders and the client index hook call these fns; on client-
// side navigation the call becomes an RPC to the Worker. See app/DEPLOY.md.
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { getStore, type AppEnv } from './store'
import { getCategory, getChannel, getChannelIndex, getCountry, getEpgMeta, getEpgShard } from './kv'
import type { EpgShard } from './types'

// getStore ignores env under `vite dev` (returns the fixture); in the built Worker
// it reads the KV binding. `env` is a per-isolate proxy resolved per request here.
const store = () => getStore(env as unknown as AppEnv)

export const fetchHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const index = await getChannelIndex(store())
  const countries = new Set<string>()
  const categories = new Set<string>()
  for (const entry of Object.values(index)) {
    if (entry.country) countries.add(entry.country)
    for (const c of entry.categories) categories.add(c)
  }
  return { countries: [...countries].sort(), categories: [...categories].sort(), total: Object.keys(index).length }
})

export const fetchChannelIndex = createServerFn({ method: 'GET' }).handler(async () => getChannelIndex(store()))

export const fetchCountryData = createServerFn({ method: 'GET' })
  .inputValidator((code: string) => code)
  .handler(async ({ data: code }) => {
    const s = store()
    const [channels, epg, epgMeta] = await Promise.all([getCountry(s, code), getEpgShard(s, code), getEpgMeta(s)])
    return { code, channels, epg, epgMeta }
  })

export const fetchCategoryData = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const s = store()
    const [refs, index, epgMeta] = await Promise.all([getCategory(s, slug), getChannelIndex(s), getEpgMeta(s)])
    const items = refs.map((r) => ({ id: r.id, country: r.country, name: index[r.id]?.name ?? r.id }))

    // EPG is sharded per country; only fetch shards for covered countries (avoids
    // pointless reads and keeps category coverage from being diluted by EPG-less ones).
    const covered = new Set([...new Set(refs.map((r) => r.country))].filter((c) => epgMeta?.coverage[c] != null))
    const countries = [...covered]
    const shards = await Promise.all(countries.map((c) => getEpgShard(s, c)))
    const byCountry: Record<string, EpgShard> = Object.fromEntries(countries.map((c, i) => [c, shards[i]]))
    const epg: EpgShard = {}
    for (const r of refs) {
      const sched = byCountry[r.country]?.[r.id]
      if (sched) epg[r.id] = sched
    }
    const relevant = items.filter((it) => covered.has(it.country))
    const coverage = relevant.length ? Object.keys(epg).length / relevant.length : 0
    return { slug, items, epg, epgMeta, coverage }
  })

export const fetchChannelData = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const s = store()
    const channel = await getChannel(s, id)
    if (!channel) return { channel: null, schedule: null }
    const schedule = channel.country ? (await getEpgShard(s, channel.country))[channel.id] : undefined
    return { channel, schedule: schedule ?? null }
  })

export const fetchSearchData = createServerFn({ method: 'GET' })
  .inputValidator((q: string) => q)
  .handler(async ({ data: rawQ }) => {
    const q = rawQ.trim().toLowerCase()
    const index = await getChannelIndex(store())
    const countries = new Set<string>()
    const categories = new Set<string>()
    const channels: { id: string; name: string; country: string }[] = []
    for (const [id, entry] of Object.entries(index)) {
      if (entry.country) countries.add(entry.country)
      for (const c of entry.categories) categories.add(c)
      if (q && (entry.name.toLowerCase().includes(q) || id.toLowerCase().includes(q))) {
        channels.push({ id, name: entry.name, country: entry.country })
      }
    }
    return {
      q: rawQ,
      channels,
      countries: q ? [...countries].filter((c) => c.includes(q)) : [],
      categories: q ? [...categories].filter((c) => c.toLowerCase().includes(q)) : [],
    }
  })
