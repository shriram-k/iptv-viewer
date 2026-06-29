---
date: 2026-06-28
topic: v2-ui-ux
---

# IPTV Viewer v2 — UI / UX & Information Architecture

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

The information architecture, navigation, and UX behavior the v2 features render into: a layered home (favorites → recently-watched → live-now → browse), clean path-based routes for SEO, consistent channel components with honest empty/failure states, and a mobile-first, "clean but cool" shell. Visual design is handed to `ce-frontend-design` at build time.

---

## Problem Frame

v1 is a HashRouter SPA gated by a blocking splash, with country/category carousels and ugly, unshareable `#`-fragment URLs that crawlers can't index. It starts cold every visit and has no consistent place for "what's on," favorites, or honest stream state. v2 wants a clean, cool, fast experience that is simultaneously best-in-class for SEO — which forces real, crawlable URLs and server-rendered content — and that gives every feature (player, EPG, engagement, analytics) a coherent home rather than bolting each on.

---

## Actors

- A1. New visitor: arrives (often via search engine to a deep hub/channel page) and needs to orient and find something to watch fast.
- A2. Returning visitor: expects their favorites and recent channels front-and-center.
- A3. Maintainer: shapes featured rails via Remote Config (presentation only).

---

## Key Flows

- F1. Discover and play from home
  - **Trigger:** Visitor opens the home page.
  - **Actors:** A1, A2
  - **Steps:** See a layered home — favorites + recently-watched rails (when present) → Live-now board (covered scopes) → browse-by-country and browse-by-category rails → persistent search always available → pick a channel → land on the channel page and play.
  - **Outcome:** Both returning and new visitors reach a playing channel within a couple of interactions.
  - **Covered by:** R3, R4, R5, R6

- F2. Land deep from search engine
  - **Trigger:** A crawler-indexed hub or channel URL is opened directly.
  - **Actors:** A1
  - **Steps:** The server-rendered page stands alone (title, content, related links) → clear path back up to its country/category hub and home via breadcrumbs/header.
  - **Outcome:** A deep entry converts to exploration instead of a dead end.
  - **Covered by:** R1, R2, R7

---

## Requirements

**Information architecture & routing**
- R1. Use clean, path-based, shareable routes (no hash fragments): home, country hub, category hub, language hub, hub intersections, channel page, search, favorites.
- R2. Every page is server-rendered standalone (own title/meta) and exposes upward navigation (breadcrumb/header) to its parent hub and home, plus contextual links to sibling/related hubs for internal linking.

**Home composition (layered)**
- R3. Compose the home as ordered sections: Favorites rail and Recently-watched rail (shown only when non-empty), a Live-now board, then Browse-by-country and Browse-by-category rails. The home Live-now board is a **curated multi-scope sample** — currently-airing channels drawn from the best-covered scopes (per EPG R6), ranked and **capped at a fixed item count** so it can't dominate the mobile home; if no scope qualifies, the board is omitted (never rendered empty).
- R4. For a first-time visitor with no local state and no covered live-now scope, the home still leads with a strong browse + search experience (no empty rails rendered).

**Navigation & search**
- R5. Provide persistent search reachable from every page. The header input navigates to `/search?q=…` on submit (not instant-search); the results page shows three titled sections — Channels, Countries, Categories — with empty sections omitted; the zero-results state reads `No results for "…"` with a prompt to browse by country/category; skeleton rows show while results load. The query lives in the URL (shareable, reproducible).
- R6. Use horizontally-scrollable rails for carousels. Keyboard model: each rail is **one Tab stop using roving tabindex**; Left/Right arrows traverse cards within the focused rail; Enter selects; explicit Previous/Next buttons are supplementary for pointer users (avoids a long tab sequence across many rails). Hub pages use a card grid.

**Components & states**
- R7. Define a single reusable channel card reused across home, hubs, search, and related lists, with two display modes: **compact** (carousel/rail: logo-dominant, name, liveness as a status dot, no EPG text) and **full** (hub grid / search: logo, name, country/category, liveness, optional now/next). On logo-load failure, show a deterministic colored fill with the channel's initial(s) — never a broken-image icon or gray box. On a card, liveness is a status indicator (online dot / offline / none-if-unknown), not the timestamped "checked Nh ago" hint reserved for the channel page; suppress it when last-checked > 24h or status is unknown.
- R8. Replace the blocking splash with progressive rendering: server-rendered content first, skeletons for client-hydrated rails — never a full-screen gate. The consent affordance (analytics R4) obeys this rule too: a non-interruptive fixed-bottom strip (not a modal/overlay), dismissal persisted in localStorage.
- R9. Specify honest empty and failure states everywhere: empty favorites/history, no-EPG (render nothing, per EPG feature), player failure messaging (per player feature), and **offline states** for the installed PWA — show cached content with a persistent offline indicator in the shell; surfaces with no cached content show a named offline state (not a broken page); search while offline shows "search requires a connection," not an empty result. Absence must read as intentional, not broken.

