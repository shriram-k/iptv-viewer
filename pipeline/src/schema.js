'use strict';
/**
 * Shared constants, key builders, and small validators for the v2 pipeline.
 * Plain CommonJS to match the repo and run under Node 20 in CI with no build step.
 */

const IPTV_ORG_BASE = 'https://iptv-org.github.io/api';

/** Endpoints the pipeline pulls (origin R1). */
const ENDPOINTS = {
  streams: `${IPTV_ORG_BASE}/streams.json`,
  channels: `${IPTV_ORG_BASE}/channels.json`,
  feeds: `${IPTV_ORG_BASE}/feeds.json`,
  logos: `${IPTV_ORG_BASE}/logos.json`,
  categories: `${IPTV_ORG_BASE}/categories.json`,
  countries: `${IPTV_ORG_BASE}/countries.json`,
  languages: `${IPTV_ORG_BASE}/languages.json`,
  regions: `${IPTV_ORG_BASE}/regions.json`,
  blocklist: `${IPTV_ORG_BASE}/blocklist.json`,
  guides: `${IPTV_ORG_BASE}/guides.json`,
};

/**
 * Single source of truth for stream statuses that mean "not playable / dead"
 * (shared by enrich's playability hint and curate's drop gate to prevent drift).
 */
const DEAD_STATUS = new Set(['error', 'timeout', 'blocked', 'offline']);

/** Country-code fixups carried forward from v1 playlistGenerator.js. */
function normalizeCountryCode(code) {
  if (!code) return code;
  if (code === 'UK') return 'GB';
  return code;
}

/**
 * Storage-safe, lowercase country key. Untrusted upstream values are validated
 * to a 2-letter code; anything else collapses to 'unknown' so it can never be
 * used to escape the snapshot directory (path traversal) or emit a junk key.
 */
function toStorageCountryCode(code) {
  const normalized = (normalizeCountryCode(code) || '').toString().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? normalized : 'unknown';
}

/** Storage-safe category slug, or null if the upstream value is unusable. */
function toStorageCategorySlug(slug) {
  const s = String(slug || '').toLowerCase();
  return /^[a-z0-9-]+$/.test(s) ? s : null;
}

/** KV key builders — the runtime read contract (origin R5/R8). */
const kvKey = {
  country: (code) => `country:${String(code).toLowerCase()}`,
  category: (slug) => `category:${String(slug).toLowerCase()}`,
  channelIndex: () => 'channel-index',
  meta: () => 'meta',
};

/** A permissive http(s) URL guard (origin R14). */
function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

module.exports = {
  IPTV_ORG_BASE,
  ENDPOINTS,
  DEAD_STATUS,
  normalizeCountryCode,
  toStorageCountryCode,
  toStorageCategorySlug,
  kvKey,
  isHttpUrl,
};
