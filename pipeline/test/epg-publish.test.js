'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publishEpg } = require('../src/epg/publish');
const { kvKey } = require('../src/schema');

function recordingKv() {
  const writes = [];
  return {
    writes,
    put: async (key, value) => {
      writes.push({ key, value });
    },
  };
}

const ARGS = () => ({
  shardsByCountry: {
    gb: { 'BBCOne.uk': [{ startUtcMs: 1, stopUtcMs: 2, title: 'X' }] },
    in: { 'NDTV.in': [{ startUtcMs: 3, stopUtcMs: 4, title: 'Y' }] },
  },
  coverage: { gb: 0.5, in: 0.4 },
  generatedAt: '2026-06-30T12:00:00Z',
  config: { coverageThreshold: 0.3, minAiring: 5, bracketHours: 36 },
});

test('writes every epg:<country> shard before epg-meta (no partial publish)', async () => {
  const kv = recordingKv();
  const res = await publishEpg({ ...ARGS(), kv });
  const keys = kv.writes.map((w) => w.key);
  assert.deepEqual(keys.slice(0, 2).sort(), [kvKey.epg('gb'), kvKey.epg('in')].sort());
  assert.equal(keys[keys.length - 1], kvKey.epgMeta(), 'meta written last');
  assert.equal(res.written, 3);
});

test('epg-meta carries coverage + config', async () => {
  const kv = recordingKv();
  await publishEpg({ ...ARGS(), kv });
  const meta = JSON.parse(kv.writes.find((w) => w.key === kvKey.epgMeta()).value);
  assert.deepEqual(meta.coverage, { gb: 0.5, in: 0.4 });
  assert.deepEqual(meta.config, { coverageThreshold: 0.3, minAiring: 5, bracketHours: 36 });
  assert.equal(meta.generatedAt, '2026-06-30T12:00:00Z');
});

test('a shard put rejection surfaces and does not flip meta', async () => {
  const kv = {
    writes: [],
    put: async (key, value) => {
      if (key === kvKey.epg('in')) throw new Error('kv down');
      kv.writes.push({ key, value });
    },
  };
  await assert.rejects(() => publishEpg({ ...ARGS(), kv }), /kv down/);
  assert.equal(kv.writes.find((w) => w.key === kvKey.epgMeta()), undefined, 'meta never written on failure');
});

test('purge failure is non-fatal', async () => {
  const kv = recordingKv();
  const res = await publishEpg({ ...ARGS(), kv, purge: async () => { throw new Error('purge boom'); } });
  assert.equal(res.purged, false);
  assert.equal(res.written, 3, 'publish still succeeded');
});
