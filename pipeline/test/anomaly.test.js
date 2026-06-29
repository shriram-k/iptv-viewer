'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeDiff } = require('../src/diff');
const { classifyAnomaly } = require('../src/anomaly');

function catalog(n, country = 'US', startId = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: `${country}-${startId + i}`, country }));
}
// thresholds that disable the first-run floor for seed tests built from a single country
const seedThresholds = { minFirstRunChannels: 1, minFirstRunCountries: 1 };

test('Covers AE2 (normal): ~3% change auto-publishes', () => {
  const diff = computeDiff(catalog(970), catalog(1000));
  const res = classifyAnomaly({ diff, droppedFilterIds: [] });
  assert.equal(res.anomalous, false);
});

test('Covers AE2 (anomaly): a country emptied opens a PR', () => {
  const baseline = [...catalog(50, 'US'), ...catalog(50, 'IN')];
  const candidate = catalog(50, 'US'); // IN fully removed
  const diff = computeDiff(candidate, baseline);
  const res = classifyAnomaly({ diff, droppedFilterIds: [] });
  assert.equal(res.anomalous, true);
  assert.ok(res.reasons.some((r) => r.includes('country-drop in')));
});

test('R7 identity fast-path: removals explained by THIS run\'s filtering do NOT gate', () => {
  const baseline = catalog(1000);
  const candidate = catalog(800); // removed US-800..US-999
  const diff = computeDiff(candidate, baseline);
  const droppedFilterIds = Array.from({ length: 200 }, (_, i) => `US-${800 + i}`); // exactly the removed ids
  const res = classifyAnomaly({ diff, droppedFilterIds });
  assert.equal(res.fastPathedRemovals, 200);
  assert.equal(res.anomalous, false, 'filter-driven removals are expected, not anomalous');
});

test('adv-1: disjoint-set bypass is closed — new-then-filtered ids do NOT excuse unrelated removals', () => {
  const baseline = catalog(1000); // US-0..999
  const candidate = catalog(800); // removed US-800..999 (real loss)
  const diff = computeDiff(candidate, baseline);
  // 200 brand-new channels were filtered this run, but they were never in the baseline:
  const droppedFilterIds = Array.from({ length: 200 }, (_, i) => `NEW-${i}`);
  const res = classifyAnomaly({ diff, droppedFilterIds });
  assert.equal(res.fastPathedRemovals, 0, 'no removed baseline id intersects the filtered set');
  assert.equal(res.anomalous, true, 'the real 20% removal must still gate');
  assert.ok(res.reasons.some((r) => r.startsWith('net-removal')));
});

test('net-removal not explained by filtering gates', () => {
  const diff = computeDiff(catalog(800), catalog(1000));
  const res = classifyAnomaly({ diff, droppedFilterIds: [] });
  assert.equal(res.anomalous, true);
  assert.ok(res.reasons.some((r) => r.startsWith('net-removal')));
});

test('per-country gate ignores tiny countries (min-baseline floor)', () => {
  const baseline = [...catalog(1000, 'US'), ...catalog(2, 'IN')]; // IN tiny
  const candidate = catalog(1000, 'US'); // IN's 2 channels gone (100%)
  const diff = computeDiff(candidate, baseline);
  // IN is removed but below minCountryBaseline (10); its 2 removals are also < net threshold
  const res = classifyAnomaly({ diff, droppedFilterIds: [] });
  assert.equal(res.anomalous, false, 'a 2-channel country going dark must not gate');
});

test('R15/R16: NSFW-detection collapse is flagged', () => {
  const diff = computeDiff(catalog(1000), catalog(1000));
  const res = classifyAnomaly({
    diff,
    droppedFilterIds: [],
    candidateStats: { droppedNsfw: 1 },
    baselineStats: { droppedNsfw: 120 },
  });
  assert.ok(res.reasons.some((r) => r.startsWith('nsfw-detection-collapse')));
});

test('unexpected growth is flagged', () => {
  const diff = computeDiff(catalog(1400), catalog(1000));
  const res = classifyAnomaly({ diff, droppedFilterIds: [] });
  assert.ok(res.reasons.some((r) => r.startsWith('unexpected-growth')));
});

test('first run above the sanity floor seeds the baseline', () => {
  const diff = computeDiff(catalog(1000), null);
  const res = classifyAnomaly({ diff, thresholds: seedThresholds });
  assert.equal(res.anomalous, false);
  assert.deepEqual(res.reasons, ['baseline-seed']);
});

test('adv-3: a degraded first run is gated, not enshrined as baseline', () => {
  const diff = computeDiff(catalog(50), null); // only 50 channels, 1 country
  const res = classifyAnomaly({ diff }); // default floor: 1000 channels / 20 countries
  assert.equal(res.anomalous, true);
  assert.ok(res.reasons.some((r) => r.startsWith('first-run-below-floor')));
});
