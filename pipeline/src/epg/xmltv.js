'use strict';
/**
 * U1 — XMLTV parse + UTC normalization (EPG, origin R1, R3).
 *
 * Zero-dependency by design: the pipeline runs on Node built-ins with no install
 * step (see .github/workflows/ci.yml), so rather than pull in an XML parser we
 * extract the regular <programme> structure that XMLTV grabbers emit. Pure
 * functions over a string so they are fully unit-testable with fixtures.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decode the XML entities XMLTV text can carry (named + numeric). */
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body] != null ? ENTITIES[body] : m;
  });
}

/**
 * Parse an XMLTV timestamp ("YYYYMMDDHHMMSS +HHMM") to an absolute UTC instant
 * in ms, or null when it can't be resolved. The offset is REQUIRED — a missing
 * offset is ambiguous (many feeds mean local time), so we refuse to guess UTC.
 */
function parseXmltvTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-])(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  // Treat the wall-clock components as UTC, then subtract the zone offset to get
  // the true UTC instant. (+0500 means 5h ahead of UTC → subtract 5h.)
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const offsetMs = (sign === '-' ? -1 : 1) * (+oh * 60 + +om) * 60000;
  return wall - offsetMs;
}

/** Pick the best <title> text for a requested language: lang → 'en' → first. */
function pickTitle(titles, lang) {
  if (titles.length === 0) return null;
  const byLang = lang && titles.find((t) => t.lang === lang);
  if (byLang) return byLang.text;
  const en = titles.find((t) => t.lang === 'en');
  return (en || titles[0]).text;
}

const CHANNEL_RE = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/g;
const DISPLAY_NAME_RE = /<display-name\b[^>]*>([\s\S]*?)<\/display-name>/;

const PROGRAMME_RE = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
const ATTR_RE = /(\w[\w-]*)="([^"]*)"/g;
const TITLE_RE = /<title\b([^>]*)>([\s\S]*?)<\/title>/g;
const TAG_RE = (tag) => new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);

function attrs(s) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(s))) out[m[1]] = m[2];
  return out;
}

/**
 * Parse the `<channel id><display-name>` map from an XMLTV document.
 * Source feeds (e.g. epg.pw) key programmes by their own channel id, so we need
 * the id→name map to bridge those ids to our catalog by channel name.
 * @returns {Array<{id:string, name:string}>}
 */
function parseXmltvChannels(doc) {
  if (typeof doc !== 'string' || doc.length === 0) return [];
  const out = [];
  let cm;
  CHANNEL_RE.lastIndex = 0;
  while ((cm = CHANNEL_RE.exec(doc))) {
    const id = attrs(cm[1]).id;
    if (!id) continue;
    const nameM = cm[2].match(DISPLAY_NAME_RE);
    out.push({ id, name: nameM ? decodeEntities(nameM[1]).trim() : '' });
  }
  return out;
}

/**
 * Parse an XMLTV document into normalized programmes. A programme whose start
 * can't resolve to an absolute UTC instant is DROPPED (silent degradation,
 * origin R7) rather than rendered with a wrong time.
 *
 * @param {string} doc            XMLTV text
 * @param {{lang?: string}} [opts] preferred title language
 * @returns {Array<{sourceChannelId:string,startUtcMs:number,stopUtcMs:number|null,title:string|null,desc?:string,category?:string}>}
 */
function parseXmltv(doc, opts = {}) {
  if (typeof doc !== 'string' || doc.length === 0) return [];
  const out = [];
  let pm;
  PROGRAMME_RE.lastIndex = 0;
  while ((pm = PROGRAMME_RE.exec(doc))) {
    const a = attrs(pm[1]);
    const body = pm[2];

    const startUtcMs = parseXmltvTime(a.start);
    if (startUtcMs == null) continue; // unresolvable time → drop, never guess
    const stopUtcMs = a.stop ? parseXmltvTime(a.stop) : null;

    const titles = [];
    let tm;
    TITLE_RE.lastIndex = 0;
    while ((tm = TITLE_RE.exec(body))) {
      titles.push({ lang: attrs(tm[1]).lang || null, text: decodeEntities(tm[2]).trim() });
    }

    const descM = body.match(TAG_RE('desc'));
    const catM = body.match(TAG_RE('category'));

    const rec = {
      sourceChannelId: a.channel || '',
      startUtcMs,
      stopUtcMs,
      title: pickTitle(titles, opts.lang),
    };
    if (descM) rec.desc = decodeEntities(descM[1]).trim();
    if (catM) rec.category = decodeEntities(catM[1]).trim();
    out.push(rec);
  }
  return out;
}

module.exports = { parseXmltv, parseXmltvChannels, parseXmltvTime, decodeEntities };
