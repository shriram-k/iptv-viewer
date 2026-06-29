---
title: "feat: IPTV v2 data pipeline (snapshot → curate → KV)"
type: feat
status: active
date: 2026-06-28
origin: docs/brainstorms/2026-06-28-v2-data-pipeline-requirements.md
---

# feat: IPTV v2 Data Pipeline (snapshot → curate → KV)

## Summary

Build the daily Node pipeline that pulls iptv-org, enriches + curates (SFW, sanitized, blocklisted, deduped) into a versioned sharded snapshot committed to git and published to Cloudflare KV, gated by rolling-baseline anomaly detection (auto-publish normal diffs, anomaly-PR otherwise), with two cheap de-risking spikes first. Rendering/SSR is out of scope — this plan delivers the data and the KV read + cache-invalidation contract the UI plan consumes.

---

## Problem Frame

The v1 catalog is an unfiltered ~3.25 MB mirror of iptv-org regenerated weekly and committed whole. It is stale between runs, ships megabytes to the browser, contains dead/NSFW/DMCA'd entries, and renders nothing for crawlers. v2 needs a controlled, SFW, enriched, edge-served snapshot under our own version control — the foundation every other v2 feature reads from. See origin (`docs/brainstorms/2026-06-28-v2-data-pipeline-requirements.md`) for the full motivation and constraints.

---

## Requirements

- R1. Pull the needed iptv-org endpoints, including `guides`. (origin R1)
- R2. Enriched channel model: join channel/feed/logo, attach `status`/`checked_at`, retain ordered stream-URL list. (origin R2)
- R3. SFW filter via `is_nsfw` + adult category. (origin R3)
- R4. Persist each accepted snapshot to git (pin/rollback). (origin R4)
- R5. Shard the snapshot per country/category. (origin R5)
- R6. Daily schedule; auto-publish normal diffs with no human step. (origin R6)
- R7. Anomaly diffs open a review PR and leave the prior snapshot live — EXCEPT blocklist/NSFW additions, which always fast-path and apply immediately. (origin R7)
- R8. Publish the accepted snapshot to a runtime store; not bundled into the build. (origin R8)
- R11. Cache-invalidation contract bounds staleness to ~1 day without a code deploy. (origin R11, scoped to the publish/invalidation contract here)
- R12. Data refresh takes effect with no code build/deploy. (origin R12)
- R13. Cost unbillable by construction. (origin R13)
- R14. Sanitize all external string/URL values before they enter the snapshot. (origin R14)
- R15. Secondary keyword NSFW gate + treat `is_nsfw` drop/rename as anomaly. (origin R15)
- R16. Rolling-baseline diff + schema/distribution validation. (origin R16)
- R17. Logos served from our own origin/cache, not hotlinked. (origin R17)
- R18. Per-stream best-effort browser-playability hint; order browser-playable first. (origin R18)

**Origin actors:** A1 (pull job), A2 (maintainer), A3 (runtime app — consumer, UI plan), A4 (snapshot store = Cloudflare KV).
**Origin flows:** F1 (daily refresh — happy path), F2 (anomaly review). F3 (page render) is the UI plan.
**Origin acceptance examples:** AE1 (covers R3), AE2 (covers R6/R7), AE3 (covers R12), AE5 (covers R7/R4). AE4 (covers R9/R11 render) is the UI plan.

---

## Scope Boundaries

- **Rendering / edge-SSR / the TanStack Start app** — the UI plan. This plan defines the KV read contract (key shapes) and the cache-invalidation hook, but does not build the renderer, the Worker, or its cache config.
- Player, EPG, engagement, analytics, monetization — separate plans (see master index).
- The probe (U1) and SEO check (U2) **inform** go/no-go and downstream product decisions (e.g., reconsidering pure-linker, breadth-vs-niche); acting on those outcomes is a product decision, not this plan's code.
- Logo *serving/caching* mechanism beyond recording the canonical logo reference + the "serve same-origin" decision is shared with the UI/asset layer; this plan records the requirement and the source URL.

