'use strict';
/**
 * U2 — EPG build: per-country hosted XMLTV bundle → name-matched, windowed,
 * compact per-country schedules + per-scope coverage (origin R1, R3, R6, R7, R8).
 *
 * Source reality (verified against live data during ce-work): iptv-org
 * guides.json carries `site`+`site_id` pointers into diverse grabber sites but
 * almost never a hosted `sources[].url` (2 of ~180k entries), so the only
 * no-self-scrape path is epg.pw's per-region bundles. Those key programmes by
 * epg.pw's own numeric channel ids with a `<display-name>`, and there is no
 * guides.json bridge to epg.pw, so we map epg.pw channels to our catalog by
 * normalized channel NAME within the same country (best-effort; ~40% of a
 * well-covered country's catalog matches). Unmatched channels degrade silently
 * (origin R7). guides.json `sources[].url` is a future precise-mapping upgrade.
 *
 * Pure-ish: the per-country XMLTV fetcher is injected, so fully unit-testable.
 */
const { parseXmltv, parseXmltvChannels } = require('./xmltv');
const { toStorageCountryCode } = require('../schema');

const HOUR_MS = 3600 * 1000;
const DEFAULT_BRACKET_HOURS = 36; // ±1 source-day, generous for far-offset viewers

/**
 * Normalize a channel name for cross-source matching: drop quality tokens
 * (HD/SD/4K…), lowercase, strip everything non-alphanumeric.
 * "Sky Witness HD" → "skywitness"; matches catalog "Sky Witness".
 */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(hd|sd|fhd|uhd|4k|hevc|hq)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Fill missing stops from the next programme's start; sort by start. */
function fillStops(programmes) {
  const sorted = programmes.slice().sort((a, b) => a.startUtcMs - b.startUtcMs);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].stopUtcMs == null && i + 1 < sorted.length) {
      sorted[i].stopUtcMs = sorted[i + 1].startUtcMs;
    }
  }
  return sorted;
}

/** Keep programmes overlapping [windowStart, windowEnd) (a boundary-spanner survives). */
function inWindow(programmes, windowStart, windowEnd) {
  return programmes.filter((p) => {
    const stop = p.stopUtcMs == null ? p.startUtcMs : p.stopUtcMs;
    return stop > windowStart && p.startUtcMs < windowEnd;
  });
}

/** Strip to the compact stored shape (matches the app's Programme type). */
function compact(p) {
  const rec = { startUtcMs: p.startUtcMs, stopUtcMs: p.stopUtcMs, title: p.title };
  if (p.category) rec.category = p.category;
  return rec;
}

/**
 * @param {object} args
 * @param {Array<{id:string,name:string,country:string}>} args.channels  catalog channels
 * @param {string[]} args.coveredCountries     storage country codes to process (e.g. ['gb','us'])
 * @param {(code:string)=>Promise<string|null>} args.fetchBundle  per-country XMLTV fetcher (injected)
 * @param {number} args.now                     UTC ms reference for the window
 * @param {number} [args.bracketHours]
 * @returns {Promise<{shardsByCountry:Object, coverage:Object}>}
 */
async function buildEpg({ channels, coveredCountries, fetchBundle, now, bracketHours = DEFAULT_BRACKET_HOURS }) {
  const bracketMs = bracketHours * HOUR_MS;
  const windowStart = now - bracketMs;
  const windowEnd = now + bracketMs;

  // Catalog channels grouped by storage country, with a normalized-name lookup.
  const scopeByCountry = new Map(); // code → { total, nameToId: Map }
  for (const ch of channels) {
    const code = toStorageCountryCode(ch.country);
    if (!coveredCountries.includes(code)) continue;
    if (!scopeByCountry.has(code)) scopeByCountry.set(code, { total: 0, nameToId: new Map() });
    const scope = scopeByCountry.get(code);
    scope.total++;
    const key = normalizeName(ch.name);
    if (key && !scope.nameToId.has(key)) scope.nameToId.set(key, ch.id); // first wins on collision
  }

  const shardsByCountry = {};
  const coverage = {};
  const fetched = []; // countries whose bundle actually loaded (fetched ok, even if 0 matches)

  for (const code of coveredCountries) {
    const scope = scopeByCountry.get(code) || { total: 0, nameToId: new Map() };
    coverage[code] = 0;
    if (scope.total === 0) continue;

    let xml;
    try {
      xml = await fetchBundle(code);
    } catch {
      continue; // fetch failed → leave any prior shard in place (do not clear)
    }
    if (xml == null) continue; // region not published → keep prior shard
    fetched.push(code);

    // epg.pw channel id → our iptv id, via normalized display-name. Dedupe so an
    // HD/SD pair (e.g. "BBC One" + "BBC One HD") doesn't merge two schedules into
    // one catalog channel — the first epg channel to claim an iptv id wins.
    const epgIdToIptv = new Map();
    const claimed = new Set();
    for (const c of parseXmltvChannels(xml)) {
      const iptvId = scope.nameToId.get(normalizeName(c.name));
      if (!iptvId || claimed.has(iptvId)) continue;
      epgIdToIptv.set(c.id, iptvId);
      claimed.add(iptvId);
    }

    // Group programmes by iptv channel id.
    const byChannel = new Map();
    for (const prog of parseXmltv(xml)) {
      const iptvId = epgIdToIptv.get(prog.sourceChannelId);
      if (!iptvId) continue; // unmatched epg.pw channel → drop (silent)
      if (!byChannel.has(iptvId)) byChannel.set(iptvId, []);
      byChannel.get(iptvId).push(prog);
    }

    // Window + compact.
    const shard = {};
    let withSchedule = 0;
    for (const [iptvId, programmes] of byChannel) {
      const windowed = inWindow(fillStops(programmes), windowStart, windowEnd);
      if (windowed.length === 0) continue;
      shard[iptvId] = windowed.map(compact);
      withSchedule++;
    }

    // Always record a shard for a fetched country (possibly empty) so the publish
    // step overwrites any stale prior shard rather than leaving it.
    shardsByCountry[code] = shard;
    coverage[code] = withSchedule / scope.total;
  }

  return { shardsByCountry, coverage, fetched };
}

module.exports = { buildEpg, normalizeName, fillStops, inWindow };
