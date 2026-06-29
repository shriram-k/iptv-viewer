---
date: 2026-06-28
topic: v2-data-pipeline
---

# IPTV Viewer v2 — Channel Data Pipeline

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

A daily, self-curating pipeline that turns the volatile iptv-org feed into a SFW, health-tagged channel snapshot kept under our control in git, auto-deploying data on normal diffs and pausing for human review only on anomalies — with the snapshot served as a runtime data source so the app reads fresh data without rebuilding, and code deploys only when code changes.

---

## Problem Frame

The v1 app commits a single ~3.25 MB `playlist.json` (13,509 stream entries, 175 countries, 28 categories) regenerated weekly and loaded whole into the browser. Two pains compound. First, the data is a direct, unfiltered mirror of iptv-org, which is volatile: streams die constantly, and the upstream catalog shifts under DMCA takedowns and content-policy changes (adult content was historically the bulk of such churn). A live mirror means our catalog breaks or mutates whenever theirs does, with no buffer and no record of what changed. Second, the weekly monolithic blob is stale between runs, ships megabytes the visitor doesn't need, and renders nothing for crawlers — leaving the v2 goals of freshness, fast loads, and best-in-class SEO unreachable.

The v2 rebuild is constrained to free, no-surprise-bill hosting under `iptv.shriramkraja.com`, with TanStack Start + Router + Query as the stack, Firebase limited to analytics, and no user data in the cloud. Every other v2 feature (player, EPG, favorites, analytics) depends on having a trustworthy, controlled catalog to read from first.

---

## Actors

- A1. Pull job: scheduled automation that ingests iptv-org, enriches, curates, diffs against the previous snapshot, and either commits or opens a review PR.
- A2. Maintainer: the owner; reviews and approves/rejects anomaly PRs, and pins or rolls back snapshots when upstream breaks something.
- A3. Runtime app: the TanStack Start application on Cloudflare that reads the snapshot and renders hub and channel pages via edge SSR with caching.
- A4. Snapshot store: the runtime data source (fed by the daily git push) that serves the sharded snapshot to the runtime app.

---

## Key Flows

- F1. Daily refresh — happy path
  - **Trigger:** Daily schedule fires the pull job.
  - **Actors:** A1, A4, A3
  - **Steps:** Pull iptv-org endpoints → enrich (join channels/feeds/logos, attach `status`/`checked_at`) → curate (drop NSFW, apply DMCA blocklist, drop dead/dupe) → shard → diff against previous snapshot → diff is within normal bounds → commit + push snapshot → publish to the snapshot store → expire/purge edge cache.
  - **Outcome:** Live catalog reflects today's data; no code build or deploy occurred.
  - **Covered by:** R1, R2, R3, R4, R5, R8, R12

- F2. Anomaly review
  - **Trigger:** The daily diff exceeds an anomaly threshold (large removal, emptied country, schema drift, blocklist spike).
  - **Actors:** A1, A2
  - **Steps:** Pull job halts auto-publish → opens a PR containing the candidate snapshot and a human-readable diff summary → maintainer reviews → approves (merge → publish) or rejects (discard; the live snapshot is unchanged).
  - **Outcome:** No anomalous data reaches production without maintainer approval; the previous good snapshot keeps serving until then.
  - **Covered by:** R6, R7

- F3. Page render at runtime
  - **Trigger:** A visitor or crawler requests a hub or channel URL.
  - **Actors:** A3, A4
  - **Steps:** Edge cache hit → serve cached HTML; cache miss → read the relevant snapshot shard from the store → SSR full HTML → cache until TTL/purge.
  - **Outcome:** Fully-rendered, crawlable HTML on every route; bulk of traffic served from cache with no per-request data build.
  - **Covered by:** R9, R10, R11, R12

---

## Requirements

