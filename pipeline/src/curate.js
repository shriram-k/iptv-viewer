'use strict';
/**
 * U4 — Curate gate (origin R3, R14, R15): turn the enriched model into a SFW,
 * sanitized, blocklist-compliant, deduped catalog. Pure function for testability.
 */
const { sanitizeText, sanitizeUrl } = require('./sanitize');

const ADULT_CATEGORY_IDS = new Set(['xxx', 'adult']);
const HARD_DEAD_STATUS = new Set(['error', 'timeout', 'blocked', 'offline']);

/** Secondary NSFW keyword gate (R15) — defends against unflagged adult entries. */
const DEFAULT_NSFW_KEYWORDS = [
  'porn', 'porno', 'xxx', 'adult', 'erotic', 'erotik', 'playboy', 'brazzers',
  'hustler', 'nude', 'naked', 'webcam', 'camgirl', 'hentai', 'milf', 'sexshop',
];

function matchesNsfwKeyword(record, keywords) {
  const haystack = (record.name + ' ' + record.streams.map((s) => s.url).join(' ')).toLowerCase();
  return keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(haystack));
}

/**
 * @param {Array<object>} records  enriched channel records
 * @param {{ blocklist?: any[], nsfwKeywords?: string[] }} opts
 * @returns {{ kept: Array<object>, stats: object }}
 */
function curate(records, opts = {}) {
  const blocklist = opts.blocklist || [];
  const keywords = opts.nsfwKeywords || DEFAULT_NSFW_KEYWORDS;
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

  for (const r of records) {
    // sanitize first so downstream checks + storage are clean (R14)
    const name = sanitizeText(r.name);
    const logo = sanitizeUrl(r.logo);
    const seen = new Set();
    const streams = r.streams
      .map((s) => ({ ...s, url: sanitizeUrl(s.url) }))
      .filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)); // drop bad-scheme + dup URLs

    const rec = { ...r, name, logo, streams };

    if (rec.isNsfw || rec.categories.some((c) => ADULT_CATEGORY_IDS.has(c))) {
      stats.droppedNsfw++;
      continue;
    }
    if (matchesNsfwKeyword(rec, keywords)) {
      stats.droppedKeyword++;
      continue;
    }
    if (blocked.has(rec.id)) {
      stats.droppedBlocklist++;
      continue;
    }
    if (rec.streams.length === 0 || rec.streams.every((s) => HARD_DEAD_STATUS.has(s.status))) {
      stats.droppedDead++;
      continue;
    }

    kept.push(rec);
  }

  stats.kept = kept.length;
  return { kept, stats };
}

module.exports = { curate, DEFAULT_NSFW_KEYWORDS };
