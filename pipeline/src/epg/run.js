'use strict';
/**
 * U3 — EPG orchestration + CLI (origin R2, R12).
 *
 * runEpg() is the deps-injected orchestrator (testable without network/KV).
 * main() wires the real iptv-org fetch, XMLTV fetch, and Cloudflare KV client,
 * and runs on its OWN schedule (.github/workflows/v2-epg.yml) — fully decoupled
 * from the daily catalog pipeline: it reads guides.json/channels.json live and
 * writes only epg:* keys, so a catalog anomaly-pause never blocks an EPG refresh.
 */
const zlib = require('zlib');
const { ENDPOINTS } = require('../schema');
const { defaultFetchJson } = require('../ingest');
const { buildEpg } = require('./build');
const { publishEpg } = require('./publish');

// epg.pw's strongest-coverage regions intersected with our catalog at runtime.
const DEFAULT_COVERED = ['us', 'gb', 'in', 'au', 'ca', 'fr', 'de'];
// Calibrated against a live epg.pw GB run (~22% of the catalog has a schedule),
// so the board gate is reachable in strong regions. All three are tunable via
// epg-meta config without a code change.
const DEFAULT_CONFIG = { coverageThreshold: 0.2, minAiring: 5, bracketHours: 36 };

const EPGPW_BASE = 'https://epg.pw/xmltv';
const FETCH_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch + gunzip a per-region epg.pw XMLTV bundle (e.g. gb → epg_GB.xml.gz). */
async function defaultFetchBundle(code) {
  const url = `${EPGPW_BASE}/epg_${String(code).toUpperCase()}.xml.gz`;
  let lastErr;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 iptv-viewer-epg/2.0' } });
      if (res.status === 404) return null; // region not published by epg.pw → no data
      if (res.status !== 200) throw new Error(`XMLTV fetch ${url}: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return zlib.gunzipSync(buf).toString('utf8');
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

/**
 * @param {object} deps
 * @param {(url:string)=>Promise<any>} deps.fetchJson          iptv-org channels.json (id, name, country)
 * @param {(code:string)=>Promise<string|null>} deps.fetchBundle  per-country XMLTV fetcher
 * @param {string[]} [deps.coveredCountries]
 * @param {object} [deps.config]
 * @param {number} deps.now
 * @param {string} deps.generatedAt
 * @param {object} [deps.kv]              KV client (publish path only)
 * @param {Function} [deps.purge]
 * @returns {Promise<object>} build result + publish summary
 */
async function runEpg(deps) {
  const coveredCountries = deps.coveredCountries || DEFAULT_COVERED;
  const config = { ...DEFAULT_CONFIG, ...(deps.config || {}) };

  // Name-matching needs the catalog's channel names + countries (not guides.json,
  // whose hosted sources[].url is empty in practice — see build.js).
  const channels = await deps.fetchJson(ENDPOINTS.channels);

  const { shardsByCountry, coverage } = await buildEpg({
    channels,
    coveredCountries,
    fetchBundle: deps.fetchBundle,
    now: deps.now,
    bracketHours: config.bracketHours,
  });

  let publish = null;
  if (deps.kv) {
    publish = await publishEpg({
      shardsByCountry,
      coverage,
      generatedAt: deps.generatedAt,
      config,
      kv: deps.kv,
      purge: deps.purge,
    });
  }

  return { shardsByCountry, coverage, config, publish };
}

// ---- CLI wrapper (not unit-tested beyond runEpg) ------------------------------

async function main() {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const kv = process.env.CF_API_TOKEN ? require('../cf-kv').makeKvClient() : null;
  const purge = process.env.CF_API_TOKEN ? require('../cf-kv').makePurge() : null;

  const result = await runEpg({
    fetchJson: defaultFetchJson,
    fetchBundle: defaultFetchBundle,
    now,
    generatedAt,
    kv,
    purge,
  });

  const countries = Object.keys(result.shardsByCountry);
  const channelCount = countries.reduce((n, c) => n + Object.keys(result.shardsByCountry[c]).length, 0);
  const cov = Object.entries(result.coverage).map(([c, f]) => `${c}:${(f * 100).toFixed(0)}%`).join(' ');
  console.log(`EPG: ${channelCount} channels across ${countries.length} countries | coverage ${cov}`);
  if (result.publish) console.log(`EPG published: ${result.publish.written} keys, purged=${result.publish.purged}`);
  else console.log('EPG dry-run (no CF_API_TOKEN) — nothing published.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('EPG job failed:', err);
    process.exit(1);
  });
}

module.exports = { runEpg, defaultFetchBundle, DEFAULT_COVERED, DEFAULT_CONFIG };
