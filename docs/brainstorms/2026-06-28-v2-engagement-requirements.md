---
date: 2026-06-28
topic: v2-engagement
---

# IPTV Viewer v2 — Engagement (Favorites, PWA, Curation)

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

Device-local favorites and recently-watched (localStorage, no accounts, no sync), an installable PWA shell, and a Firebase Remote Config control plane that lets the maintainer feature collections and instantly hide channels without a redeploy.

---

## Problem Frame

v1 starts every visit from zero — no way to keep the channels you return to, no memory of what you just watched, and no path to install it like an app. Separately, the maintainer has no fast lever: today, removing a problematic channel or featuring something means editing data and waiting for the weekly pipeline + a deploy. Both gaps must be closed under hard constraints: no cloud user data of any kind, and no per-request backend or bill.

---

## Actors

- A1. Visitor: favorites channels, returns to them, installs the app.
- A2. Maintainer: features collections and flips kill-switches/flags via Remote Config, without touching code or waiting for the pipeline.
- A3. Runtime app: persists engagement state locally and reads Remote Config to shape what renders.

---

## Requirements

**Favorites & history (device-local)**
- R1. Let the visitor favorite/unfavorite a channel from the channel card and the channel/player page, persisted in localStorage with no account and no network call.
- R2. Provide a Favorites view listing the visitor's saved channels; surface it prominently when non-empty (e.g., a home rail and/or a dedicated route).
- R3. Track recently-watched channels locally and present them as a rail, most-recent first, with a bounded length.
- R4. Store no favorites/history/identity off-device; clearing browser storage clears this state, and that is acceptable by design (no sync, no recovery).

**PWA**
- R5. v1: ship the web-app manifest so the site is installable / add-to-home-screen (cheap, ~10 lines). The service worker is R6 (post-v1).
- R6. **(Post-v1.)** A service worker caching the app shell + last-viewed catalog slices for offline *browsing*; live playback always needs a network (degrade with a clear offline notice). The SW catalog cache must be versioned against the daily snapshot + edge purge so it never serves stale data independently — a real cache-invalidation cost that justifies deferring it past v1.

**Remote Config control plane**
- R7. Read Firebase Remote Config at runtime to drive maintainer-controlled presentation: featured collections/rails and a optional site-wide announcement/notice.
- R8. Support a Remote Config kill-switch that immediately hides specific channels (or a guide/stream source) from browse, boards, and rendering — taking effect without a pipeline run or code deploy. Scope note: this is UI-layer hiding only; stream URLs remain in the committed snapshot, the runtime store, and edge-cached HTML until TTL. For DMCA-grade removal the pipeline must run a curated snapshot update **plus** a cache purge — the kill-switch stops new rendering while that data-layer removal is in progress, it does not complete a takedown.
- R9. **(Post-v1.)** Support Remote Config feature flags to gate feature rollout without a deploy. Deferred for v1 — a solo project can gate with a code constant or branch; add a flag when a specific feature actually needs runtime gating.
- R10. Remote Config carries only configuration, never user data; its use adds no per-user storage and stays within the free tier.

---

## Acceptance Examples

- AE1. **Covers R1, R4.** Given a visitor favorites three channels and reloads, when the page returns, the favorites persist; when they clear browser storage, the favorites are gone and the app treats that as a normal empty state.
- AE2. **Covers R8.** Given the maintainer adds a channel ID to the Remote Config kill-list, when visitors next load the app, that channel no longer appears anywhere — with no deploy and before the next daily pipeline run.
- AE3. **Covers R6.** Given the device is offline, when the visitor opens the installed app, they can browse the cached catalog but a play attempt shows a clear "you're offline" message.
- AE4. **Covers R2, R3.** Given a returning visitor with favorites and watch history, when they open home, both a Favorites rail and a Recently-watched rail appear above generic browse.

---

## Success Criteria

- A returning visitor lands on their channels, not a cold catalog — with zero login and zero data leaving the device.
- The maintainer can feature content or kill a channel from a phone in seconds, without a deploy or pipeline run.
- Nothing in this feature creates cloud user data or a hosting bill.
- `ce-plan` can implement engagement without re-deciding the no-sync/no-account stance or the Remote Config control surface.

---

## Scope Boundaries

- Cross-device sync of favorites/history — explicitly excluded (no cloud user data).
- Accounts / auth — excluded.
- Shareable/exportable favorites via URL or QR — not in v2 (was considered and cut as a weaker variant of local-first).
- Push notifications / reminders — excluded (imply identity + server state).
- Full offline playback — impossible for live streams; offline is browse-only.
- Catalog-level curation (NSFW/DMCA/dead filtering) — that's the pipeline's curate gate; Remote Config here is the *fast, runtime* lever, not the durable filter.

---

## Key Decisions

- Local-first, device-only: delivers ~all the retention value of favorites/history with none of the auth/storage/privacy cost, honoring the no-cloud-user-data rule.
- Remote Config as a dual-purpose lever: featured curation + instant kill-switch gives the maintainer a free, no-redeploy control plane that complements the slower daily pipeline.
- Two-tier content control: the pipeline is the durable, reviewed filter (daily); Remote Config is the immediate override (seconds). They coexist by design.
- PWA offline is browse-only: setting the expectation explicitly avoids a "broken offline" perception for an inherently network-bound product.

---

## Dependencies / Assumptions

- Depends on the runtime app already reading catalog shards (engagement rails compose from the same channel data).
- Assumes the Firebase Remote Config client fetch is acceptable weight/latency and stays within the free tier at this traffic.
- Assumes localStorage is sufficient for favorites/history sizes here; IndexedDB is a planning-time option if volume warrants.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][User decision likely] Favorites surfacing — a home rail, a dedicated `/favorites` route, or both.
- [Affects R6][Technical] Service-worker caching strategy and exactly which catalog slices to precache for offline browse.
- [Affects R7, R8][Technical] Remote Config schema (shape of featured collections, kill-list, flags) and client fetch/cache cadence.
- [Affects R3][Technical] Recently-watched cap and whether "watched" is counted on play-start or a dwell threshold.
