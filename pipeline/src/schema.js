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

/** Country-code fixups carried forward from v1 playlistGenerator.js. */
function normalizeCountryCode(code) {
  if (!code) return code;
  if (code === 'UK') return 'GB';
  return code;
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

module.exports = { IPTV_ORG_BASE, ENDPOINTS, normalizeCountryCode, kvKey, isHttpUrl };
