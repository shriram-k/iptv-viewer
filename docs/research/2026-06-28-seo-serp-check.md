# U2 — SEO / SERP Reality Check

**Date:** 2026-06-28
**Method:** SERP scan of representative target queries (US-region search). Indicative, not a full keyword-volume study.

## Target queries scanned

1. "watch free live tv online channels by country"
2. "free live tv streaming directory" / iptv-org-derived sites
3. "live tv guide what's on now free channels"

## What ranks today

**Generic "free live TV by country" — saturated.** First-page incumbents include livestreamlinks.net, freeintertv.com, famelack.com, livetv.center, vipotv.com, worldtvchannels.com, squidtv.net, globetv.app, tvchannels.live, cxtvlive.com. A crowded field of established directories, several explicitly "no signup, browse by country," exactly our proposed shape.

**iptv-org-derived directories — the exact niche is already occupied.** Multiple ranking sites are same-source clones, updated daily:
- freeiptv.app — "uses open data from iptv-org, updated daily," browse by category/language, copy M3U.
- free-codecs.com IPTV Finder — sources iptv-org, exports M3U.
- watchiptv.xyz — "all streams sourced from iptv-org."

These share **our exact source data and refresh cadence**. Generic derived pages from us would be near-duplicates competing against entrenched domains.

**"What's on now / TV guide" — strong incumbents, but a different content class.** TVGuide.com, OnTVTonight, TitanTV, Channel Master dominate mainstream-US listings; Pluto/Tubi/Roku own FAST. These are licensed/OTA, not iptv-org global streams — so for *iptv-org-style global/diaspora* channels, EPG-backed "what's on now" is largely **absent** from the clones.

## Interpretation

- **Best-in-class SEO mechanics (SSR, structured data, sitemaps) will not, by themselves, win.** The category is saturated with sites sharing our source data; mechanically-generated pages over a public dataset are the thin/duplicate-content pattern that doesn't outrank established same-source domains. This confirms the doc-review product-lens and adversarial findings.
- **A generic, global iptv-org directory is a weak SEO bet.** We'd be entrant #11 with identical data.
- **Two viable wedges exist** (and only these):
  1. **Liveness/trust differentiation** — "the directory where channels actually work," backed by our uptime/health history. The clones publish no uptime data; this is genuinely unique, indexable content (e.g., "<channel> — is it working / reliability"). Note: this is the analytics health time-series, currently *deferred* — this finding argues for surfacing a lightweight indexable form of it sooner.
  2. **Niche / diaspora focus + EPG "what's on now"** — pick a region/diaspora where the generic global clones are thin and EPG coverage is real; own those long-tail queries with program-level "now/next" the clones lack.

## Go/No-Go read

**QUALIFIED NO on the premise as written ("global, best-in-class-SEO iptv-org directory").** That specific bet competes head-on with entrenched same-source sites and is unlikely to win on SEO.

**GO is conditional on choosing a differentiator before building the SEO surface:**
- Commit to **liveness-first differentiation** (surface the health/uptime data as indexable content), and/or
- Commit to a **focused niche/region** rather than global breadth.

This directly informs **master open decision #5 (breadth vs. niche)** — the evidence points away from global-generic and toward niche + a unique-data angle. It also suggests pulling a lightweight indexable view of the health dataset forward from "deferred."

## Limitation

US-region SERP only; non-US/diaspora queries (the more winnable niche) weren't directly measured here. A focused niche decision should be validated with region-specific queries before committing.
