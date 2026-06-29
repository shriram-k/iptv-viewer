---
date: 2026-06-28
topic: v2-analytics
---

# IPTV Viewer v2 — Analytics & Health Telemetry

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

A deliberate, aggregate-only GA4 event taxonomy (no user identity, no PII), a git-committed stream-health time-series built from the daily pipeline, and a read-back loop that turns real playback outcomes into better channel sorting — all within the free tier and the no-cloud-user-data rule.

---

## Problem Frame

v1 initializes Firebase Analytics but captures no deliberate events, so there is no signal about what people watch, what fails, or which streams are actually alive for real users. The owner wants analytics, explicitly *not* user data — counts and trends, never identities. Two distinct needs sit here: observability (what's happening) and a compounding asset (a history of stream health that no one else publishes, and a feedback loop that improves the product). Both must avoid per-user storage, Firestore-per-request, and any bill.

---

## Actors

- A1. Runtime app: emits aggregate GA4 events from real visitor behavior and the player lifecycle.
- A2. Pull job: appends a daily health snapshot to git and reads aggregate GA4 metrics back to inform catalog sorting.
- A3. Maintainer: reads GA4 dashboards to understand usage and health trends.

---

## Requirements

**Event taxonomy (aggregate, identity-free)**
- R1. Define and emit a stable GA4 event taxonomy covering at least: channel play attempt, play success / first-frame time, watch duration, stream error (with failure-class dimension), search performed, and board/hub navigation.
- R2. Attach consistent aggregate dimensions (channel id, country, category, language, failure class) so events are groupable without identifying a person.
- R3. Emit no user identifier, no cross-session id, and no PII; enable IP anonymization. Analytics is counts and trends only.

**Privacy & consent**
- R4. Implement GA4 Consent Mode with `analytics_storage` (and `ad_storage` if used) defaulting to **`denied`** before any consent signal is received — consent must be set before gtag initializes or any event fires (a "fire on load + banner in parallel" default is an ePrivacy violation). A geo-targeted default (deny for EU/EEA, grant elsewhere) is acceptable but must be decided before build, not deferred. Provide a lightweight consent affordance; the site stays fully usable when consent is declined (analytics simply degrades). This is a legal requirement, not a UX preference.

**Health time-series (compounding asset)**
- R5. On each daily run, the pull job appends a compact per-stream health snapshot (status + checked_at + derived health) to a git-committed time-series, building an uptime history over time.
- R6. The health history is versioned in git (not a database), incurs no per-request cost, and is consumable as a dataset.

**Feedback loop**
- R7. **(Deferred to post-v1 — dormant until real traffic exists; day-one ranking comes from the pipeline's own health/playability checks, pipeline R18.)** When traffic justifies it, the pull job reads aggregate GA4 metrics (via the GA4 Data API) and folds recent successful-play/error counts into the next snapshot's channel ordering. Scope the read-back to head channels with enough events — GA4 buckets a ~13.5k-value `channel_id` dimension into "(other)" and thresholds low-traffic rows, so the long tail ranks from pipeline health, not GA4. Include an exploration/decay term so recovered streams resurface rather than staying buried.
- R8. The read-back uses only aggregate metrics; it never pulls or stores individual-user data.
- R11. GA4 Data API credentials (service-account key or Workload Identity) live exclusively in the CI secret store — never written to files committed to git, never logged, and rotated on a schedule. Unlike the public Firebase client config, this is a private secret whose leak grants read access to all analytics.

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given a visitor plays a channel that then errors, when the events fire, GA4 records a play attempt and a stream_error tagged with channel/country/category/failure-class — and nothing that identifies the visitor.
- AE2. **Covers R4.** Given an EU visitor declines analytics consent, when they browse and play, the site works normally and no analytics cookies/collection occur.
- AE3. **Covers R5, R6.** Given the pipeline has run for 30 days, when the maintainer inspects git history, a per-stream health series exists showing uptime over that window, with no database involved.
- AE4. **Covers R7, R8.** Given a channel that real users consistently fail to play, when the next snapshot builds, that channel is ranked lower — derived from aggregate counts, with no per-user data read.

---

## Success Criteria

- The owner can answer "what's watched, what fails, and what's reliably live" from GA4 + the health series, without any user data existing in the cloud.
- The health time-series accrues as a unique, zero-cost dataset that improves with age.
- Real playback outcomes measurably improve channel sorting over time.
- Consent handling keeps the site compliant for EU visitors without harming UX.
- `ce-plan` can implement analytics without re-deciding the identity-free stance, the git-as-store choice, or the feedback-loop boundary.

---

## Scope Boundaries

- Per-user profiles, user ids, cohorts, or any identity graph — excluded.
- Firestore or any per-request analytics backend — excluded (git + GA4 only).
- Personalized recommendations derived from an individual's history — excluded; sorting is global/aggregate.
- A public analytics/health API or dashboard site — deferred (the dataset exists in git; productizing it is later).
- Real-time liveness guarantees — the feedback loop improves ordering on the daily cadence, not instantly.

---

## Key Decisions

- Aggregate-only, identity-free GA4: we build no identity graph and do no cross-session tracking. This does **not** mean "no personal data" — GA4 still transmits visitor IP (anonymized server-side, i.e. after transmission) and sets persistent cookies, which is personal-data processing under GDPR; the lawful basis is consent (R4). "Aggregate-only" constrains how we *use* the data, not whether GDPR applies.
- Health history in git, not a database: free, versioned, diffable, and consistent with the pipeline already committing daily — avoids Firestore cost/bill.
- Aggregate feedback loop over per-user personalization: improves the product for everyone using counts, keeping the no-user-data line intact.
- Consent Mode included from the start: GA4 uses cookies; building consent in avoids a compliance retrofit and protects the SEO-friendly, trustworthy posture.

---

## Dependencies / Assumptions

- Depends on the player emitting accurate lifecycle signals (play attempt, first-frame, error class) — see [player doc](2026-06-28-v2-player-requirements.md).
- Depends on the pull job (pipeline) for the daily health append and the GA4 Data API read-back — see [data-pipeline doc](2026-06-28-v2-data-pipeline-requirements.md).
- Assumes GA4 Data API aggregate access is sufficient and free at this scale, and that GA4 Consent Mode meets the relevant jurisdictions.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Final event names/params and how player failure classes map to the stream_error dimension.
- [Affects R5][Technical] Health-series file format and granularity (per-stream vs per-channel, daily deltas vs rolling aggregate) to keep git size sane over years.
- [Affects R7][Needs research] Which GA4 Data API metrics best proxy "works for real users," and the lookback window for the sorting signal.
- [Affects R4][User decision likely] Consent UX — minimal banner vs region-gated prompt — and default behavior before a choice is made.
