'use strict';
/**
 * U3 — Publish EPG shards + meta to KV (origin R2, R6).
 *
 * Mirrors publish-kv.js's "no partial publish" invariant: all epg:<country>
 * shards are written first, then epg-meta last, so a consumer never sees the
 * coverage/config pointer advertised as ready before its shards exist.
 *
 * `kv` and `purge` are injected for testability (kv.put(key, value) => Promise).
 */
const { kvKey } = require('../schema');

/**
 * @param {object} args
 * @param {Object} args.shardsByCountry   { [country]: { [channelId]: Programme[] } }
 * @param {Object} args.coverage          { [country]: number }
 * @param {string} args.generatedAt
 * @param {object} args.config            { coverageThreshold, minAiring, bracketHours }
 * @param {{ put(key:string, value:string): Promise<void> }} args.kv
 * @param {() => Promise<void>} [args.purge]
 * @returns {Promise<{ written:number, purged:boolean }>}
 */
async function publishEpg({ shardsByCountry, coverage, generatedAt, config, kv, purge }) {
  let written = 0;
  const put = async (key, value) => {
    await kv.put(key, JSON.stringify(value));
    written++;
  };

  // 1. Data shards first.
  for (const [country, shard] of Object.entries(shardsByCountry)) {
    await put(kvKey.epg(country), shard);
  }

  // 2. Meta last — flips the "ready" pointer (coverage + config) only once shards exist.
  await put(kvKey.epgMeta(), { generatedAt, coverage, config });

  // 3. Best-effort cache invalidation (a purge failure must not fail the publish).
  let purged = false;
  if (typeof purge === 'function') {
    try {
      await purge();
      purged = true;
    } catch (err) {
      console.warn(`EPG cache purge failed (non-fatal; TTL bounds staleness): ${err.message}`);
    }
  }

  return { written, purged };
}

module.exports = { publishEpg };