### Deferred to Follow-Up Work

- Productized public health/dataset surface (origin analytics doc) — later.
- Replacing/removing the v1 CRA app and old `playlistGenerator.js` + weekly Action — coordinate when the v2 app ships; v1 may coexist until cutover.

---

## Context & Research

### Relevant Code and Patterns

- `playlistGenerator.js` — existing v1 pipeline: fetches `streams.json` + `channels.json`, joins, writes `playlist.json`. The v2 pipeline supersedes it; reuse the join logic shape and the `UK→GB` / `XK→Kosovo` country-code handling.
- `.github/workflows/playlist-update.yml` — existing weekly cron + `peter-evans/create-pull-request` PR flow. v2 reuses this pattern (cron + conditional PR) but daily and with auto-commit on normal diffs.
- `playlist.json` — current shape (`{channels, countries, categories}`, 13,509 entries) is the baseline the probe (U1) samples and the diff (U5) compares against on first run.

### Institutional Learnings

- None — `docs/solutions/` does not exist in this repo (greenfield knowledge area; capture learnings post-build).

### External References

- iptv-org API: 12 static JSON endpoints (Unlicense), incl. `streams` (`status`/`checked_at`), `channels` (`is_nsfw`), `feeds`, `guides`, `blocklist`, `logos`.
- Cloudflare KV free tier: ~100k reads/day, 1k writes/day, 1 GB — sufficient for a sharded catalog with low daily write volume. CDN cache purge-by-URL is free; tag-based purge is Enterprise-only (avoid).
- Firebase Spark: GA4 + Remote Config are free; staying on Spark (no billing account) makes "no bill" literally true.

---

## Key Technical Decisions

- **Runtime store = Cloudflare KV; git = versioned source of truth.** The daily job commits the sharded snapshot to git (pin/rollback, R4) AND publishes the shards to KV (R8). The app reads KV at the edge. R2 (better for large blobs) and jsDelivr/git-CDN (zero infra but cache lag, rate limits) were considered; KV wins on edge latency + purgeability for many small shards. Revisitable if shard sizes grow.
- **Pipeline is Node, runs in GitHub Actions** (free compute) — not the TanStack app, not a metered Cloud service. The app stack (TanStack Start/Cloudflare) is irrelevant to this plan.
- **Firebase stays on Spark (no billing account).** Only GA4 + Remote Config are used (both free); not enabling Blaze removes every bill path. Resolves origin's Blaze→Spark question.
- **Sharding scheme:** KV keys `country:<code>`, `category:<slug>`, plus a `channel-index` (id → {country, categories, shard refs}) and a small `meta` key (snapshot version, generated-at). Channel pages resolve via `channel-index`. (R5, R8)
- **Anomaly detection (R16):** diff the candidate against a rolling baseline (the snapshot from ~7–14 days ago, plus per-country trend), not only yesterday; validate expected schema/field presence + value distributions (e.g., NSFW share within historical band). Starting thresholds: >15% net catalog removal, or >50% removal in any single country in a day, or NSFW-share/`is_nsfw`-presence outside band → anomaly. Tunable. (R7, R16)
- **Blocklist/NSFW fast-path (R7):** additions to blocklist/NSFW always apply immediately and never trigger the gate; only removals/schema/distribution anomalies gate.
- **Sanitize at curate time, not render time (R14):** the snapshot is safe-by-construction — HTML-escape text, escape `</`→`<\/` for JSON-LD, reject non-`http(s)` URL schemes — so no downstream consumer can render a poisoned entry.
- **Cache invalidation (R11/R12):** default a ~12–24 h TTL on the app's edge-cached HTML PLUS a best-effort purge-by-URL/purge-everything hook the publish step can call after writing KV. Tag-purge is avoided (Enterprise-only). The Worker-side cache config itself lives in the UI plan; this plan defines the hook contract.
- **Language:** Node, TypeScript recommended for the pipeline (schema/zod validation makes R14/R16 safer); acceptable to stay JS to match the repo. Not load-bearing.

