---
date: 2026-06-28
topic: v2-master
---

# IPTV Viewer v2 — Master Brainstorm Index

Single entry point for the v2 rebuild. Frames the product, records the cross-cutting decisions every feature inherits, and links the per-feature requirements docs.

Upstream context: [`docs/ideation/2026-06-28-iptv-viewer-v2-ideation.md`](../ideation/2026-06-28-iptv-viewer-v2-ideation.md)

---

## Product in one line

A clean, fast, SEO-first web guide to free live TV — derived from a controlled, SFW snapshot of the iptv-org catalog — running free under `iptv.shriramkraja.com`.

## Cross-cutting decisions (inherited by every feature doc)

- **Stack:** TanStack Start + TanStack Router + TanStack Query. Query is the source of truth for remote state; URL (typed Router search params) holds navigation/filter state; localStorage holds the only client-owned persistent state. No Redux/Zustand/Context-store.
- **Hosting:** Cloudflare (hard-capped free tier — cannot bill); free custom subdomain. Rendering is edge-SSR + edge-cache; data refresh is decoupled from code deploy.
- **Firebase:** GA4 analytics + Remote Config only. **No cloud user data, ever.**
- **Data:** controlled, enriched, SFW-filtered snapshot in git → runtime store → edge. See the data-pipeline doc.
- **Content:** NSFW filtered out (chosen for maximum SEO friendliness).
- **Monetization:** no ads; Ko-fi/donations later when traffic justifies it.
- **Cost guard:** no Firestore-per-request; static/cached serving. Cloudflare's free tier is a true hard cap; Firebase/GCP on Blaze is **not** capped by a budget alert (notify-only) — keep Firebase on Spark or add a billing-disable function (see pipeline R13).

## Actors (product-wide)

- Visitor / crawler — browses hubs and channel pages, plays streams.
- Maintainer (owner) — reviews anomaly PRs, curates via Remote Config, pins/rolls back.
- Pull job — daily ingestion/enrichment/curation automation.
- Runtime app — TanStack Start on Cloudflare.

## Feature map

| # | Feature | Doc | Status |
|---|---------|-----|--------|
| 1 | Channel data pipeline | [v2-data-pipeline-requirements.md](2026-06-28-v2-data-pipeline-requirements.md) | ✅ Written |
| 2 | Player & playback | [v2-player-requirements.md](2026-06-28-v2-player-requirements.md) | ✅ Written |
| 3 | EPG / "what's on now" | [v2-epg-requirements.md](2026-06-28-v2-epg-requirements.md) | ✅ Written |
| 4 | Engagement (favorites / PWA / curation) | [v2-engagement-requirements.md](2026-06-28-v2-engagement-requirements.md) | ✅ Written |
| 5 | Analytics & health telemetry | [v2-analytics-requirements.md](2026-06-28-v2-analytics-requirements.md) | ✅ Written |
| 6 | UI / UX & information architecture | [v2-ui-ux-requirements.md](2026-06-28-v2-ui-ux-requirements.md) | ✅ Written |
| 7 | Monetization | [v2-monetization-requirements.md](2026-06-28-v2-monetization-requirements.md) | ✅ Written |

## Recommended build order

Pipeline (foundation) → Player (core value) → UI/UX (shell the features live in) → EPG + Engagement + Analytics (enrichment, parallelizable) → Monetization (deferred until traffic).

## Proposed v1 cut (from doc review — needs owner sign-off)

Doc review flagged that all ~50 requirements read as equally required, which is over-scoped for a solo "stay small" project. Proposed lean v1 (everything else is additive, no architectural change to add later):

**Ship in v1:** pipeline (all, incl. sanitization + fast-path blocklist + browser-playability hint); player (all); UI/UX core (home, `/country`, `/category`, `/channel`, `/search`, `/favorites` — **no** hub-intersection or language-hub routes yet); engagement = localStorage favorites/history + Remote Config kill-switch + featured rails + PWA **manifest**; analytics = event taxonomy + Consent Mode; EPG = now/next labels + silent degradation.

**Defer to v1.5+:** EPG Live-now board; analytics health time-series productization + GA4 feedback loop (R7); PWA service worker / offline caching; Remote Config feature flags; hub-intersection + language-hub routes; BroadcastEvent EPG structured data; monetization.

## Open review decisions (resolve before / at planning)

1. **Confirm the v1 cut above** (owner).
2. **Native-browser-playability probe** — measure the actually-playable fraction of the catalog before committing pure-linker (pipeline R18 / Outstanding Questions). Go/no-go input.
3. **SEO reality check** — keyword/SERP scan of target queries; confirm the SFW-derived-directory category is winnable vs. existing clones and not penalized as scaled/thin content, before building the programmatic SEO surface.
4. **Firebase Blaze → Spark, or add a billing-disable function** — a budget alert is not a no-bill guarantee.
5. **Breadth vs. focus** — global-175-countries vs. a deep diaspora/region launch; the EPG coverage-gate already concedes the product only shines in a few regions.
