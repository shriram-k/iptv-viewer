'use strict';
/**
 * U5 — Diff a candidate catalog against a baseline (origin R16).
 * Pure function. Baseline may be null (first run).
 */

function countByCountry(records) {
  const m = {};
  for (const r of records) {
    const c = r.country || 'unknown';
    m[c] = (m[c] || 0) + 1;
  }
  return m;
}

/**
 * @param {Array<object>} candidate
 * @param {Array<object>|null} baseline
 * @returns {object} diff summary
 */
function computeDiff(candidate, baseline) {
  const candIds = new Set(candidate.map((r) => r.id));
  if (!baseline) {
    return {
      firstRun: true,
      baselineTotal: 0,
      candidateTotal: candidate.length,
      removed: 0,
      added: candidate.length,
      removedPct: 0,
      perCountryRemovedPct: {},
    };
  }
  const baseIds = new Set(baseline.map((r) => r.id));
  const removed = [...baseIds].filter((id) => !candIds.has(id));
  const added = [...candIds].filter((id) => !baseIds.has(id));

  const baseByCountry = countByCountry(baseline);
  const candByCountry = countByCountry(candidate);
  const perCountryRemovedPct = {};
  for (const [c, baseN] of Object.entries(baseByCountry)) {
    const candN = candByCountry[c] || 0;
    perCountryRemovedPct[c] = baseN > 0 ? (baseN - candN) / baseN : 0;
  }

  return {
    firstRun: false,
    baselineTotal: baseline.length,
    candidateTotal: candidate.length,
    removed: removed.length,
    added: added.length,
    removedPct: baseline.length > 0 ? removed.length / baseline.length : 0,
    perCountryRemovedPct,
  };
}

module.exports = { computeDiff };
