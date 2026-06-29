'use strict';
/**
 * U7 — Publish the accepted snapshot to the runtime store and invalidate cache
 * (origin R8, R11, R12).
 *
 * `kv` and `purge` are injected so this is testable without network:
 *   - kv.put(key: string, value: string) => Promise<void>
 *   - purge() => Promise<void>   (Cloudflare cache purge-by-URL / purge-everything;
 *                                 tag-purge is Enterprise-only and intentionally unused)
 *
 * meta is written LAST so a consumer never sees a half-updated keyspace advertised
 * as ready (origin R12 + the "no partial publish" invariant).
 */
const { kvKey } = require('./schema');

/**
 * @param {object} args
 * @param {object} args.shards   output of buildShards
 * @param {{ put(key:string, value:string): Promise<void> }} args.kv
 * @param {() => Promise<void>} [args.purge]
 * @returns {Promise<{ written: number, purged: boolean }>}
 */
async function publishSnapshot({ shards, kv, purge }) {
  let written = 0;
  const put = async (key, value) => {
    await kv.put(key, JSON.stringify(value));
    written++;
  };

  // 1. Write all data keys first (NOT meta).
  for (const [code, list] of Object.entries(shards.countries)) {
    await put(kvKey.country(code), list);
  }
  for (const [slug, list] of Object.entries(shards.categories)) {
    await put(kvKey.category(slug), list);
  }
  await put(kvKey.channelIndex(), shards.channelIndex);

  // 2. Meta last — flips the "ready" pointer only once all data is in place.
  await put(kvKey.meta(), shards.meta);

  // 3. Invalidate the edge cache so the new data is served without a deploy (R12).
  // Best-effort: the data is already committed to KV, so a purge failure must NOT
  // fail the publish (that would skip the workflow's commit step and strand KV
  // ahead of git). The cache TTL bounds staleness as a fallback.
  let purged = false;
  if (typeof purge === 'function') {
    try {
      await purge();
      purged = true;
    } catch (err) {
      console.warn(`Cache purge failed (non-fatal; TTL will bound staleness): ${err.message}`);
    }
  }

  return { written, purged };
}

module.exports = { publishSnapshot };
