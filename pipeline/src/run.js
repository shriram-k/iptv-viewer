'use strict';
/**
 * U8 — Orchestration (origin R6, R7, R12, R13).
 *
 * runPipeline() is the pure-ish orchestrator (deps injected) so the
 * normal-vs-anomaly branching is unit-testable with no network or KV.
 * main() is the CLI wrapper that wires real deps and emits the action for the
 * GitHub Action to act on (auto-commit+publish vs open-anomaly-PR).
 */
const fs = require('fs');
const path = require('path');
const { ingest, defaultFetchJson } = require('./ingest');
const { enrich } = require('./enrich');
const { curate } = require('./curate');
const { computeDiff } = require('./diff');
const { classifyAnomaly } = require('./anomaly');
const { buildShards, writeSnapshot } = require('./snapshot');
const { publishSnapshot } = require('./publish-kv');

/**
 * @param {object} deps
 * @param {Function} deps.fetchJson
 * @param {Array<object>|null} deps.baseline        prior published catalog (id+country min)
 * @param {object} [deps.baselineStats]             prior curate stats (for fast-path)
 * @param {object} [deps.thresholds]
 * @param {string|number} deps.version
 * @param {string} deps.generatedAt
 * @param {(shards:object)=>Promise<void>} [deps.persist]   write candidate shards (git working tree)
 * @param {object} [deps.kv]                          KV client (only used on publish path)
 * @param {Function} [deps.purge]
 * @returns {Promise<object>} result with `action`
 */
async function runPipeline(deps) {
  const raw = await ingest(deps.fetchJson || defaultFetchJson);
  const enriched = enrich(raw);
  const { kept, stats, droppedFilterIds } = curate(enriched, { blocklist: raw.blocklist });

  const diff = computeDiff(kept, deps.baseline || null);
  const anomaly = classifyAnomaly({
    diff,
    droppedFilterIds,
    candidateStats: stats,
    baselineStats: deps.baselineStats,
    thresholds: deps.thresholds,
  });

  const shards = buildShards(kept, { version: deps.version, generatedAt: deps.generatedAt });

  // Always write the candidate shards to the working tree — the workflow decides
  // whether they land on master (published) or on a review-PR branch (anomaly).
  if (deps.persist) await deps.persist(shards);

  if (anomaly.anomalous) {
    return { action: 'anomaly-pr', anomaly, diff, stats, shards };
  }

  // Normal / fast-pathed → publish to KV (origin R7 happy path, R12).
  if (deps.kv) await publishSnapshot({ shards, kv: deps.kv, purge: deps.purge });
  return { action: 'published', anomaly, diff, stats, shards };
}

// ---- CLI wrapper (not unit-tested beyond runPipeline) -------------------------

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'snapshot');
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'pipeline-state.json');

function loadBaseline() {
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, 'channel-index.json'), 'utf8'));
    return Object.entries(idx).map(([id, v]) => ({ id, country: v.country }));
  } catch (err) {
    if (err.code === 'ENOENT') return null; // genuine first run
    throw err; // corruption/parse error must fail loudly, NOT bypass the gate as "first run"
  }
}
function loadBaselineStats() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).stats;
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

function emitAction(action) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `action=${action}\n`);
  console.log(`pipeline action: ${action}`);
}

async function main() {
  const version = Date.now();
  const generatedAt = new Date().toISOString();

  // Real KV client only when creds are present (publish path); otherwise dry-run.
  const kv = process.env.CF_API_TOKEN ? require('./cf-kv').makeKvClient() : null;
  const purge = process.env.CF_API_TOKEN ? require('./cf-kv').makePurge() : null;

  const result = await runPipeline({
    fetchJson: defaultFetchJson,
    baseline: loadBaseline(),
    baselineStats: loadBaselineStats(),
    version,
    generatedAt,
    persist: async (shards) => writeSnapshot(shards, SNAPSHOT_DIR),
    kv,
    purge,
  });

  if (result.action === 'anomaly-pr') {
    const summary = `# Pipeline anomaly — review required\n\n` +
      `Reasons:\n${result.anomaly.reasons.map((r) => `- ${r}`).join('\n')}\n\n` +
      `Removed ~${result.diff.removed} of ${result.diff.baselineTotal}; ` +
      `fast-pathed (blocklist/NSFW) ${result.anomaly.fastPathedRemovals}.\n`;
    fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'pipeline-summary.md'), summary);
  } else {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ version, stats: result.stats }, null, 2));
  }

  emitAction(result.action);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}

module.exports = { runPipeline };
