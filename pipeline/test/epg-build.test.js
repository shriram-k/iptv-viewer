'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEpg } = require('../src/epg/build');

const NOW = Date.UTC(2026, 5, 30, 14, 45, 0); // 2026-06-30 14:45 UTC

// A tiny XMLTV doc generator keyed by the source channel id.
function xmltv(channelId, programmes) {
  const body = programmes
    .map((p) => `<programme start="${p.start}"${p.stop ? ` stop="${p.stop}"` : ''} channel="${channelId}"><title lang="en">${p.title}</title></programme>`)
    .join('');
  return `<tv>${body}</tv>`;
}

function baseArgs(overrides = {}) {
  return {
    channels: [
      { id: 'BBCOne.uk', country: 'UK' },
      { id: 'ITV.uk', country: 'GB' },
      { id: 'NoGuide.uk', country: 'GB' },
      { id: 'Other.fr', country: 'FR' },
    ],
    guides: [
      { channel: 'BBCOne.uk', site: 'epg.pw', site_id: 'bbc1', lang: 'en', sources: [{ host: 'epg.pw', url: 'https://epg.pw/epg_GB.xml', format: 'XML' }] },
      { channel: 'ITV.uk', site: 'epg.pw', site_id: 'itv1', lang: 'en', sources: [{ host: 'epg.pw', url: 'https://epg.pw/epg_GB.xml', format: 'XML' }] },
    ],
    coveredCountries: ['gb'],
    now: NOW,
    bracketHours: 36,
    fetchText: async (url) => {
      assert.equal(url, 'https://epg.pw/epg_GB.xml');
      // One regional bundle keyed by site_id, serving both channels.
      return (
        xmltv('bbc1', [
          { start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'BBC Now' },
          { start: '20260630150000 +0000', stop: '20260630160000 +0000', title: 'BBC Next' },
        ]) +
        xmltv('itv1', [{ start: '20260630140000 +0000', stop: '20260630150000 +0000', title: 'ITV Now' }])
      ).replace(/<\/?tv>/g, '');
    },
  };
}

test('happy path: maps programmes via site_id and shards by country', async () => {
  const { shardsByCountry } = await buildEpg(baseArgs());
  const gb = shardsByCountry.gb;
  assert.ok(gb['BBCOne.uk'], 'BBC mapped via site_id bbc1');
  assert.ok(gb['ITV.uk'], 'ITV mapped via site_id itv1');
  assert.equal(gb['BBCOne.uk'][0].title, 'BBC Now');
  assert.equal(gb['BBCOne.uk'][0].startUtcMs, Date.UTC(2026, 5, 30, 14, 30, 0));
});

test('dedup: a shared source URL is fetched exactly once', async () => {
  let calls = 0;
  const args = baseArgs();
  const inner = args.fetchText;
  args.fetchText = async (url) => {
    calls++;
    return inner(url);
  };
  await buildEpg(args);
  assert.equal(calls, 1, 'both channels share one URL → one fetch');
});

test('coverage: fraction of scope channels with a schedule', async () => {
  const { coverage } = await buildEpg(baseArgs());
  // GB scope has 3 channels (ITV.uk, NoGuide.uk, BBCOne.uk after UK→GB); 2 have schedules.
  assert.ok(Math.abs(coverage.gb - 2 / 3) < 1e-9, `expected 2/3, got ${coverage.gb}`);
});

test('missing stop is filled from the next programme start', async () => {
  const args = baseArgs();
  args.fetchText = async () =>
    xmltv('bbc1', [
      { start: '20260630143000 +0000', title: 'No Stop' },
      { start: '20260630150000 +0000', stop: '20260630160000 +0000', title: 'Has Start' },
    ]).replace(/<\/?tv>/g, '');
  const { shardsByCountry } = await buildEpg(args);
  const progs = shardsByCountry.gb['BBCOne.uk'];
  assert.equal(progs[0].stopUtcMs, progs[1].startUtcMs, 'filled from next start');
});

test('a channel with no guide entry is absent from the shard (silent degradation)', async () => {
  const { shardsByCountry } = await buildEpg(baseArgs());
  assert.equal(shardsByCountry.gb['NoGuide.uk'], undefined);
});

test('bracket window keeps a boundary-spanning programme, drops far-outside ones', async () => {
  const args = baseArgs();
  args.fetchText = async () =>
    xmltv('bbc1', [
      { start: '20260625000000 +0000', stop: '20260625010000 +0000', title: 'Way Before' },
      { start: '20260630143000 +0000', stop: '20260630150000 +0000', title: 'Now' },
      { start: '20260720000000 +0000', stop: '20260720010000 +0000', title: 'Way After' },
    ]).replace(/<\/?tv>/g, '');
  const { shardsByCountry } = await buildEpg(args);
  const titles = shardsByCountry.gb['BBCOne.uk'].map((p) => p.title);
  assert.deepEqual(titles, ['Now'], 'only the in-window programme survives');
});

test('error path: a failing source URL is skipped, others still build', async () => {
  const args = baseArgs();
  args.guides.push({ channel: 'Other.fr', site: 'epg.pw', site_id: 'o1', lang: 'fr', sources: [{ host: 'epg.pw', url: 'https://epg.pw/epg_FR.xml', format: 'XML' }] });
  args.coveredCountries = ['gb', 'fr'];
  const inner = args.fetchText;
  args.fetchText = async (url) => {
    if (url.includes('FR')) throw new Error('boom');
    return inner(url);
  };
  const { shardsByCountry, coverage } = await buildEpg(args);
  assert.ok(shardsByCountry.gb['BBCOne.uk'], 'GB still built despite FR failure');
  assert.equal(coverage.fr, 0, 'FR scope ends up with no coverage, not a crash');
});

test('only covered countries are processed', async () => {
  const args = baseArgs();
  // FR guide present but FR not covered → never fetched.
  args.guides.push({ channel: 'Other.fr', site: 'epg.pw', site_id: 'o1', lang: 'fr', sources: [{ host: 'epg.pw', url: 'https://epg.pw/epg_FR.xml', format: 'XML' }] });
  const { shardsByCountry } = await buildEpg(args);
  assert.equal(shardsByCountry.fr, undefined);
});
