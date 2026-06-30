'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEpg, normalizeName } = require('../src/epg/build');

const NOW = Date.UTC(2026, 5, 30, 14, 45, 0); // 2026-06-30 14:45 UTC

// A tiny epg.pw-style bundle: <channel id><display-name> + programmes by that id.
function bundle(channels, programmes) {
  const chans = channels.map((c) => `<channel id="${c.id}"><display-name>${c.name}</display-name></channel>`).join('');
  const progs = programmes
    .map((p) => `<programme start="${p.start}"${p.stop ? ` stop="${p.stop}"` : ''} channel="${p.ch}"><title lang="en">${p.title}</title></programme>`)
    .join('');
  return `<tv>${chans}${progs}</tv>`;
}

function baseArgs(overrides = {}) {
  return {
    channels: [
      { id: 'BBCOne.uk', name: 'BBC One', country: 'UK' },
      { id: 'SkyWitness.uk', name: 'Sky Witness', country: 'GB' },
      { id: 'NoEpg.uk', name: 'No Epg Channel', country: 'GB' },
      { id: 'Other.fr', name: 'France 2', country: 'FR' },
    ],
    coveredCountries: ['gb'],
    now: NOW,
    bracketHours: 36,
    fetchBundle: async (code) => {
      assert.equal(code, 'gb');
      return bundle(
        [
          { id: '100', name: 'BBC One HD' }, // matches "BBC One" after HD-strip
          { id: '200', name: 'Sky Witness HD' }, // matches "Sky Witness"
          { id: '999', name: 'Unmatched Channel' },
        ],
        [
          { ch: '100', start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'BBC Now' },
          { ch: '100', start: '20260630150000 +0000', stop: '20260630160000 +0000', title: 'BBC Next' },
          { ch: '200', start: '20260630140000 +0000', stop: '20260630150000 +0000', title: 'Sky Now' },
          { ch: '999', start: '20260630140000 +0000', stop: '20260630150000 +0000', title: 'Orphan' },
        ],
      );
    },
    ...overrides,
  };
}

test('normalizeName: strips quality tokens, punctuation, case', () => {
  assert.equal(normalizeName('Sky Witness HD'), 'skywitness');
  assert.equal(normalizeName('BBC One'), 'bbcone');
  assert.equal(normalizeName('That’s TV 4K'), 'thatstv');
});

test('happy path: name-matches epg.pw channels to catalog and shards by country', async () => {
  const { shardsByCountry } = await buildEpg(baseArgs());
  const gb = shardsByCountry.gb;
  assert.ok(gb['BBCOne.uk'], 'BBC One HD matched BBC One');
  assert.ok(gb['SkyWitness.uk'], 'Sky Witness HD matched Sky Witness');
  assert.equal(gb['BBCOne.uk'][0].title, 'BBC Now');
  assert.equal(gb['BBCOne.uk'][0].startUtcMs, Date.UTC(2026, 5, 30, 14, 30, 0));
});

test('an epg.pw channel with no catalog name-match is dropped (silent)', async () => {
  const { shardsByCountry } = await buildEpg(baseArgs());
  // The "Unmatched Channel" (id 999) programme never lands on any catalog channel.
  const ids = Object.keys(shardsByCountry.gb);
  assert.ok(!ids.includes('999'));
  assert.equal(shardsByCountry.gb['NoEpg.uk'], undefined, 'catalog channel with no epg match absent');
});

test('coverage: matched-with-schedule / total scope channels', async () => {
  const { coverage } = await buildEpg(baseArgs());
  // GB scope = BBCOne.uk, SkyWitness.uk, NoEpg.uk (3); 2 matched with schedules.
  assert.ok(Math.abs(coverage.gb - 2 / 3) < 1e-9, `expected 2/3, got ${coverage.gb}`);
});

test('fetchBundle called once per covered country', async () => {
  let calls = 0;
  const args = baseArgs();
  const inner = args.fetchBundle;
  args.fetchBundle = async (c) => {
    calls++;
    return inner(c);
  };
  await buildEpg(args);
  assert.equal(calls, 1);
});

test('missing stop is filled from the next programme start', async () => {
  const args = baseArgs();
  args.fetchBundle = async () =>
    bundle([{ id: '100', name: 'BBC One' }], [
      { ch: '100', start: '20260630143000 +0000', title: 'No Stop' },
      { ch: '100', start: '20260630150000 +0000', stop: '20260630160000 +0000', title: 'Has Start' },
    ]);
  const { shardsByCountry } = await buildEpg(args);
  const progs = shardsByCountry.gb['BBCOne.uk'];
  assert.equal(progs[0].stopUtcMs, progs[1].startUtcMs);
});

test('bracket window keeps a boundary-spanning programme, drops far-outside ones', async () => {
  const args = baseArgs();
  args.fetchBundle = async () =>
    bundle([{ id: '100', name: 'BBC One' }], [
      { ch: '100', start: '20260625000000 +0000', stop: '20260625010000 +0000', title: 'Way Before' },
      { ch: '100', start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'Now' },
      { ch: '100', start: '20260720000000 +0000', stop: '20260720010000 +0000', title: 'Way After' },
    ]);
  const { shardsByCountry } = await buildEpg(args);
  assert.deepEqual(shardsByCountry.gb['BBCOne.uk'].map((p) => p.title), ['Now']);
});

test('error path: a failing region is skipped, others still build', async () => {
  const args = baseArgs();
  args.coveredCountries = ['gb', 'fr'];
  const inner = args.fetchBundle;
  args.fetchBundle = async (code) => {
    if (code === 'fr') throw new Error('boom');
    return inner('gb');
  };
  const { shardsByCountry, coverage } = await buildEpg(args);
  assert.ok(shardsByCountry.gb['BBCOne.uk'], 'GB still built despite FR failure');
  assert.equal(coverage.fr, 0);
});

test('only covered countries are processed', async () => {
  const { shardsByCountry } = await buildEpg(baseArgs());
  assert.equal(shardsByCountry.fr, undefined);
});

test('a null bundle (no data) yields zero coverage and no shard (prior preserved)', async () => {
  const args = baseArgs({ fetchBundle: async () => null });
  const { shardsByCountry, coverage, fetched } = await buildEpg(args);
  assert.equal(shardsByCountry.gb, undefined, 'no shard written → publish leaves any prior shard');
  assert.equal(coverage.gb, 0);
  assert.deepEqual(fetched, [], 'a null bundle is not counted as fetched');
});

test('a fetched-but-empty region records an empty shard (clears stale data)', async () => {
  // Bundle has a channel that matches nothing in the catalog.
  const args = baseArgs({ fetchBundle: async () => bundle([{ id: '1', name: 'Totally Unknown' }], []) });
  const { shardsByCountry, fetched } = await buildEpg(args);
  assert.deepEqual(shardsByCountry.gb, {}, 'empty shard written so the publish overwrites stale');
  assert.deepEqual(fetched, ['gb']);
});

test('HD/SD epg variants dedupe to one catalog channel (no doubled listings)', async () => {
  const args = baseArgs({
    channels: [{ id: 'BBCOne.uk', name: 'BBC One', country: 'GB' }],
    fetchBundle: async () =>
      bundle(
        [
          { id: '100', name: 'BBC One' },
          { id: '101', name: 'BBC One HD' }, // same normalized name → must NOT also map
        ],
        [
          { ch: '100', start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'A' },
          { ch: '101', start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'A (HD dupe)' },
        ],
      ),
  });
  const { shardsByCountry } = await buildEpg(args);
  assert.equal(shardsByCountry.gb['BBCOne.uk'].length, 1, 'only the first epg variant is mapped');
});
