'use strict';
/**
 * U2 — EPG build: guides.json + XMLTV → mapped, windowed, per-country compact
 * schedules + per-scope coverage (origin R1, R3, R6, R7, R8).
 *
 * Pure-ish: the XMLTV fetcher is injected so this is fully unit-testable with no
 * network. Deduplicates fetches by source URL, maps source channel ids back to
 * iptv-org channel ids (site_id or iptv id), and degrades silently where data
 * is missing (unmapped/scheduleless channels are simply absent — origin R7).
 */
const { parseXmltv } = require('./xmltv');
const { toStorageCountryCode } = require('../schema');

const HOUR_MS = 3600 * 1000;
const DEFAULT_BRACKET_HOURS = 36; // ±1 source-day, generous for far-offset viewers

/** Prefer an XMLTV source url from a guide entry's sources[] (format XML first). */
function guideSourceUrl(guide) {
  const sources = Array.isArray(guide.sources) ? guide.sources : [];
  const xml = sources.find((s) => s && s.url && /xml/i.test(s.format || '')) || sources.find((s) => s && s.url);
  return xml ? xml.url : null;
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
 * @param {Array<{id:string,country:string}>} args.channels   catalog channels (raw country ok)
 * @param {Array<object>} args.guides                          iptv-org guides.json entries
 * @param {string[]} args.coveredCountries                     storage country codes to process
 * @param {(url:string)=>Promise<string>} args.fetchText       XMLTV fetcher (injected)
 * @param {number} args.now                                    UTC ms reference for the window
 * @param {number} [args.bracketHours]
 * @returns {Promise<{shardsByCountry:Object, coverage:Object}>}
 */
async function buildEpg({ channels, guides, coveredCountries, fetchText, now, bracketHours = DEFAULT_BRACKET_HOURS }) {
  const covered = new Set(coveredCountries);
  const bracketMs = bracketHours * HOUR_MS;
  const windowStart = now - bracketMs;
  const windowEnd = now + bracketMs;

  // channel id → storage country, scoped to covered countries.
  const countryOf = new Map();
  const scopeCounts = new Map(); // country → total scope channels
  for (const ch of channels) {
    const code = toStorageCountryCode(ch.country);
    if (!covered.has(code)) continue;
    countryOf.set(ch.id, code);
    scopeCounts.set(code, (scopeCounts.get(code) || 0) + 1);
  }

  // Group covered channels' guide entries by their (deduped) source URL.
  // urlToEntries: url → [{ iptvId, siteId, lang }]
  const urlToEntries = new Map();
  for (const g of guides) {
    if (!g.channel || !countryOf.has(g.channel)) continue;
    const url = guideSourceUrl(g);
    if (!url) continue;
    if (!urlToEntries.has(url)) urlToEntries.set(url, []);
    urlToEntries.get(url).push({ iptvId: g.channel, siteId: g.site_id, lang: g.lang });
  }

  // Accumulate programmes per iptv channel id.
  const byChannel = new Map();
  for (const [url, entries] of urlToEntries) {
    let doc;
    try {
      doc = await fetchText(url);
    } catch {
      continue; // best-effort: one bad source must not sink the whole build
    }
    // Build a source-channel-id → iptv-id lookup (try site_id and the iptv id itself).
    const lookup = new Map();
    for (const e of entries) {
      if (e.siteId) lookup.set(e.siteId, e.iptvId);
      lookup.set(e.iptvId, e.iptvId);
    }
    const lang = entries[0] && entries[0].lang;
    for (const prog of parseXmltv(doc, { lang })) {
      const iptvId = lookup.get(prog.sourceChannelId);
      if (!iptvId) continue; // unmapped → drop (silent, never wrong)
      if (!byChannel.has(iptvId)) byChannel.set(iptvId, []);
      byChannel.get(iptvId).push(prog);
    }
  }

  // Window + compact + group by country.
  const shardsByCountry = {};
  const withSchedule = new Map(); // country → count of channels that got a schedule
  for (const [iptvId, programmes] of byChannel) {
    const country = countryOf.get(iptvId);
    if (!country) continue;
    const windowed = inWindow(fillStops(programmes), windowStart, windowEnd);
    if (windowed.length === 0) continue;
    if (!shardsByCountry[country]) shardsByCountry[country] = {};
    shardsByCountry[country][iptvId] = windowed.map(compact);
    withSchedule.set(country, (withSchedule.get(country) || 0) + 1);
  }

  // Coverage = channels-with-schedule / total-scope-channels, per covered country.
  const coverage = {};
  for (const code of covered) {
    const total = scopeCounts.get(code) || 0;
    coverage[code] = total > 0 ? (withSchedule.get(code) || 0) / total : 0;
  }

  return { shardsByCountry, coverage };
}

module.exports = { buildEpg, guideSourceUrl, fillStops, inWindow };
