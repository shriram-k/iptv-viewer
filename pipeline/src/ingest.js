'use strict';
/**
 * U3 — Ingest: fetch the iptv-org endpoints (origin R1).
 *
 * `fetchJson` is injectable so enrich/curate logic can be unit-tested with
 * fixtures and the network path is exercised only in integration runs.
 */
const { ENDPOINTS } = require('./schema');

const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function defaultFetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'iptv-viewer-pipeline/2.0' },
        signal: ctrl.signal,
      });
      if (res.status === 200) return res.json();
      lastErr = new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
    } catch (err) {
      lastErr = err; // network error or timeout/abort
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt);
  }
  throw lastErr;
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
