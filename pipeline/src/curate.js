'use strict';
/**
 * U4 — Curate gate (origin R3, R14, R15): turn the enriched model into a SFW,
 * sanitized, blocklist-compliant, deduped catalog. Pure function for testability.
 *
 * Also returns droppedFilterIds — the channel ids removed *because* we filtered
 * them (NSFW/keyword/blocklist). The anomaly gate intersects this with the set of
 * baseline ids that disappeared, so a blocklist/NSFW spike never masks an
 * unrelated mass removal (identity-based fast-path, not raw count deltas).
 */
const { DEAD_STATUS, toStorageCategorySlug } = require('./schema');
const { sanitizeText, sanitizeUrl } = require('./sanitize');

const ADULT_CATEGORY_IDS = new Set(['xxx', 'adult']);

/** Secondary NSFW keyword gate (R15) — defends against unflagged adult entries. */
const DEFAULT_NSFW_KEYWORDS = [
  'porn', 'porno', 'xxx', 'adult', 'erotic', 'erotik', 'playboy', 'brazzers',
  'hustler', 'nude', 'naked', 'webcam', 'camgirl', 'hentai', 'milf', 'sexshop',
];

function buildKeywordRegex(keywords) {
  return new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
}

/**
 * @param {Array<object>} records  enriched channel records
 * @param {{ blocklist?: any[], nsfwKeywords?: string[] }} opts
 * @returns {{ kept: Array<object>, stats: object, droppedFilterIds: string[] }}
 */
function curate(records, opts = {}) {
  const blocklist = opts.blocklist || [];
  const keywordRe = buildKeywordRegex(opts.nsfwKeywords || DEFAULT_NSFW_KEYWORDS);
  const blocked = new Set(blocklist.map((b) => b.channel).filter(Boolean));

  const stats = {
    input: records.length,
    kept: 0,
    droppedNsfw: 0,
    droppedKeyword: 0,
    droppedBlocklist: 0,
    droppedDead: 0,
  };
  const kept = [];
  const droppedFilterIds = [];

  for (const r of records) {
    // sanitize first so downstream checks + storage are clean (R14)
    const name = sanitizeText(r.name);
    const logo = sanitizeUrl(r.logo);
    const categories = (r.categories || []).map(toStorageCategorySlug).filter(Boolean);
    const languages = (r.languages || []).map(sanitizeText).filter(Boolean);
    const guide = r.guide
      ? { site: sanitizeText(r.guide.site), siteId: sanitizeText(r.guide.siteId), lang: sanitizeText(r.guide.lang) }
      : null;
    const seen = new Set();
    const streams = r.streams
      .map((s) => ({ ...s, url: sanitizeUrl(s.url) }))
      .filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)); // drop bad-scheme + dup URLs

    const rec = { ...r, name, logo, categories, languages, guide, streams };
    const haystack = `${name} ${streams.map((s) => s.url).join(' ')}`;

    if (rec.isNsfw || categories.some((c) => ADULT_CATEGORY_IDS.has(c))) {
      stats.droppedNsfw++;
      droppedFilterIds.push(rec.id);
      continue;
    }
    if (keywordRe.test(haystack)) {
      stats.droppedKeyword++;
      droppedFilterIds.push(rec.id);
      continue;
    }
    if (blocked.has(rec.id)) {
      stats.droppedBlocklist++;
      droppedFilterIds.push(rec.id);
      continue;
    }
    if (streams.length === 0 || streams.every((s) => DEAD_STATUS.has(s.status))) {
      stats.droppedDead++;
      continue;
    }

    kept.push(rec);
  }

  stats.kept = kept.length;
  return { kept, stats, droppedFilterIds };
}

module.exports = { curate, DEFAULT_NSFW_KEYWORDS };
