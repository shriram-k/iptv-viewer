'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline } = require('../src/run');

// Build a fetchJson that serves fixture datasets keyed by endpoint name.
function makeFetch(channels) {
  const streams = channels.map((c) => ({ channel: c.id, url: 'https://s/' + c.id + '.m3u8', status: 'online' }));
  const data = { channels, streams, feeds: [], logos: [], categories: [], countries: [], languages: [], regions: [], blocklist: [], guides: [] };
  return async (url) => {
    const name = Object.keys(data).find((n) => url.includes(`/${n}.json`));
    return data[name];
  };
}
function chans(n, country = 'US') {
  return Array.from({ length: n }, (_, i) => ({ id: `${country}-${i}`, name: `Ch ${i}`, country, categories: ['news'], is_nsfw: false }));
}
const v = { version: 1, generatedAt: '2026-06-28T00:00:00Z' };

test('normal run publishes to KV and persists shards', async () => {
  const candidate = chans(10);
  const baseline = candidate.map((c) => ({ id: c.id, country: 'us' }));
  let persisted = false;
  const kv = { puts: [], async put(k) { this.puts.push(k); } };
  const res = await runPipeline({
    fetchJson: makeFetch(candidate), baseline, baselineStats: { droppedBlocklist: 0, droppedNsfw: 0, droppedKeyword: 0 },
    ...v, persist: async () => { persisted = true; }, kv,
  });
  assert.equal(res.action, 'published');
  assert.equal(persisted, true);
  assert.ok(kv.puts.includes('meta'), 'published path writes to KV');
});

test('anomaly run opens a PR and does NOT publish to KV', async () => {
  const baseline = chans(100).map((c) => ({ id: c.id, country: 'us' }));
  const candidate = chans(5); // 95% removed → anomaly
  const kv = { puts: [], async put(k) { this.puts.push(k); } };
  const res = await runPipeline({
    fetchJson: makeFetch(candidate), baseline, baselineStats: { droppedBlocklist: 0, droppedNsfw: 0, droppedKeyword: 0 },
    ...v, persist: async () => {}, kv,
  });
  assert.equal(res.action, 'anomaly-pr');
  assert.ok(res.anomaly.reasons.length > 0);
  assert.equal(kv.puts.length, 0, 'anomaly path must not publish to KV');
});

test('first run (no baseline) publishes and seeds', async () => {
  const candidate = chans(10);
  const kv = { puts: [], async put(k) { this.puts.push(k); } };
  const res = await runPipeline({ fetchJson: makeFetch(candidate), baseline: null, ...v, persist: async () => {}, kv });
  assert.equal(res.action, 'published');
  assert.deepEqual(res.anomaly.reasons, ['baseline-seed']);
});
