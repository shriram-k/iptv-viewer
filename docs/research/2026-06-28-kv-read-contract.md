# KV Read Contract (pipeline → UI plan)

**Date:** 2026-06-28
**Producer:** `pipeline/src/publish-kv.js` (U7)
**Consumer:** the TanStack Start app's edge SSR (UI plan)

The pipeline writes these keys to the Cloudflare KV namespace. The UI reads them at the edge; it never reads Firestore and never bundles this data into the build (origin R8/R12).

## Keys

| Key | Value | Read by |
|-----|-------|---------|
| `meta` | `{ version, generatedAt, counts: { channels, countries, categories } }` | App boot / cache-key derivation. Written **last** by the publisher — treat `version` as the snapshot pointer. |
| `country:<code>` | Array of full channel records for that country (lowercase ISO code, `gb`, `in`, …) | Country hub page + channel page (authoritative full record lives here). |
| `category:<slug>` | Array of `{ id, country }` refs (lowercase slug) | Category hub page → resolve full records via the country shards. |
| `channel-index` | `{ [channelId]: { country, categories, name } }` | Channel page lookup (id → country shard) and search. |

## Full channel record shape (in `country:<code>`)

```
{
  id, name, country, categories: [string], languages: [string],
  logo: string|null, guide: { site, siteId, lang }|null,
  playable: boolean,                      // any stream likely browser-playable
  streams: [{ url, status, checkedAt, scheme, likelyPlayable, quality }]
                                          // ordered playable-first (origin R18)
}
```

## Invariants the UI can rely on

- All strings are sanitized at curate time (origin R14) — but the UI must still use the JSON-LD-safe serializer (`pipeline/src/sanitize.js` `toJsonLd`) when embedding any value in a `<script type="application/ld+json">` block.
- `streams` is pre-ordered: `streams[0]` is the best first attempt for the player.
- `meta.version` changes only when a new snapshot is fully published; partial publishes never advance it.

## Cache invalidation (origin R11/R12)

After each publish the pipeline calls a purge hook (Cloudflare cache purge-by-URL or purge-everything — **not** tag-purge, which is Enterprise-only). The UI plan owns the edge cache config; recommended fallback is a ~12–24 h TTL so staleness is bounded even if a purge is missed.
