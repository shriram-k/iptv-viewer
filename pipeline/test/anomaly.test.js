'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeDiff } = require('../src/diff');
const { classifyAnomaly } = require('../src/anomaly');

function catalog(n, country = 'US', startId = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: `${country}-${startId + i}`, country }));
}
const zeroStats = { droppedBlocklist: 0, droppedNsfw: 0, droppedKeyword: 0 };

test('Covers AE2 (normal): ~3% change auto-publishes', () => {
  const baseline = catalog(1000);
  const candidate = catalog(970); // 3% removed
  const diff = computeDiff(candidate, baseline);
  const res = classifyAnomaly({ diff, candidateStats: zeroStats, baselineStats: zeroStats });
  assert.equal(res.anomalous, false);
});

test('Covers AE2 (anomaly): a country emptied opens a PR', () => {
  const baseline = [...catalog(50, 'US'), ...catalog(50, 'IN')];
  const candidate = catalog(50, 'US'); // IN fully removed
  const diff = computeDiff(candidate, baseline);
  const res = classifyAnomaly({ diff, candidateStats: zeroStats, baselineStats: zeroStats });
  assert.equal(res.anomalous, true);
  assert.ok(res.reasons.some((r) => r.includes('country-drop in')));
});

test('R7 fast-path: a blocklist spike does NOT gate', () => {
  const baseline = catalog(1000);
  const candidate = catalog(800); // 200 removed (20% > 15% threshold)
  const diff = computeDiff(candidate, baseline);
  // ...but 200 of them are explained by new blocklist drops this run
  const candidateStats = { droppedBlocklist: 200, droppedNsfw: 0, droppedKeyword: 0 };
  const res = classifyAnomaly({ diff, candidateStats, baselineStats: zeroStats });
  assert.equal(res.fastPathedRemovals, 200);
  assert.equal(res.anomalous, false, 'blocklist-driven removals are expected, not anomalous');
});

test('net-removal that is NOT explained by filtering gates', () => {
  const baseline = catalog(1000);
  const candidate = catalog(800);
  const diff = computeDiff(candidate, baseline);
  const res = classifyAnomaly({ diff, candidateStats: zeroStats, baselineStats: zeroStats });
  assert.equal(res.anomalous, true);
  assert.ok(res.reasons.some((r) => r.startsWith('net-removal')));
});

test('R15/R16: NSFW-detection collapse is flagged', () => {
  const baseline = catalog(1000);
  const candidate = catalog(1000);
  const diff = computeDiff(candidate, baseline);
  const res = classifyAnomaly({
    diff,
    candidateStats: { ...zeroStats, droppedNsfw: 1 },
    baselineStats: { ...zeroStats, droppedNsfw: 120 },
  });
  assert.ok(res.reasons.some((r) => r.startsWith('nsfw-detection-collapse')));
});

test('unexpected growth is flagged (schema-change-lets-content-in signal)', () => {
  const diff = computeDiff(catalog(1400), catalog(1000));
  const res = classifyAnomaly({ diff, candidateStats: zeroStats, baselineStats: zeroStats });
  assert.ok(res.reasons.some((r) => r.startsWith('unexpected-growth')));
});

test('first run seeds the baseline and is never anomalous', () => {
  const diff = computeDiff(catalog(1000), null);
  const res = classifyAnomaly({ diff, candidateStats: zeroStats });
  assert.equal(res.anomalous, false);
  assert.deepEqual(res.reasons, ['baseline-seed']);
});
