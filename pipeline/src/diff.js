'use strict';
/**
 * U5 — Diff a candidate catalog against a baseline (origin R16).
 * Pure function. Baseline may be null/empty (first run).
 */
const { toStorageCountryCode } = require('./schema');

function countByCountry(records) {
  const m = {};
  for (const r of records) {
    const c = toStorageCountryCode(r.country);
    m[c] = (m[c] || 0) + 1;
  }
  return m;
}

/**
 * @param {Array<object>} candidate
 * @param {Array<object>|null} baseline
 * @returns {object} diff summary (includes removedIds for the identity fast-path)
 */
function computeDiff(candidate, baseline) {
  const candIds = new Set(candidate.map((r) => r.id));
  const candidateCountries = new Set(candidate.map((r) => toStorageCountryCode(r.country))).size;
  // Treat a missing OR empty baseline as first run — an empty array is truthy but
  // is not a real baseline to diff against.
  if (!baseline || baseline.length === 0) {
    return {
      firstRun: true,
      baselineTotal: 0,
      candidateTotal: candidate.length,
      candidateCountries,
      removed: 0,
      removedIds: [],
      added: candidate.length,
      removedPct: 0,
      perCountryRemovedPct: {},
    };
  }
  const baseIds = new Set(baseline.map((r) => r.id));
  const removedIds = [...baseIds].filter((id) => !candIds.has(id));
  const added = [...candIds].filter((id) => !baseIds.has(id));

  const baseByCountry = countByCountry(baseline);
  const candByCountry = countByCountry(candidate);
  const perCountryRemovedPct = {};
  const perCountryBaseline = {};
  for (const [c, baseN] of Object.entries(baseByCountry)) {
    const candN = candByCountry[c] || 0;
    perCountryRemovedPct[c] = baseN > 0 ? (baseN - candN) / baseN : 0;
    perCountryBaseline[c] = baseN;
  }

  return {
    firstRun: false,
    baselineTotal: baseline.length,
    candidateTotal: candidate.length,
    candidateCountries,
    removed: removedIds.length,
    removedIds,
    added: added.length,
    removedPct: baseline.length > 0 ? removedIds.length / baseline.length : 0,
    perCountryRemovedPct,
    perCountryBaseline,
  };
}

module.exports = { computeDiff };