---

## Open Questions

### Resolved During Planning

- Runtime store → Cloudflare KV (above).
- Blaze vs Spark → Spark (above).
- Shard scheme → per-country/category keys + channel-index (above).
- Anomaly thresholds → starting heuristic above; refined in U5 against real iptv-org churn.

### Deferred to Implementation

- Exact KV value encoding (raw JSON vs compressed) and whether any shard exceeds KV's 25 MB value limit (likely not; verify largest country during U6).
- Precise purge mechanism wiring (depends on the UI plan's Worker cache strategy) — U7 defines the contract, the UI plan consumes it.
- Whether to port the pipeline to TS or keep JS — decide at U3 start.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
GitHub Actions (daily cron)
  │
  ├─ U3 ingest+enrich ── iptv-org endpoints ──► enriched channel model
  │        (join channels/feeds/logos, status/checked_at, playability hint, URL list)
  │
  ├─ U4 curate gate ──► SFW + keyword + sanitize + blocklist + dead/dupe ──► clean catalog
  │
  ├─ U5 diff + anomaly ── compare vs rolling baseline + schema/distribution
  │        ├─ normal / (blocklist|nsfw additions) ─► accept
  │        └─ anomaly ─► open PR, keep prior snapshot live (STOP)
  │
  ├─ U6 snapshot + shard ──► versioned sharded JSON ──► git commit (source of truth)
  │
  └─ U7 publish ──► write shards to Cloudflare KV ──► call cache-invalidation hook
                                                       │
                                          UI plan: edge SSR reads KV  (out of scope)
```

---

## Output Structure

    pipeline/
      src/
        ingest.{ts,js}          # U3
        enrich.{ts,js}          # U3
        curate.{ts,js}          # U4
        sanitize.{ts,js}        # U4
        diff.{ts,js}            # U5
        anomaly.{ts,js}         # U5
        snapshot.{ts,js}        # U6  (sharding + git write)
        publish-kv.{ts,js}      # U7  (KV write + purge hook)
        run.{ts,js}             # U8  (orchestration entrypoint)
        schema.{ts,js}          # shared types / validation
      test/
        *.test.{ts,js}
    scripts/
      playability-probe.{ts,js} # U1 (spike, throwaway)
    docs/research/
      2026-06-28-seo-serp-check.md   # U2 (research artifact)
    .github/workflows/
      v2-pipeline.yml           # U8

---

## Implementation Units

### U1. Playability probe (go/no-go spike)

**Goal:** Measure what fraction of the current ~13.5k streams actually play in a browser (HTTPS + CORS-clean), to validate the pure-linker premise before heavy build.

**Requirements:** R18 (informs the playability-hint design); origin pre-planning task.

**Dependencies:** None.

**Files:**
- Create: `scripts/playability-probe.{ts,js}`
- Create: `docs/research/2026-06-28-playability-probe.md` (results)

**Approach:**
- Sample ~500 streams from `playlist.json` (stratified across countries/categories).
- For each: classify scheme (http vs https), then from a headless-browser origin attempt an `hls.js` manifest + first-segment fetch; record success / CORS-fail / mixed-content / timeout.
- Report the playable fraction and the failure-class breakdown. Throwaway code; the *number* is the deliverable.

**Execution note:** Spike — discard the script after recording results; do not productionize.

**Test scenarios:**
- Test expectation: none — throwaway spike; the recorded fraction + breakdown in the results doc is the artifact.

**Verification:** A results doc states the playable fraction and failure-class breakdown; the team has a go/no-go input for pure-linker (and a baseline for U3's playability hint).

---

### U2. SEO/SERP reality check (research)

**Goal:** Confirm the SFW-directory SEO premise is winnable before building the programmatic surface.

**Requirements:** Origin pre-planning task (de-risks the master "SEO-first" thesis).

**Dependencies:** None.

**Files:**
- Create: `docs/research/2026-06-28-seo-serp-check.md`

**Approach:**
- Pick 8–10 target queries (e.g., "watch <country> live tv free", "<channel> live stream", "<country> <category> channels").
- For each: estimate demand, who ranks (note iptv-org-clone saturation and rights-holder pages), and whether the SERP rewards directory pages or treats them as thin/scaled content.
- Identify the unique indexable value (honest-liveness, uptime history) that differentiates our pages, or record that thin derived pages may not rank.

**Execution note:** Research only — no code.

**Test scenarios:**
- Test expectation: none — research artifact.

**Verification:** A doc with per-query demand/competition/winnability and an explicit "differentiator or not" conclusion feeding the breadth-vs-niche decision.

---

### U3. Ingest + enrich module

**Goal:** Fetch the needed iptv-org endpoints and produce one enriched, typed channel model.

**Requirements:** R1, R2, R17, R18.

**Dependencies:** None (U1 informs the playability-hint heuristic).

**Files:**
- Create: `pipeline/src/ingest.{ts,js}`, `pipeline/src/enrich.{ts,js}`, `pipeline/src/schema.{ts,js}`
- Test: `pipeline/test/enrich.test.{ts,js}`

**Approach:**
- Fetch `streams`, `channels`, `feeds`, `logos`, `categories`, `countries`, `languages`, `regions`, `blocklist`, `guides`.
- Join streams→channels (carry forward v1's `UK→GB`, `XK→Kosovo` handling); attach `status`/`checked_at`, the canonical logo reference (record same-origin-serve intent, R17), the channel's EPG guide ref (for the EPG plan), and the full ordered stream-URL list.
- Compute a best-effort browser-playability hint per stream (HTTPS + scheme/heuristic; full CORS verdict is best-effort, calibrated by U1) and order URLs browser-playable-first (R18).

**Patterns to follow:** `playlistGenerator.js` join + country-code logic.

**Test scenarios:**
- Happy path: a stream with a matching channel produces an enriched record with status, ordered URLs (HTTPS first), logo ref, guide ref.
- Edge case: stream with no matching channel, or channel with no country → excluded/handled exactly as v1 (no crash).
- Edge case: `UK`/`XK` country codes map correctly.
- Edge case: channel with multiple stream URLs → all retained, ordered, HTTPS first.
- Error path: an endpoint fetch fails / returns non-200 → surfaced as a hard error (not a silent empty model).

**Verification:** Given fixtured iptv-org responses, the module emits a typed enriched model with the fields R2/R17/R18 require.

---

### U4. Curate gate (SFW + sanitize + blocklist + dedupe)

**Goal:** Turn the enriched model into a SFW, sanitized, blocklist-compliant, deduped catalog.

**Requirements:** R3, R14, R15.

**Dependencies:** U3.

**Files:**
- Create: `pipeline/src/curate.{ts,js}`, `pipeline/src/sanitize.{ts,js}`
- Test: `pipeline/test/curate.test.{ts,js}`, `pipeline/test/sanitize.test.{ts,js}`

**Approach:**
- SFW gate: drop `is_nsfw` + adult-category entries (R3); secondary keyword blocklist over names/URLs (R15).
- Sanitize (R14): HTML-escape text fields; escape `</`→`<\/` for any value destined for JSON-LD; reject/strip URL fields whose scheme isn't `http(s)`.
- Apply DMCA `blocklist.json`; drop dead (status) + duplicate (feeds-aware) entries.

**Test scenarios:**
- Covers AE1. Happy path: an `is_nsfw` or blocklisted channel does not appear in the output.
- Edge case: an adult channel filed under a non-adult category but caught by the keyword gate is dropped.
- Error/security path: a channel name `foo</script><script>…` is escaped so it can't break out of HTML or a JSON-LD block.
- Error/security path: a stream/logo URL with `javascript:`/`data:` scheme is stripped/rejected.
- Edge case: duplicate feeds of the same channel collapse to one entry.

**Verification:** Given an enriched model containing NSFW, blocklisted, malicious-string, and duplicate entries, the output contains none of them and all strings are render-safe.

---

### U5. Diff + anomaly detection

**Goal:** Decide whether a candidate snapshot auto-publishes or pauses for review.

**Requirements:** R6, R7, R16.

**Dependencies:** U4.

**Files:**
- Create: `pipeline/src/diff.{ts,js}`, `pipeline/src/anomaly.{ts,js}`
- Test: `pipeline/test/anomaly.test.{ts,js}`

**Approach:**
- Diff candidate vs a rolling baseline (snapshot ~7–14 days prior + per-country trend), not only yesterday (R16).
- Validate schema/field presence + value distributions (NSFW share within band; expected fields present) (R16).
- Classify: normal → accept; anomaly (>15% net removal, >50% single-country/day removal, schema drift, distribution shift, unexpected growth) → flag for PR.
- Fast-path exception (R7): blocklist/NSFW *additions* always accept immediately, never gate.

**Test scenarios:**
- Covers AE2. Happy path: a ~3% diff classifies normal (auto-publish); a country dropping to zero classifies anomaly (PR).
- Edge case: 5%/day erosion over a week — each day vs baseline trips the rolling check even though day-over-day wouldn't.
- Edge case (covers R7 fast-path): a blocklist spike alone does NOT gate — it fast-paths and applies.
- Edge case (covers R15/R16): `is_nsfw` field missing/renamed (NSFW share spikes / field absent) → anomaly, not silent pass.
- Edge case: first run with no baseline → defined behavior (accept + seed baseline, no false anomaly).

**Verification:** Classifier returns accept/anomaly with the right reason for each scenario; blocklist/NSFW additions never gate.

---

### U6. Snapshot writer + sharding + git commit

**Goal:** Produce the versioned sharded snapshot and commit it to git as the source of truth.

**Requirements:** R4, R5.

**Dependencies:** U5 (accepted catalog).

**Files:**
- Create: `pipeline/src/snapshot.{ts,js}`
- Test: `pipeline/test/snapshot.test.{ts,js}`
- Modify: repo snapshot output location (e.g., `data/snapshot/` shards + `meta.json`)

**Approach:**
- Emit shards: `country/<code>.json`, `category/<slug>.json`, `channel-index.json` (id → {country, categories}), `meta.json` (version, generated-at, counts).
- Write to a `data/snapshot/` tree, committed to git (R4 pin/rollback). Keep shards small; verify the largest country shard size (KV 25 MB value limit — expected far under).

**Test scenarios:**
- Covers AE5. Happy path: accepted catalog produces per-country + per-category shards + channel-index + meta; rejecting an anomaly leaves the prior committed snapshot unchanged.
- Edge case: a channel in multiple categories appears in each category shard and resolves via channel-index.
- Edge case: snapshot version/generated-at increments monotonically.

**Verification:** A committed `data/snapshot/` tree exists with consistent shards + index + meta; a prior version is recoverable from git history.

---

### U7. Publish to Cloudflare KV + cache-invalidation hook

**Goal:** Push the accepted shards to KV and trigger cache invalidation — the contract the UI plan reads.

**Requirements:** R8, R11, R12.

**Dependencies:** U6.

**Files:**
- Create: `pipeline/src/publish-kv.{ts,js}`
- Test: `pipeline/test/publish-kv.test.{ts,js}`
- Create: `docs/research/2026-06-28-kv-read-contract.md` (key shapes for the UI plan)

**Approach:**
- Write each shard to KV under its key (`country:<code>`, `category:<slug>`, `channel-index`, `meta`) via the Cloudflare API, using a token from CI secrets.
- After write, call the cache-invalidation hook (purge-by-URL or purge-everything; document which) so the edge picks up new data without a deploy (R12). Default staleness bound ~12–24 h TTL (R11) is the UI plan's cache config; this unit guarantees the post-write purge call.
- Document the KV key/value contract for the UI plan.

**Test scenarios:**
- Happy path: accepted shards are written to the correct KV keys; `meta` reflects the new version.
- Integration: after a publish, the invalidation hook is invoked (mock the CF API; assert the purge call fires with the expected scope).
- Error path: a KV write failure aborts the publish without leaving a half-updated keyspace partially advertised by `meta` (write `meta` last).
- Edge case: re-publishing the same version is idempotent.

**Verification:** Shards land in KV, `meta` flips last, and the purge hook fires — a fresh edge read would return the new data (proven end-to-end in the UI plan).

---

### U8. Orchestration: daily GitHub Action

**Goal:** Wire the units into a scheduled job: pull → enrich → curate → diff → (auto-commit + publish | open anomaly PR).

**Requirements:** R6, R7, R12, R13.

**Dependencies:** U3–U7.

**Files:**
- Create: `pipeline/src/run.{ts,js}` (entrypoint)
- Create: `.github/workflows/v2-pipeline.yml`
- Test: `pipeline/test/run.test.{ts,js}` (orchestration branching)

**Approach:**
- Daily cron. Run the pipeline; on normal/fast-path → commit snapshot + publish to KV; on anomaly → open a review PR (reuse `peter-evans/create-pull-request` like the v1 workflow) with a human-readable diff summary and do NOT publish (prior snapshot stays live).
- Secrets (Cloudflare API token, GA4 Data API creds when later needed) only in GitHub Actions Secrets — never committed/logged (origin analytics R11).
- No metered cloud compute (R13); GitHub Actions free tier. Firebase stays Spark.

**Test scenarios:**
- Covers AE2/AE5. Happy path: a normal run commits + publishes with no human step.
- Edge case: an anomaly run opens a PR and does not publish; the live KV/snapshot is unchanged.
- Edge case (covers R12): a normal data refresh triggers no app build/deploy — only git commit + KV write.
- Error path: a mid-run failure (fetch/KV) fails the job loudly without a partial publish.

**Verification:** On a normal day the workflow commits + publishes unattended; on an injected anomaly it opens a PR and withholds publish; no app deploy is triggered by data changes.

---

## System-Wide Impact

- **Interaction graph:** the pipeline writes git (`data/snapshot/`) + Cloudflare KV; the UI plan's Worker reads KV. The old `playlistGenerator.js` + weekly Action are superseded (coexist until cutover).
- **Error propagation:** any ingest/curate/publish failure fails the job loudly; `meta` is written last so consumers never see a half-updated keyspace.
- **State lifecycle risks:** partial KV writes (mitigated by meta-last + idempotent re-publish); baseline bootstrap on first run; git history growth from daily snapshot commits (keep shards compact).
- **API surface parity:** the KV key/value contract (U7) is the shared interface with the UI plan — changes there ripple to rendering.
- **Unchanged invariants:** v1 CRA app + `playlist.json` remain until the v2 app cutover; this plan does not modify the v1 runtime.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Low browser-playable fraction undermines pure-linker (premise risk) | U1 probe runs first as explicit go/no-go before heavy build |
| SEO premise (SFW directory) may not rank | U2 reality check before committing the programmatic surface |
| iptv-org schema drift silently lets NSFW in / empties catalog | U5 schema + distribution validation; NSFW-presence band; fast-path only for additions |
| KV write partial failure | meta-last + idempotent re-publish (U7) |
| Cache invalidation depends on UI Worker cache config | U7 defines the contract; UI plan implements consumption; TTL bound as a fallback |
| Daily snapshot commits bloat git | compact shards; revisit retention if growth is material |
| Secret leakage (CF token, later GA4 key) | CI-secrets only, never committed/logged (U8) |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-28-v2-data-pipeline-requirements.md](../brainstorms/2026-06-28-v2-data-pipeline-requirements.md)
- Master index: [docs/brainstorms/2026-06-28-v2-master-brainstorm.md](../brainstorms/2026-06-28-v2-master-brainstorm.md)
- Existing pipeline: `playlistGenerator.js`, `.github/workflows/playlist-update.yml`
- Ideation background: [docs/ideation/2026-06-28-iptv-viewer-v2-ideation.md](../ideation/2026-06-28-iptv-viewer-v2-ideation.md)
