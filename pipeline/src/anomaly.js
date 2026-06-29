'use strict';
/**
 * U5 — Anomaly classification (origin R7, R16).
 *
 * Decides whether a candidate snapshot auto-publishes or pauses for a review PR.
 *
 * Fast-path (R7) is IDENTITY-based: removals are excused only when the specific
 * baseline channels that disappeared are the ones we filtered this run
 * (removedIds ∩ droppedFilterIds). Counting raw drop-stat deltas would conflate
 * newly-appeared-then-filtered channels (never in the baseline) with real
 * removals and could mask a genuine mass loss.
 */

const DEFAULT_THRESHOLDS = {
  netRemovalPct: 0.15, // unexplained net removal vs baseline
  countryRemovalPct: 0.5, // single-country removal in a day
  growthPct: 0.25, // unexpected catalog growth
  minCountryBaseline: 10, // ignore tiny countries in the per-country gate
  minFirstRunChannels: 1000, // first-run sanity floor (live catalog is ~9.8k)
  minFirstRunCountries: 20,
};

/**
 * @param {object} args
 * @param {object} args.diff                output of computeDiff
 * @param {string[]} [args.droppedFilterIds] ids dropped this run by NSFW/keyword/blocklist
 * @param {object} [args.candidateStats]     curate() stats for this run
 * @param {object} [args.baselineStats]      curate() stats for the baseline run
 * @param {object} [args.thresholds]
 * @returns {{ anomalous: boolean, reasons: string[], fastPathedRemovals: number }}
 */
function classifyAnomaly({ diff, droppedFilterIds, candidateStats, baselineStats, thresholds }) {
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const reasons = [];

  if (diff.firstRun) {
    // Don't enshrine a degraded first fetch as the trusted baseline.
    if (diff.candidateTotal < t.minFirstRunChannels || (diff.candidateCountries || 0) < t.minFirstRunCountries) {
      reasons.push(`first-run-below-floor ${diff.candidateTotal} channels / ${diff.candidateCountries} countries`);
      return { anomalous: true, reasons, fastPathedRemovals: 0 };
    }
    return { anomalous: false, reasons: ['baseline-seed'], fastPathedRemovals: 0 };
  }

  // Identity-based fast-path: of the baseline channels that disappeared, how many
  // are ones we filtered this run? Those removals are expected, not anomalous.
  const filtered = new Set(droppedFilterIds || []);
  const fastPathedRemovals = (diff.removedIds || []).filter((id) => filtered.has(id)).length;
  const unexplainedRemoved = Math.max(0, diff.removed - fastPathedRemovals);
  const unexplainedPct = diff.baselineTotal > 0 ? unexplainedRemoved / diff.baselineTotal : 0;

  if (unexplainedPct > t.netRemovalPct) {
    reasons.push(`net-removal ${(unexplainedPct * 100).toFixed(1)}% > ${t.netRemovalPct * 100}%`);
  }

  // Per-country gate, but only for countries large enough to be meaningful —
  // a 1-channel country going dark must not pause the whole pipeline.
  const perCountryBaseline = diff.perCountryBaseline || {};
  for (const [country, pct] of Object.entries(diff.perCountryRemovedPct)) {
    if ((perCountryBaseline[country] || 0) >= t.minCountryBaseline && pct > t.countryRemovalPct) {
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
  const base = baselineStats || { droppedNsfw: 0 };
  const cand = candidateStats || { droppedNsfw: 0 };
  if (base.droppedNsfw >= 20 && cand.droppedNsfw < base.droppedNsfw * 0.2) {
    reasons.push(`nsfw-detection-collapse ${cand.droppedNsfw} vs ${base.droppedNsfw}`);
  }

  return { anomalous: reasons.length > 0, reasons, fastPathedRemovals };
}

module.exports = { classifyAnomaly, DEFAULT_THRESHOLDS };
