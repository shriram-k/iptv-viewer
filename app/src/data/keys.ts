// KV key builders — must match the pipeline's producer side (pipeline/src/schema.js).
export const kvKeys = {
  country: (code: string) => `country:${code.toLowerCase()}`,
  category: (slug: string) => `category:${slug.toLowerCase()}`,
  channelIndex: () => 'channel-index',
  meta: () => 'meta',
  // EPG keys — must match pipeline/src/schema.js kvKey.epg/epgMeta.
  epg: (code: string) => `epg:${code.toLowerCase()}`,
  epgMeta: () => 'epg-meta',
}
