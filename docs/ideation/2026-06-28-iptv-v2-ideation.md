---
date: 2026-06-28
topic: iptv-viewer-v2
focus: v2 rebuild — TanStack Start (SSR), free no-bill hosting, custom subdomain, best-in-class SEO, Firebase analytics, donations-later
mode: repo-grounded
---

# Ideation: IPTV Viewer v2

A brand-new build of the IPTV viewer: clean/cool UX, server-side rendering, free hosting under a custom subdomain (`iptv.shriramkraja.com`), best-in-class SEO, analytics-only Firebase, and optional donation-based monetization later. Data continues to derive from the iptv-org project, pulled into a snapshot we control.

## Grounding Context

### Codebase Context (v1)
- Create React App SPA on GitHub Pages. Fetches a committed ~3.4MB `playlist.json` (regenerated weekly from the iptv-org API via a GitHub Actions PR; every recent commit is "updated playlist").
- Single React Context holds channels/countries/categories. `HashRouter` routing. Screens: Home (country + category carousels), Channels (`?country=`/`?category=`), Player (video.js, HLS), Search, Splash.
- Firebase initialized for Analytics only. No EPG, favorites, auth, or stream-health.

### External Context (2026, web-researched)
- **iptv-org API**: 12 static JSON endpoints (streams/channels/feeds/guides/blocklist/logos/categories/countries/languages/regions), Unlicense. `streams.json` carries `status` + `checked_at`; `channels.json` carries an `is_nsfw` flag; `blocklist.json` tracks DMCA/adult removals; `feeds.json` models multi-region signals; `guides.json` points to EPG sources (epg.pw offers hosted XMLTV).
- **Hosting bill-risk shape**: hard-capped free tiers (Cloudflare) physically cannot bill; metered Blaze services (Firebase App Hosting / Cloud Run, Firestore) can bill past allowances. Owner has Blaze enabled but wants no surprise bill.
- **TanStack Start v1** (verified live): URL-as-state primitives, deep TanStack Query integration (prefetch/cache/hydration), built-in streaming SSR (~5.5× throughput improvement post-launch). **Cloudflare is an officially supported deploy target** via `@cloudflare/vite-plugin` (Wrangler auto-detects); **static prerendering (SSG) to static assets is supported**. (OpenNext is Next.js-only — not used here.)
- **Playback failure modes**: dead streams, CORS (3 surfaces), mixed-content (HTTP stream on HTTPS page), geo-blocking (undetectable from the server's location). hls.js is lighter than video.js.
- **SEO/legal**: VideoObject/BroadcastEvent/ItemList JSON-LD; SSR/SSG beats CSR for crawlers. AdSense categorically high-risk for IPTV directories → ads dropped. NSFW on a domain tends to trigger SafeSearch classification of the whole domain → filtered out for SEO.

### Owner constraints (locked through refinement)
- **Stack**: TanStack Start + TanStack Router + TanStack Query. Query is the indicator of state; minimal global state management.
- **Hosting**: free, no surprise bill, custom subdomain `iptv.shriramkraja.com`, SSR. Best-in-class SEO.
- **Firebase**: analytics-only mindset. GA4 + Remote Config only. **No cloud user data, ever.**
- **Data**: keep a snapshot under our control (insulated from iptv-org takedowns/churn), refreshed periodically — do NOT fetch live at build/edge.
- **NSFW**: filter it out (chosen for maximum SEO friendliness).
- **Favorites**: localStorage only, no sync, no logging.
- **Monetization**: no ads. Ko-fi/donations later when traffic justifies it.

## Locked Architecture (summary)

- **Data pipeline**: scheduled pull of iptv-org → enrich (join channels/feeds/logos, attach health from `status`/`checked_at`, attach EPG refs) → **curate gate** (drop NSFW via `is_nsfw`, apply DMCA `blocklist.json`, drop dead/dupe) → **versioned snapshot committed to git** (pin/rollback = our takedown insurance) via a PR review gate → **sharded** per country/category → **prerendered to static assets**.
- **Rendering**: SSG-led. Catalog routes prerendered to static HTML from the snapshot; SSR/client only for live EPG + search.
- **State**: URL (typed Router search params) = navigation/filter state; TanStack Query = all remote/data state (loaders call `ensureQueryData`; catalog queries `staleTime: Infinity`, EPG short); localStorage = favorites. No Redux/Zustand/Context-store.
- **Hosting**: Cloudflare (`@cloudflare/vite-plugin`), prerendered routes as static assets (no Worker CPU), Workers for the thin dynamic surface; free custom subdomain; hard cap = no bill. Firebase = GA4 (aggregate events, IP-anonymized, no user-id) + Remote Config (kill-switch/featured). GCP budget alert at ~$1 as a tripwire.

## Ranked Ideas

### 1. Controlled, enriched snapshot → shard → prerender → edge (the data pipeline)
**Description:** Replace the single 3.4MB committed blob with a curated, enriched, SFW-filtered snapshot kept in git (versioned, pin/rollback), refreshed by a scheduled job behind a PR review gate, sharded per country/category, and prerendered to static assets served from Cloudflare's edge.
**Warrant:** `direct:` v1 ships one 3.4MB blob into a single Context and auto-commits weekly; `external:` git already gives the "data under our control, insulated from upstream takedowns" property the owner wants; TanStack Start supports static prerendering to assets on Cloudflare.
**Rationale:** This is the keystone every other idea sits on — it gives takedown insurance, content control (NSFW/DMCA filtering), tiny per-route payloads, free static serving, and the prerendered HTML that the SEO goal needs.
**Downsides:** Repo carries data (mitigated by sharding + it being our intended cache); snapshot is only as fresh as the refresh cadence; build/prerender step adds pipeline complexity vs. the current cron.
**Confidence:** 90% · **Complexity:** Medium · **Status:** Explored (brainstorm seed)

### 2. SEO foundation: SSG routes + programmatic pages + structured data
**Description:** Clean path routes (`/channel/$id`, `/country/$code`, `/category/$name`, `/language/$code` + intersections), each prerendered with `VideoObject`/`BroadcastEvent`/`ItemList` JSON-LD, dynamic `head`/meta, and a build-time sitemap.
**Warrant:** `direct:` v1's HashRouter is invisible to crawlers; `external:` Google structured-data types + SSG beating CSR for indexing.
**Rationale:** Directly serves "best-in-class SEO"; combinatorial indexable surface from data already held; fixes link previews.
**Downsides:** Thin auto-generated pages risk doorway-page penalties unless backed by real content (EPG); needs the SFW filter (idea 5) to avoid whole-domain SafeSearch classification.
**Confidence:** 85% · **Complexity:** Medium · **Status:** Unexplored

### 3. Best-effort liveness + graceful failure (not a guarantee)
**Description:** Use `status`/`checked_at`/blocklist as best-effort sorting + honest "last checked Nh ago" labels (not a "verified live" claim); client-side multi-URL failover in hls.js; honest failure UX ("may be offline or region-restricted in your area").
**Warrant:** `direct:` health fields + blocklist exist and v1 uses none; `reasoned:` geo-blocking is undetectable from the server and `checked_at` lags → certainty is impossible, so the honest framing is correct.
**Rationale:** Cuts dead-clicks and softens failures without overpromising — the realistic version of the "only-working-channels" idea.
**Downsides:** Not a guarantee; the only real-time signal is crowd-sourced (idea 6), which needs traffic.
**Confidence:** 60% · **Complexity:** Medium · **Status:** Unexplored

### 4. "What's on now" EPG / live board
**Description:** Ingest EPG (`guides.json` → epg.pw hosted XMLTV) for now/next labels; make "live right now" a hero surface. Time-relevant content = SEO freshness + return visits. Ship only where EPG exists; degrade gracefully.
**Warrant:** `external:` guides.json + epg.pw; `direct:` v1 has no EPG (top gap vs. real TV).
**Rationale:** Turns "list of channels" into "what can I watch now"; freshest, most rankable SEO surface (pairs with idea 2).
**Downsides:** Coverage is patchy and timezone-heavy; partial coverage can feel broken.
**Confidence:** 70% · **Complexity:** Medium-High · **Status:** Unexplored

### 5. Curation gate: SFW filter + DMCA blocklist + dead/dupe removal
**Description:** In the pull job, drop NSFW (`is_nsfw` + adult category), apply DMCA `blocklist.json`, remove dead/dupe feeds — before the snapshot is committed. SFW-only catalog by construction.
**Warrant:** `direct:` `is_nsfw` flag + `blocklist.json` exist; `external:` NSFW triggers whole-domain SafeSearch classification, undercutting the SEO goal.
**Rationale:** Keeps the domain SFW for maximum SEO friendliness (the stated priority), removes age-gate/host-ToS/Google-service friction, and is free DMCA insurance.
**Downsides:** Lowers the raw traffic ceiling (adult content was historically a large share) — an accepted trade for SEO quality.
**Confidence:** 85% · **Complexity:** Low · **Status:** Unexplored

### 6. Analytics that compounds — aggregate only, no user data
**Description:** Typed GA4 event taxonomy (`channel_play`, `watch_duration`, `stream_error`, `first_frame_ms`) wired once into the hls.js lifecycle; IP-anonymized, no user-id. Stream-health history kept as git-committed JSON deltas (the pull job already commits). Crowd-sourced liveness read back via the GA4 Data API during the pull job to inform next snapshot's sorting.
**Warrant:** `external:` GA4 unlimited/free; `reasoned:` a consistent taxonomy is the prerequisite for later "trending" rails — and none of it requires cloud user data or Firestore-per-request.
**Rationale:** Answers "improve analytics" while honoring no-cloud-user-data and no-bill.
**Downsides:** Behavioral signal needs traffic volume; GA4 Data API adds a read step in the pull job.
**Confidence:** 82% · **Complexity:** Low-Medium · **Status:** Unexplored

### 7. Engagement primitives on the free tier (no cloud state)
**Description:** localStorage-only favorites + recently-watched (no sync, no logging); installable PWA; Firebase Remote Config (free) as kill-switch + featured-curation lever changeable without redeploy.
**Warrant:** `direct:` v1 has no favorites and Firebase is already wired; `external:` Remote Config is free/unlimited.
**Rationale:** Retention without the auth/storage/privacy stack; a free content/safety control plane.
**Downsides:** Favorites don't cross devices (acceptable — owner explicitly does not want sync).
**Confidence:** 80% · **Complexity:** Low-Medium · **Status:** Unexplored

### 8. Legal posture + donations-later
**Description:** Stay a pure linker/indexer of Unlicense data (don't rehost by default), show a provenance disclaimer, honor the blocklist. No ads (AdSense high-risk). Earmark Ko-fi/donations for when traffic justifies it (donations are allowed even on restrictive hosts).
**Warrant:** `external:` AdSense bars unauthorized-content links; iptv-org "linking" defense has weak precedent; donations are broadly permitted.
**Rationale:** Free insurance now; keeps a realistic monetization door open without compromising hosting/SEO.
**Downsides:** Donations alone won't scale revenue; linker-posture limits some richer playback features.
**Confidence:** 80% · **Complexity:** Low · **Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Delete the snapshot, fetch iptv-org live at build/edge | Reversed by owner — live-fetch makes the catalog hostage to upstream takedowns; controlled git snapshot is a feature |
| 2 | Firestore as the catalog store / per-request reads | Bill-risk + backend; git snapshot served static is cheaper and gives pin/rollback |
| 3 | Firestore/Auth favorites sync | Owner wants zero cloud user data; localStorage-only |
| 4 | "Verified live / only-working channels" (hard guarantee) | Geo-block undetectable server-side + `checked_at` lags → overpromise; softened to best-effort (idea 3) |
| 5 | Keep NSFW (with age-gate/safe-mode containment) | Reversed by owner — full SFW filter chosen for maximum SEO friendliness |
| 6 | Ad monetization / AdSense / FAST-channel pivot for ad eligibility | Ads dropped; donations-later instead |
| 7 | Public API / embeddable widget / enriched dataset-as-product | Real leverage but premature for personal v1 — defer |
| 8 | Subway/topology-map UI, zap/shuffle preload, logo-derived design system | Brainstorm-level UI polish, not core architecture |
| 9 | Niche/diaspora single-country focus | Strong positioning bet but a strategy pivot — revisit in brainstorm if SEO breadth underperforms |
| 10 | Personal owner-only private mode | Conflicts with the public-SEO goal |
| 11 | Stateless URL/QR favorites | Weaker duplicate of localStorage favorites (idea 7) |
| 12 | Firebase App Hosting / Cloud Run as the host | Metered → bill-risk; Cloudflare's hard cap is safer for the no-surprise-bill constraint |
