'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runEpg } = require('../src/epg/run');
const { ENDPOINTS, kvKey } = require('../src/schema');

const NOW = Date.UTC(2026, 5, 30, 14, 45, 0);

function deps(overrides = {}) {
  const fetchJson = async (url) => {
    if (url === ENDPOINTS.channels) return [{ id: 'BBCOne.uk', name: 'BBC One', country: 'GB' }];
    throw new Error(`unexpected json url ${url}`);
  };
  const fetchBundle = async (code) => {
    assert.equal(code, 'gb');
    return '<tv><channel id="100"><display-name>BBC One HD</display-name></channel>' +
      '<programme start="20260630143000 +0000" stop="20260630150000 +0000" channel="100"><title lang="en">Now</title></programme></tv>';
  };
  return { fetchJson, fetchBundle, coveredCountries: ['gb'], now: NOW, generatedAt: '2026-06-30T12:00:00Z', ...overrides };
}

test('runEpg dry-run (no kv) builds shards + coverage, publishes nothing', async () => {
  const res = await runEpg(deps());
  assert.ok(res.shardsByCountry.gb['BBCOne.uk']);
  assert.equal(res.coverage.gb, 1);
  assert.equal(res.publish, null);
});

test('runEpg with a kv client publishes shards then meta', async () => {
  const writes = [];
  const kv = { put: async (key, value) => writes.push({ key, value }) };
  const res = await runEpg(deps({ kv }));
  assert.ok(res.publish.written >= 2);
  assert.equal(writes[0].key, kvKey.epg('gb'));
  assert.equal(writes[writes.length - 1].key, kvKey.epgMeta());
});

test('runEpg skips publish on a degenerate (empty) result — protects prior guide', async () => {
  const writes = [];
  const kv = { put: async (key, value) => writes.push({ key, value }) };
  // Bundle matches nothing → channelCount 0 → must NOT publish.
  const res = await runEpg(deps({ kv, fetchBundle: async () => '<tv><channel id="9"><display-name>Nope</display-name></channel></tv>' }));
  assert.equal(res.skipped, true);
  assert.equal(res.publish, null);
  assert.equal(writes.length, 0, 'nothing written — previous guide preserved');
});

test('runEpg rejects a non-array channels.json (clear failure, not a TypeError)', async () => {
  await assert.rejects(
    () => runEpg(deps({ fetchJson: async () => ({ not: 'an array' }) })),
    /did not return an array/,
  );
});
