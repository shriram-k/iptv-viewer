'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildShards, writeSnapshot } = require('../src/snapshot');

function rec(id, country, categories) {
  return {
    id, name: `Name ${id}`, country, categories, languages: ['eng'],
    logo: 'https://l/x.png', guide: null, playable: true,
    streams: [{ url: 'https://s/a.m3u8', status: 'online', checkedAt: null, scheme: 'https', likelyPlayable: true, quality: null }],
  };
}

const opts = { version: 3, generatedAt: '2026-06-28T00:00:00Z' };

test('Covers AE5: builds per-country + per-category shards, channel-index, and meta', () => {
  const shards = buildShards([rec('A', 'GB', ['news']), rec('B', 'GB', ['movies']), rec('C', 'IN', ['news'])], opts);
  assert.deepEqual(Object.keys(shards.countries).sort(), ['gb', 'in']);
  assert.equal(shards.countries.gb.length, 2);
  assert.deepEqual(Object.keys(shards.categories).sort(), ['movies', 'news']);
  assert.equal(shards.categories.news.length, 2);
  assert.equal(shards.meta.counts.channels, 3);
  assert.equal(shards.meta.version, 3);
});

test('channel in multiple categories appears in each category shard, resolvable via index', () => {
  const shards = buildShards([rec('M', 'US', ['news', 'sports'])], opts);
  assert.ok(shards.categories.news.some((x) => x.id === 'M'));
  assert.ok(shards.categories.sports.some((x) => x.id === 'M'));
  assert.deepEqual(shards.channelIndex.M.categories, ['news', 'sports']);
  assert.equal(shards.channelIndex.M.country, 'us');
});

test('country shard holds full channel records (streams + logo)', () => {
  const shards = buildShards([rec('A', 'GB', ['news'])], opts);
  const ch = shards.countries.gb[0];
  assert.equal(ch.streams[0].url, 'https://s/a.m3u8');
  assert.equal(ch.logo, 'https://l/x.png');
});

test('writeSnapshot persists the tree with meta last', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  const shards = buildShards([rec('A', 'GB', ['news'])], opts);
  writeSnapshot(shards, dir);
  assert.ok(fs.existsSync(path.join(dir, 'country', 'gb.json')));
  assert.ok(fs.existsSync(path.join(dir, 'category', 'news.json')));
  assert.ok(fs.existsSync(path.join(dir, 'channel-index.json')));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.counts.channels, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
