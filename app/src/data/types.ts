// Types mirroring the KV read contract (docs/research/2026-06-28-kv-read-contract.md),
// produced by the v2 data pipeline.

export interface Stream {
  url: string
  status: string
  checkedAt: string | null
  scheme: 'http' | 'https'
  likelyPlayable: boolean
  quality: string | null
}

export interface Channel {
  id: string
  name: string
  country: string | null
  categories: string[]
  languages: string[]
  logo: string | null
  guide: { site: string; siteId: string; lang: string } | null
  playable: boolean
  streams: Stream[]
}

/** Lightweight ref stored in `category:<slug>` shards. */
export interface CategoryRef {
  id: string
  country: string
}

export interface ChannelIndexEntry {
  country: string
  categories: string[]
  name: string
}

export type ChannelIndex = Record<string, ChannelIndexEntry>

export interface Meta {
  version: string | number
  generatedAt: string
  counts: { channels: number; countries: number; categories: number }
}
