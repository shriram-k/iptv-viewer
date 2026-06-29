'use strict';
/**
 * U3 — Enrich: join streams/channels/feeds/logos/guides into one channel model
 * (origin R2, R17, R18).
 *
 * Pure function over raw datasets so it is fully unit-testable with fixtures.
 */
const { normalizeCountryCode, DEAD_STATUS } = require('./schema');

function schemeOf(url) {
  return /^https:\/\//i.test(url) ? 'https' : 'http';
}

/**
 * Best-effort browser-playability hint (origin R18). Calibrated by the U1 probe:
 * HTTP is hard-blocked as mixed content; known-dead statuses won't play. The CORS
 * verdict is not knowable here — this is a hint for ordering, not a guarantee.
 */
function playabilityHint(url, status) {
  const scheme = schemeOf(url);
  const likelyPlayable = scheme === 'https' && !DEAD_STATUS.has(status);
  return { scheme, likelyPlayable };
}

function streamSort(a, b) {
  // playable-first (R18), then https, then live status, stable otherwise
  if (a.likelyPlayable !== b.likelyPlayable) return a.likelyPlayable ? -1 : 1;
  if (a.scheme !== b.scheme) return a.scheme === 'https' ? -1 : 1;
  const aLive = a.status === 'online' ? 0 : 1;
  const bLive = b.status === 'online' ? 0 : 1;
  return aLive - bLive;
}

function indexBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

/**
 * @param {Record<string, any[]>} raw  Output of ingest()
 * @returns {Array<object>} enriched channel records
 */
function enrich(raw) {
  const channels = raw.channels || [];
  const streamsByChannel = indexBy(raw.streams || [], 'channel');
  const logosByChannel = indexBy(raw.logos || [], 'channel');
  const feedsByChannel = indexBy(raw.feeds || [], 'channel');
  const guidesByChannel = indexBy(raw.guides || [], 'channel');

  const records = [];
  for (const ch of channels) {
    const rawStreams = streamsByChannel.get(ch.id) || [];
    if (rawStreams.length === 0) continue; // no playable source → not in catalog

    const streams = rawStreams
      .filter((s) => s.url)
      .map((s) => {
        const hint = playabilityHint(s.url, s.status);
        return {
          url: s.url,
          status: s.status || 'unknown',
          checkedAt: s.checked_at || s.checkedAt || null,
          quality: s.quality || null,
          scheme: hint.scheme,
          likelyPlayable: hint.likelyPlayable,
        };
      })
      .sort(streamSort);

    if (streams.length === 0) continue;

    const logos = logosByChannel.get(ch.id) || [];
    const logo = ch.logo || (logos[0] && logos[0].url) || null;

    const guides = guidesByChannel.get(ch.id) || [];
    const guide = guides[0]
      ? { site: guides[0].site, siteId: guides[0].site_id, lang: guides[0].lang }
      : null;

    const feeds = feedsByChannel.get(ch.id) || [];
    const languages = [...new Set(feeds.flatMap((f) => f.languages || []))];

    records.push({
      id: ch.id,
      name: ch.name || '',
      country: normalizeCountryCode(ch.country),
      // Default to ['general'] for uncategorized channels (v1 playlistGenerator parity)
      // so they still appear under a category surface rather than vanishing.
      categories: Array.isArray(ch.categories) && ch.categories.length > 0 ? ch.categories : ['general'],
      languages,
      isNsfw: ch.is_nsfw === true,
      logo,
      guide,
      streams,
      playable: streams.some((s) => s.likelyPlayable),
    });
  }
  return records;
}

module.exports = { enrich, playabilityHint };
