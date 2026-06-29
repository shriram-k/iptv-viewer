---
title: "feat: v2 pipeline hardening (KV consistency + gate robustness)"
type: feat
status: active
date: 2026-06-29
origin: docs/brainstorms/2026-06-28-v2-data-pipeline-requirements.md
---

# feat: v2 Pipeline Hardening — KV Consistency + Gate Robustness

## Summary

Follow-up to the v2 data-pipeline build ([plan](2026-06-28-001-feat-v2-data-pipeline-plan.md)): the design-level robustness gaps surfaced by code review that were deliberately deferred from the initial build because they restructure the deploy topology and warrant deliberate design rather than a tail-end patch. The mechanical/contained review fixes already landed on `feat/v2-data-pipeline`; this plan covers the rest.

---

## Problem Frame

Two code reviews (CE persona panel + a 52-agent workflow review) of the v2 pipeline confirmed a cluster of robustness defects that share a root: the pipeline trusts iptv-org as both data source and compliance authority, and the KV publish is non-atomic and ordered before the git commit. The contained fixes (identity fast-path, sanitization, path-traversal, timeouts/retries, first-run floor) shipped in the build branch. The remaining items change how/when KV is published and how the gate detects degradation — they need their own change so they can be designed and tested carefully.

---

## Requirements

- R1. KV must never be ahead of the committed git baseline (no divergence on push failure). (adv-4 / workflow-confirmed)
- R2. Emptied/renamed country & category KV shards must be deleted, not served stale forever. (adv-5 / R8)
- R3. An approved anomaly-review PR must result in the reviewed snapshot reaching KV. (adv-6)
- R4. The gate must detect a mass playability regression (e.g. https→http flip) that leaves channel identity unchanged. (adv-2)
- R5. Partial KV publish must be recoverable/consistent, not a 24h mixed-version window. (R7)
- R6. The `main()` CLI wrapper and its failure modes must have test coverage. (testing TG3/RR3-RR5)

---

## Scope Boundaries

- The contained fixes already merged on `feat/v2-data-pipeline` are NOT re-done here.
- Player/EPG/UI/analytics features remain separate plans.

---

## Key Technical Decisions (proposed — confirm at planning)

- **Publish-after-commit (R1):** move KV publish out of `runPipeline` into a separate step that runs only after `git push` of the snapshot succeeds (or a `push: master` + `paths: data/snapshot/**` triggered publish workflow). This also delivers R3 for free — a merged anomaly PR's push triggers the same publish.
- **Versioned/atomic KV (R5):** consider writing shards under a `v<version>:` key prefix and flipping a single `current-version` pointer last, so readers resolve via the pointer and partial writes are invisible. Reader contract (UI plan) changes accordingly.
- **Orphan prune (R2):** track the prior published key-set (in `meta` or a sibling key) and delete keys absent from the new set after the pointer flips; requires `cf-kv` to gain list/delete.
- **Playability gate (R4):** add `keptPlayable` to curate stats; gate when playable-share drops materially vs baseline.

---

## Implementation Units (sketch — expand at planning)

### U1. Publish-after-commit restructure (R1, R3)
Move KV publish to a post-commit workflow step / merge-triggered publish; `runPipeline` stops publishing directly.

### U2. Versioned KV + atomic pointer (R5)
Version-prefixed shard keys + `current-version` pointer flipped last; update the KV read contract and the UI plan's reader.

### U3. Orphan shard prune (R2)
`cf-kv` list/delete; diff prior vs new key-set; delete after pointer flip.

### U4. Playability-share gate (R4)
Track playable-share in curate stats + a new anomaly reason; threshold tunable.

### U5. CLI + failure-mode tests (R6)
Cover `main()`, `loadBaseline`/`loadBaselineStats`, `emitAction`/GITHUB_OUTPUT, STATE_FILE write, and the publish→commit ordering.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Versioned-KV reader change ripples into the UI plan | Coordinate the read-contract change with the UI plan before building U2 |
| Orphan prune deleting live keys on a bad run | Prune only after a successful pointer flip; never prune on an anomaly run |

---

## Sources & References

- Build plan: [2026-06-28-001-feat-v2-data-pipeline-plan.md](2026-06-28-001-feat-v2-data-pipeline-plan.md)
- Origin requirements: [2026-06-28-v2-data-pipeline-requirements.md](../brainstorms/2026-06-28-v2-data-pipeline-requirements.md)
- Review run artifact: `/tmp/compound-engineering/ce-code-review/20260629-125516-b3293469/`
