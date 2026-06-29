'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publishSnapshot } = require('../src/publish-kv');
const { buildShards } = require('../src/snapshot');

function rec(id, country, categories) {
  return {
    id, name: id, country, categories, languages: [], logo: null, guide: null, playable: true,
    streams: [{ url: 'https://s/a', status: 'online', checkedAt: null, scheme: 'https', likelyPlayable: true, quality: null }],
  };
}
const shards = buildShards([rec('A', 'GB', ['news']), rec('B', 'IN', ['movies'])], { version: 5, generatedAt: '2026-06-28T00:00:00Z' });

function mockKv() {
  const store = new Map();
  const order = [];
  return { store, order, async put(k, v) { order.push(k); store.set(k, v); } };
}

test('happy: writes country/category/index/meta keys with new version', async () => {
  const kv = mockKv();
  const res = await publishSnapshot({ shards, kv });
  assert.equal(kv.store.has('country:gb'), true);
  assert.equal(kv.store.has('category:movies'), true);
  assert.equal(kv.store.has('channel-index'), true);
  assert.equal(JSON.parse(kv.store.get('meta')).version, 5);
  assert.equal(res.written, 6); // gb, in, news, movies, channel-index, meta
});

test('meta is written LAST (no half-updated keyspace advertised)', async () => {
  const kv = mockKv();
  await publishSnapshot({ shards, kv });
  assert.equal(kv.order[kv.order.length - 1], 'meta', 'meta key written last');
});

test('integration: purge hook fires after a successful publish', async () => {
  const kv = mockKv();
  let purgeCalled = 0;
  const res = await publishSnapshot({ shards, kv, purge: async () => { purgeCalled++; } });
  assert.equal(purgeCalled, 1);
  assert.equal(res.purged, true);
});

test('error: a KV write failure aborts before meta is written', async () => {
  const kv = mockKv();
  const failing = { put: async (k, v) => { if (k === 'channel-index') throw new Error('KV down'); return kv.put(k, v); } };
  await assert.rejects(() => publishSnapshot({ shards, kv: failing }), /KV down/);
  assert.equal(kv.store.has('meta'), false, 'meta not advanced on failure');
});

test('edge: re-publishing the same version is idempotent', async () => {
  const kv = mockKv();
  await publishSnapshot({ shards, kv });
  const first = new Map(kv.store);
  await publishSnapshot({ shards, kv });
  assert.deepEqual([...kv.store.entries()], [...first.entries()]);
});
