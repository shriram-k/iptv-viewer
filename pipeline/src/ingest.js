'use strict';
/**
 * U3 — Ingest: fetch the iptv-org endpoints (origin R1).
 *
 * `fetchJson` is injectable so enrich/curate logic can be unit-tested with
 * fixtures and the network path is exercised only in integration runs.
 */
const { ENDPOINTS } = require('./schema');

async function defaultFetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'iptv-viewer-pipeline/2.0' } });
  if (res.status !== 200) {
    throw new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all endpoints in parallel. Any endpoint failing rejects the whole
 * ingest — a missing endpoint is a hard error, not a silent empty dataset
 * (origin R1; anomaly gate handles legitimate upstream shifts, not fetch loss).
 *
 * @param {(url:string)=>Promise<any>} [fetchJson]
 * @returns {Promise<Record<string, any[]>>}
 */
async function ingest(fetchJson = defaultFetchJson) {
  const names = Object.keys(ENDPOINTS);
  const results = await Promise.all(names.map((n) => fetchJson(ENDPOINTS[n])));
  const out = {};
  names.forEach((n, i) => {
    if (!Array.isArray(results[i])) {
      throw new Error(`Endpoint ${n} did not return an array`);
    }
    out[n] = results[i];
  });
  return out;
}

module.exports = { ingest, defaultFetchJson };