**Ingestion & enrichment**
- R1. Pull the iptv-org public endpoints needed to assemble the catalog (streams, channels, feeds, logos, categories, countries, languages, regions, blocklist, **guides** — `guides` supplies each channel's EPG source reference consumed by the EPG feature).
- R2. Produce an enriched channel model that joins channel/feed/logo metadata and attaches each stream's last-known `status` and `checked_at`, and retains the full list of stream URLs per channel (so the downstream player can attempt multi-URL failover).
- R17. Serve logo assets from our own origin or a controlled cache (e.g., Cloudflare Images / R2), not hotlinked from third-party CDNs — avoids leaking visitor IPs to unconsented third parties on page load and removes the external-CDN availability dependency.
- R18. Compute a best-effort *browser*-playability hint per stream (HTTPS + a CORS/mixed-content probe) in the pull job, distinct from iptv-org's `status`, and order channels so browser-playable streams surface first. "Online upstream" ≠ "plays in a browser on our HTTPS page."

**Curation gate**
- R3. Before a snapshot is accepted, exclude NSFW entries (via the `is_nsfw` flag and adult category), apply the DMCA `blocklist.json`, and drop dead and duplicate entries — yielding a SFW-only catalog.
- R14. Sanitize all string and URL values ingested from external sources (iptv-org JSON, XMLTV) before they enter the snapshot: HTML-escape text used in markup; additionally escape `</` → `<\/` for any value embedded in JSON-LD `<script>` blocks; reject/strip URL fields whose scheme is not `http(s)` (no `javascript:` / `data:`). A single poisoned upstream entry must not reach SSR HTML or structured data.
- R15. Do not rely solely on `is_nsfw` + category for the SFW gate: also apply a keyword blocklist over channel names/URLs, and treat a drop/rename of the `is_nsfw` field or a rise in unflagged new channels as an anomaly (R7). A single missed NSFW channel can SafeSearch-demote the whole domain. (Note: SFW filtering is a brand-safety/SEO control, not a copyright control — the only copyright lever is the upstream-dependent `blocklist.json`.)

**Snapshot, versioning & control**
- R4. Persist each accepted snapshot to git as the system of record, so any prior snapshot can be pinned or rolled back to.
- R5. Store the snapshot sharded by country and category, so a given page render reads only its relevant slice rather than the whole catalog.
- R8. Publish the accepted snapshot to a runtime store that the app reads at request time; the snapshot is NOT bundled into the deployed build artifact.

**Refresh automation & anomaly gate**
- R6. Run the pull job on a daily schedule; when the diff against the previous snapshot is within normal bounds, accept and publish it automatically with no human step.
- R7. When the diff exceeds an anomaly threshold (e.g., a large share of channels removed, a country emptied, upstream schema change), do not auto-publish; instead open a review PR with a human-readable diff summary and leave the previous snapshot live until the maintainer approves. **Exception — blocklist and NSFW *additions* always fast-path and apply immediately; they must never be the signal that pauses a publish** (delaying them would keep DMCA-flagged or adult content live, inverting the one compliance signal that should apply at once).
- R16. Anomaly detection must compare against a rolling baseline (e.g., a 7–14-day-prior snapshot and per-scope trend), not only day-over-day, so slow sub-threshold erosion is caught; and must validate expected schema/field presence and value distributions (e.g., NSFW share within its historical band), treating unexpected catalog *growth* or distribution shifts as anomalies too — not only shrinkage.

**Rendering & SEO**
- R9. Render all routes (country/category/language hubs, hub intersections, and individual channel pages) via edge SSR so every page returns fully-rendered, crawlable HTML.
- R10. Emit per-page metadata and structured data (e.g., `ItemList` for hubs, `VideoObject`/`BroadcastEvent` for channels) and a sitemap covering the indexable routes.
- R11. Cache rendered pages at the edge and serve from cache on subsequent requests; bound staleness to roughly one day via TTL or an explicit cache purge in the pull job.

**Refresh/deploy decoupling & cost guardrails**
- R12. A data refresh (daily snapshot change) must take effect via the runtime store + cache expiry without triggering a code build or deploy; builds/deploys occur only when application code changes.
- R13. Keep cost unbillable by construction, and note the asymmetry: Cloudflare's free tier is a genuine hard cap (cannot bill). Firebase/GCP on Blaze is NOT — a budget alert only notifies, it does not stop spend (Cloud Logging, GA4 Data API under a crawl spike, and egress are real bill paths). Either keep the Firebase project on Spark (no billing account) so it truly cannot bill, or add a billing-disable function triggered by a budget Pub/Sub event; a budget alert alone is not a backstop. (See Outstanding Questions.)

---

## Acceptance Examples

- AE1. **Covers R3.** Given an upstream channel flagged `is_nsfw` or present in `blocklist.json`, when the pull job builds the snapshot, that channel does not appear in the published catalog or in any rendered page or sitemap.
- AE2. **Covers R6, R7.** Given a daily diff where ~3% of channels changed, when the pull job runs, it auto-publishes without a PR; given a diff where an entire country's channels vanish, it instead opens a review PR and the previous snapshot keeps serving.
- AE3. **Covers R12.** Given only the snapshot changed (no code change), when the daily refresh completes, the live site reflects the new data and no Cloudflare build/deploy was triggered.
- AE4. **Covers R9, R11.** Given a channel page that has never been requested, when a crawler fetches it, it receives fully-rendered HTML; given a second request before TTL expiry, it is served from edge cache.
- AE5. **Covers R7, R4.** Given the maintainer rejects an anomaly PR, when the next request arrives, the site still serves the last good snapshot unchanged.

---

## Success Criteria

- The live catalog is SFW, reflects upstream within ~1 day, and never silently absorbs an anomalous upstream change without the maintainer's approval.
- When upstream breaks or removes content, the maintainer can pin or roll back to a known-good snapshot from git without a code change.
- Every hub and channel URL returns crawlable, structured-data-bearing HTML, and the indexable surface is discoverable via sitemap.
- A normal day requires zero human action and triggers zero code deploy; operation stays provably within no-bill limits.
- `ce-plan` can choose the runtime store, shard layout, anomaly thresholds, and cache mechanism without having to re-decide any product behavior, scope boundary, or success criterion from this doc.

---

## Scope Boundaries

- EPG / "what's on now" data — time-sensitive, cannot live in a daily snapshot; its own later feature.
- Player UX — hls.js integration, multi-URL failover behavior, and failure diagnosis. This pipeline only *carries* the stream URLs and status the player needs.
- Favorites, recently-watched, PWA install, and Remote Config engagement layer.
- Analytics event taxonomy and the git-committed stream-health time-series.
- Visual/UI design of hub and channel pages.
- Monetization / donations wiring.
- Real-time or sub-daily liveness guarantees — liveness is best-effort; the snapshot's status may be up to a day stale by design.

---

## Key Decisions

- Keep a controlled git snapshot rather than mirroring iptv-org live: git provides versioning, pin/rollback, and a buffer against upstream *availability* breakage. **Caveat:** rolling back past an upstream *for-cause* (DMCA/policy) removal would make us the affirmative, on-record decision-maker and turn the git/PR trail into a willfulness record — so rollback/pin is sanctioned only for availability regressions (mass dead streams, schema breakage), never to re-add content upstream deliberately dropped.
- Daily auto-accept with an anomaly-only review gate (not always-review, not on-demand-only): balances freshness against the chore of approving every refresh, while still gating the dangerous changes.
- Decouple the snapshot from the deploy artifact: data refresh becomes a git push + cache expiry, so the app reads fresh data without a daily rebuild; this also removes daily CI/deploy churn.
- Render hubs via edge SSR + cache rather than build-time static prerender: keeps SEO/perf essentially equivalent while preserving the no-redeploy-on-data-change property.
- Filter NSFW entirely (vs. age-gating/containment): chosen for maximum SEO friendliness, accepting a lower raw-traffic ceiling.
- Host on Cloudflare's hard-capped free tier rather than metered Firebase App Hosting: a hard cap cannot bill; Firebase stays limited to GA4 + Remote Config, with no cloud user data.

---

## Dependencies / Assumptions

- Depends on the iptv-org public JSON API remaining available and roughly stable in shape; schema drift is treated as an anomaly (R7), not a silent failure.
- Assumes a daily snapshot keeps stream `status` fresh enough for best-effort sorting/labeling; real-time accuracy is delegated to the player's failover.
- Assumes Cloudflare free-tier build and Workers limits comfortably cover a low-traffic personal site, and that edge SSR of a hub/channel page fits within per-request CPU limits once caching absorbs the bulk of traffic. **Unproven:** edge-SSR-on-miss against the free-tier ~10 ms/request CPU and 100k req/day caps is untested under cold crawl (the daily purge re-renders pages cold, so crawler cache-hit rate stays low). Plan to prerender the highest-value/largest hubs + top channels and run an early CPU spike before relying on this. The 100k/day cap means spikes degrade to errors, not bills — an availability cliff to accept consciously.
- Assumes a free runtime store option exists (Cloudflare KV, an R2 bucket, or serving the git shards via a CDN such as jsDelivr); the snapshot remains mirrored in git for control regardless of which is chosen.

---

## Outstanding Questions

### Resolve Before Planning

- [Owner decision] Drop Firebase Blaze → Spark, or implement a hard billing-disable function (R13). A budget alert alone does not guarantee no-bill.
- [Pre-planning task] Run a native-browser-playability probe on a sample of the current catalog (HTTPS + CORS/mixed-content) to measure the actually-playable fraction before committing the pure-linker design (R18; see player doc). If the fraction is low, reconsider pure-linker vs. a narrow proxy or an HTTPS-playable-only catalog.

### Deferred to Planning

- [Affects R8][Technical] Which runtime store backs the snapshot — Cloudflare KV vs. R2 vs. serving git shards via a CDN — and how the daily push publishes to it.
- [Affects R7, R16][Needs research] Concrete rolling-baseline window and per-scope thresholds; a starting heuristic (>15% catalog removal, or >50% in any one country/day) is researchable from iptv-org churn history.
- [Affects R5][Technical] Shard granularity and key scheme (per-country, per-category, per-channel-within-shard) and how the channel route resolves its shard.
- [Affects R6, R7][Needs research] Concrete anomaly thresholds and which signals to compute (percentage removed, per-country deltas, schema hash, blocklist delta).
- [Affects R11][Technical] Cache strategy — fixed daily TTL vs. explicit Cloudflare cache purge triggered by the pull job — and how versioning/cache-busting is handled.
- [Affects R1][Technical] Where the pull/enrich/curate job runs (GitHub Actions, as today, vs. another scheduler) and how it opens anomaly PRs.
- [Affects R10][Technical] Sitemap generation approach and whether a small set of top pages warrants build-time prerender as a cold-start optimization.
