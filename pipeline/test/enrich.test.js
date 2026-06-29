'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enrich, playabilityHint } = require('../src/enrich');
const { ingest } = require('../src/ingest');

function fixture(overrides = {}) {
  return {
    channels: [
      { id: 'BBCNews.uk', name: 'BBC News', country: 'UK', categories: ['news'], is_nsfw: false },
      { id: 'NoStreams.us', name: 'No Streams', country: 'US', categories: ['general'] },
    ],
    streams: [
      { channel: 'BBCNews.uk', url: 'http://insecure.example/a.m3u8', status: 'online' },
      { channel: 'BBCNews.uk', url: 'https://cdn.example/b.m3u8', status: 'online' },
      { channel: 'BBCNews.uk', url: 'https://dead.example/c.m3u8', status: 'error' },
    ],
    feeds: [{ channel: 'BBCNews.uk', languages: ['eng'] }],
    logos: [{ channel: 'BBCNews.uk', url: 'https://logos.example/bbc.png' }],
    guides: [{ channel: 'BBCNews.uk', site: 'example.com', site_id: 'bbc', lang: 'en' }],
    ...overrides,
  };
}

test('happy path: enriches a channel with status, logo, guide, languages', () => {
  const [rec] = enrich(fixture());
  assert.equal(rec.id, 'BBCNews.uk');
  assert.equal(rec.country, 'GB', 'UK normalizes to GB');
  assert.equal(rec.logo, 'https://logos.example/bbc.png');
  assert.deepEqual(rec.guide, { site: 'example.com', siteId: 'bbc', lang: 'en' });
  assert.deepEqual(rec.languages, ['eng']);
  assert.equal(rec.playable, true);
});

test('edge: streams ordered playable-first (https + live before http and dead)', () => {
  const [rec] = enrich(fixture());
  assert.equal(rec.streams.length, 3, 'all URLs retained');
  assert.equal(rec.streams[0].url, 'https://cdn.example/b.m3u8', 'https+online first');
  assert.equal(rec.streams[0].likelyPlayable, true);
  // the http and the dead-https stream are both not-likely-playable
  assert.equal(rec.streams[1].likelyPlayable, false);
  assert.equal(rec.streams[2].likelyPlayable, false);
});

test('edge: channel with no streams is excluded from the catalog', () => {
  const recs = enrich(fixture());
  assert.equal(recs.length, 1);
  assert.equal(recs.find((r) => r.id === 'NoStreams.us'), undefined);
});

test('edge: stream referencing an unknown channel is naturally ignored', () => {
  const recs = enrich(fixture({
    streams: [{ channel: 'Ghost.zz', url: 'https://x.example/x.m3u8', status: 'online' }],
  }));
  assert.equal(recs.length, 0);
});

test('edge: channel missing country does not crash', () => {
  const recs = enrich(fixture({
    channels: [{ id: 'X.x', name: 'X', categories: [] }],
    streams: [{ channel: 'X.x', url: 'https://x.example/x.m3u8', status: 'online' }],
  }));
  assert.equal(recs.length, 1);
  assert.equal(recs[0].country, undefined);
});

test('playabilityHint: http is never likely-playable; dead status disqualifies https', () => {
  assert.equal(playabilityHint('http://x/y.m3u8', 'online').likelyPlayable, false);
  assert.equal(playabilityHint('https://x/y.m3u8', 'online').likelyPlayable, true);
  assert.equal(playabilityHint('https://x/y.m3u8', 'error').likelyPlayable, false);
});

test('ingest: a failing endpoint rejects the whole ingest (hard error)', async () => {
  const failingFetch = async (url) => {
    if (url.includes('channels')) throw new Error('HTTP 500');
    return [];
  };
  await assert.rejects(() => ingest(failingFetch), /HTTP 500/);
});

test('ingest: a non-array endpoint payload is rejected', async () => {
  const badFetch = async (url) => (url.includes('streams') ? { not: 'an array' } : []);
  await assert.rejects(() => ingest(badFetch), /did not return an array/);
});
