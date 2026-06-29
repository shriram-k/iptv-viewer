'use strict';
/**
 * U6 — Build the sharded snapshot and write it to disk (origin R4, R5).
 *
 * buildShards is pure (version + generatedAt injected) so it is fully testable;
 * writeSnapshot is the thin fs side-effect. Country shards hold the authoritative
 * full channel records; category shards hold lightweight {id, country} refs that
 * resolve via the channel-index — avoiding full-record duplication across shards.
 */
const fs = require('fs');
const path = require('path');

/** Strip internal pipeline fields; keep what the runtime needs. */
function publicChannel(r) {
  return {
    id: r.id,
    name: r.name,
    country: r.country || null,
    categories: r.categories,
    languages: r.languages,
    logo: r.logo || null,
    guide: r.guide || null,
    playable: r.playable,
    streams: r.streams.map((s) => ({
      url: s.url,
      status: s.status,
      checkedAt: s.checkedAt || null,
      scheme: s.scheme,
      likelyPlayable: s.likelyPlayable,
      quality: s.quality || null,
    })),
  };
}

/**
 * @param {Array<object>} records  curated channel records
 * @param {{ version: string|number, generatedAt: string }} opts
 */
function buildShards(records, opts) {
  const countries = {};
  const categories = {};
  const channelIndex = {};

  for (const r of records) {
    const ch = publicChannel(r);
    const code = (ch.country || 'unknown').toLowerCase();
    (countries[code] = countries[code] || []).push(ch);

    for (const cat of ch.categories) {
      const slug = String(cat).toLowerCase();
      (categories[slug] = categories[slug] || []).push({ id: ch.id, country: code });
    }

    channelIndex[ch.id] = { country: code, categories: ch.categories, name: ch.name };
  }

  const meta = {
    version: opts.version,
    generatedAt: opts.generatedAt,
    counts: {
      channels: records.length,
      countries: Object.keys(countries).length,
      categories: Object.keys(categories).length,
    },
  };

  return { meta, countries, categories, channelIndex };
}

/** Write shards under <dir> as country/<code>.json, category/<slug>.json, channel-index.json, meta.json. */
function writeSnapshot(shards, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'country'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'category'), { recursive: true });

  for (const [code, list] of Object.entries(shards.countries)) {
    fs.writeFileSync(path.join(dir, 'country', `${code}.json`), JSON.stringify(list));
  }
  for (const [slug, list] of Object.entries(shards.categories)) {
    fs.writeFileSync(path.join(dir, 'category', `${slug}.json`), JSON.stringify(list));
  }
  fs.writeFileSync(path.join(dir, 'channel-index.json'), JSON.stringify(shards.channelIndex));
  // meta written LAST so a consumer never sees a half-updated tree advertised as ready.
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(shards.meta, null, 2));
}

module.exports = { buildShards, writeSnapshot, publicChannel };