**Experience quality**
- R10. Mobile-first and fully responsive; primary flows work one-handed on a phone.
- R11. Meet **WCAG 2.1 Level AA**: keyboard navigability, visible focus states, alt text on logos, AA contrast (4.5:1 text), reduced-motion support, and ARIA live regions (`aria-live`) for dynamically-updated content (the LIVE indicator, EPG now/next, liveness changes).
- R12. Hand visual design (type, color, motion, "clean but cool" aesthetic) to `ce-frontend-design`, which must respect this IA, the component set, and the SEO/SSR constraints; this doc fixes structure and behavior, not look. The visual language must read as a **live broadcast guide, not a video-on-demand library**: channel identity (logo) is the primary visual unit over poster/thumbnail imagery; time and liveness are first-class signals, not afterthought badges; the Live-now board should feel like a program guide, not a generic streaming/esports dashboard. (This rules out the AI-default "gradient header + uniform poster grid + icon circles" look.)

**Channel page (primary SEO + play surface)**
- R13. Specify the channel page's content order: breadcrumb + title → player → liveness label → EPG now/next (when present) → channel metadata (logo, country, categories) + favorite toggle → related-hub links. On mobile the **player is above the fold** (a visitor arriving from search should see play, not scroll past metadata); desktop may use player-left + metadata-right.
- R14. The channel page is server-rendered standalone with its own title/meta + JSON-LD and a breadcrumb up to its country and category hubs (it is the most common search landing page).

---

## Acceptance Examples

- AE1. **Covers R3, R4.** Given a returning visitor with favorites, the home leads with their Favorites and Recently-watched rails; given a brand-new visitor, those rails are absent and the home leads with Live-now (if covered) or browse + search — with no empty rails shown.
- AE2. **Covers R1, R5.** Given a visitor searches "news," when results render, the URL reflects the query and can be shared to reproduce the same result set.
- AE3. **Covers R2.** Given a visitor lands on a channel page from Google, when the page loads, it shows full server-rendered content and a breadcrumb up to its country and category hubs.
- AE4. **Covers R8.** Given a slow connection, when the home loads, server-rendered content and skeleton rails appear immediately with no full-screen splash gate.

---

## Success Criteria

- A new visitor landing deep from search can orient and play within a couple of taps; a returning visitor lands on their channels.
- Every route is crawlable, shareable, and previews correctly when linked.
- The shell feels clean, fast, and cohesive across the features, on mobile first.
- `ce-frontend-design` can produce the visual design without having to invent IA, navigation, components, or states — and `ce-plan` can build the shell from this structure.

---

## Scope Boundaries

- Concrete visual design — colors, typography, motion language, brand — owned by `ce-frontend-design`; this doc constrains but does not define it.
- The internal behavior of player, EPG, favorites, analytics — specified in their own docs; this doc only places them in the IA.
- Native mobile apps — out of scope; PWA install (engagement doc) is the install path.
- Admin/curation UI — curation is via Remote Config, not a built screen.
- Multi-language UI localization — deferred (catalog covers many languages; the UI itself is English for v2 unless revisited).

---

## Key Decisions

- Layered home composes the whole product: one surface serves returning and new visitors and threads in every feature, and its rails create dense internal links that strengthen SEO.
- Path-based SSR routing replaces HashRouter: non-negotiable for the best-in-class-SEO goal and for shareable links.
- Splash removed in favor of progressive rendering: the splash existed to mask client fetch latency that SSR eliminates.
- One channel card to rule them all: a single reusable component keeps the experience consistent and makes new surfaces cheap.
- Structure-now, design-later split: fixing IA/behavior here lets `ce-frontend-design` move fast on aesthetics without re-litigating product structure.

---

## Dependencies / Assumptions

- Depends on the rendering model from the data-pipeline doc (edge-SSR + cached hub/channel pages) and on the feature docs for the content each surface shows.
- Assumes the catalog's country/category/language facets are the right primary navigation axes (they map to the snapshot's shards and the SEO hub structure).
- Assumes English-only UI chrome is acceptable for v2.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R12][Design] Visual direction, theme, and motion — resolved with `ce-frontend-design`, including any reference inspirations.
- [Affects R6, R10][Technical] Rail/carousel implementation and responsive breakpoints.
- [Affects R5][Technical] Whether search is fully client-side over loaded shards or assisted by a prebuilt index for larger scopes.
- [Affects R2][Needs research] The related-hub linking strategy that maximizes crawlability without looking spammy.
