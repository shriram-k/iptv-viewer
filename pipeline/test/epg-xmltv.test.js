'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseXmltvTime, parseXmltv } = require('../src/epg/xmltv');

// --- Time normalization (the silent-failure epicenter — tested first) --------

test('parseXmltvTime: UTC offset is the identity', () => {
  // 2026-06-30 14:30:00 +0000 → that exact instant.
  assert.equal(parseXmltvTime('20260630143000 +0000'), Date.UTC(2026, 5, 30, 14, 30, 0));
});

test('parseXmltvTime: a positive offset shifts earlier in UTC', () => {
  // 14:30 +0500 is 09:30 UTC (offset is wall-clock-from-UTC).
  assert.equal(parseXmltvTime('20260630143000 +0500'), Date.UTC(2026, 5, 30, 9, 30, 0));
});

test('parseXmltvTime: a negative offset shifts later in UTC', () => {
  // 14:30 -0500 is 19:30 UTC.
  assert.equal(parseXmltvTime('20260630143000 -0500'), Date.UTC(2026, 5, 30, 19, 30, 0));
});

test('parseXmltvTime: half-hour offset (e.g. +0530 India)', () => {
  assert.equal(parseXmltvTime('20260630143000 +0530'), Date.UTC(2026, 5, 30, 9, 0, 0));
});

test('parseXmltvTime: missing offset returns null (do not assume UTC)', () => {
  assert.equal(parseXmltvTime('20260630143000'), null);
});

test('parseXmltvTime: malformed input returns null', () => {
  assert.equal(parseXmltvTime('not-a-time'), null);
  assert.equal(parseXmltvTime(''), null);
  assert.equal(parseXmltvTime(undefined), null);
});

test('parseXmltvTime: DST-day instant with explicit offset resolves without double-shift', () => {
  // A US Eastern spring-forward day; the offset in the string is authoritative.
  // 2026-03-08 01:30:00 -0500 → 06:30 UTC, regardless of local DST rules.
  assert.equal(parseXmltvTime('20260308013000 -0500'), Date.UTC(2026, 2, 8, 6, 30, 0));
});

// --- Programme parsing --------------------------------------------------------

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="bbcone.uk"><display-name>BBC One</display-name></channel>
  <programme start="20260630143000 +0000" stop="20260630150000 +0000" channel="bbcone.uk">
    <title lang="en">News at Six</title>
    <desc lang="en">The day&apos;s headlines &amp; more.</desc>
    <category lang="en">News</category>
  </programme>
  <programme start="20260630150000 +0000" channel="bbcone.uk">
    <title lang="fr">Le Film</title>
    <title lang="en">The Film</title>
  </programme>
</tv>`;

test('parseXmltv: extracts programmes with absolute UTC times', () => {
  const progs = parseXmltv(DOC);
  assert.equal(progs.length, 2);
  const p0 = progs[0];
  assert.equal(p0.sourceChannelId, 'bbcone.uk');
  assert.equal(p0.startUtcMs, Date.UTC(2026, 5, 30, 14, 30, 0));
  assert.equal(p0.stopUtcMs, Date.UTC(2026, 5, 30, 15, 0, 0));
  assert.equal(p0.title, 'News at Six');
  assert.equal(p0.category, 'News');
});

test('parseXmltv: decodes XML entities in text', () => {
  const [p0] = parseXmltv(DOC);
  assert.equal(p0.desc, "The day's headlines & more.");
});

test('parseXmltv: missing stop yields null stopUtcMs', () => {
  const progs = parseXmltv(DOC);
  assert.equal(progs[1].stopUtcMs, null);
});

test('parseXmltv: prefers the requested lang title, falls back to en, then first', () => {
  const progs = parseXmltv(DOC);
  // Second programme has fr + en; requesting fr picks fr.
  assert.equal(parseXmltv(DOC, { lang: 'fr' })[1].title, 'Le Film');
  // Default (no lang) falls back to en.
  assert.equal(progs[1].title, 'The Film');
});

test('parseXmltv: programme whose times do not resolve is dropped (no silent bad data)', () => {
  const doc = `<tv><programme start="20260630143000" channel="x"><title>Untimed</title></programme></tv>`;
  // start has no offset → unresolvable → dropped.
  assert.deepEqual(parseXmltv(doc), []);
});

test('parseXmltv: malformed/empty document returns []', () => {
  assert.deepEqual(parseXmltv(''), []);
  assert.deepEqual(parseXmltv('<tv></tv>'), []);
  assert.deepEqual(parseXmltv('not xml at all'), []);
});
