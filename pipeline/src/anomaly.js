'use strict';
/**
 * U5 — Anomaly classification (origin R7, R16).
 *
 * Decides whether a candidate snapshot auto-publishes or pauses for a review PR.
 * Key rule (R7 fast-path): removals caused by *additional* blocklist/NSFW filtering
 * are expected and subtracted before the removal threshold is applied — so a
 * blocklist/NSFW spike never gates a publish.
 */

const DEFAULT_THRESHOLDS = {
  netRemovalPct: 0.15, // unexplained net removal vs baseline
  countryRemovalPct: 0.5, // single-country removal in a day
  growthPct: 0.25, // unexpected catalog growth
};

/**
 * @param {object} args
 * @param {object} args.diff               output of computeDiff
 * @param {object} args.candidateStats      curate() stats for this run
 * @param {object} [args.baselineStats]     curate() stats for the baseline run
 * @param {object} [args.thresholds]
 * @returns {{ anomalous: boolean, reasons: string[], fastPathedRemovals: number }}
 */
function classifyAnomaly({ diff, candidateStats, baselineStats, thresholds }) {
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const reasons = [];

  if (diff.firstRun) {
    return { anomalous: false, reasons: ['baseline-seed'], fastPathedRemovals: 0 };
  }

  // Fast-path (R7): subtract the *increase* in blocklist/NSFW drops from removals.
  const base = baselineStats || { droppedBlocklist: 0, droppedNsfw: 0, droppedKeyword: 0 };
  const fastPathedRemovals = Math.max(
    0,
    (candidateStats.droppedBlocklist - base.droppedBlocklist) +
      (candidateStats.droppedNsfw - base.droppedNsfw) +
      (candidateStats.droppedKeyword - base.droppedKeyword)
  );
  const totalRemoved = Math.round(diff.removedPct * diff.baselineTotal);
  const unexplainedRemoved = Math.max(0, totalRemoved - fastPathedRemovals);
  const unexplainedPct = diff.baselineTotal > 0 ? unexplainedRemoved / diff.baselineTotal : 0;

  if (unexplainedPct > t.netRemovalPct) {
    reasons.push(`net-removal ${(unexplainedPct * 100).toFixed(1)}% > ${(t.netRemovalPct * 100)}%`);
  }

  for (const [country, pct] of Object.entries(diff.perCountryRemovedPct)) {
    if (pct > t.countryRemovalPct) {
      reasons.push(`country-drop ${country} ${(pct * 100).toFixed(0)}%`);
    }
  }

  // Unexpected growth — a schema change that lets filtered content back in often
  // shows up as the catalog suddenly growing.
  if (diff.candidateTotal > diff.baselineTotal * (1 + t.growthPct)) {
    reasons.push(`unexpected-growth ${diff.candidateTotal} vs ${diff.baselineTotal}`);
  }

  // NSFW-detection collapse (R15/R16): if we used to filter a healthy number of
  // NSFW entries and now filter almost none, the upstream flag likely changed.
  if (base.droppedNsfw >= 20 && candidateStats.droppedNsfw < base.droppedNsfw * 0.2) {
    reasons.push(`nsfw-detection-collapse ${candidateStats.droppedNsfw} vs ${base.droppedNsfw}`);
  }

  return { anomalous: reasons.length > 0, reasons, fastPathedRemovals };
}

module.exports = { classifyAnomaly, DEFAULT_THRESHOLDS };
