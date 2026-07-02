// Pure Remote Config parsing. RC parameters arrive as strings (JSON-typed params
// are returned as their raw JSON string), so we parse defensively here — a bad
// edit in the Firebase console must never crash the site. No Firebase import:
// this is the tested core; remoteConfig.client.ts does the browser-only fetch.

export interface FeaturedCollection {
  title: string
  channelIds: string[]
}

export interface RcState {
  announcement: string
  killed: Set<string>
  collections: FeaturedCollection[]
}

/** In-app defaults — every RC reader falls back to these, so the site works with no RC. */
export const RC_DEFAULTS = {
  announcement: '',
  killed_channel_ids: '[]',
  featured_collections: '[]',
}

export type RcRaw = { announcement?: string; killed_channel_ids?: string; featured_collections?: string }

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const stringsOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Parse the three RC params into a typed, defensively-validated state. */
export function deriveRcState(raw: RcRaw): RcState {
  const killedList = stringsOf(parseJson<unknown>(raw.killed_channel_ids, []))
  const rawCollections = parseJson<unknown>(raw.featured_collections, [])
  const collections: FeaturedCollection[] = (Array.isArray(rawCollections) ? rawCollections : [])
    .map((c): FeaturedCollection | null => {
      if (!c || typeof c !== 'object') return null
      const { title, channelIds } = c as Record<string, unknown>
      if (typeof title !== 'string' || title.trim() === '' || !Array.isArray(channelIds)) return null
      return { title, channelIds: stringsOf(channelIds) }
    })
    .filter((c): c is FeaturedCollection => c !== null)

  return {
    announcement: typeof raw.announcement === 'string' ? raw.announcement : '',
    killed: new Set(killedList),
    collections,
  }
}
