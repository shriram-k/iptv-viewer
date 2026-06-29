---
date: 2026-06-28
topic: v2-epg
---

# IPTV Viewer v2 — EPG / "What's On Now"

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

Program-guide enrichment that shows "now / next" wherever guide data exists, plus a coverage-gated "Live now" discovery board for well-covered countries and categories. EPG refreshes on its own cadence, separate from the daily catalog snapshot, and degrades silently where data is missing.

---

## Problem Frame

The catalog answers "what channels exist," but a live-TV viewer's real question is "what can I watch right now" — and v1 has no answer. iptv-org publishes guide *pointers* (`guides.json`) to external XMLTV sources (e.g., epg.pw), but coverage is patchy and timezone-heavy: some channels have rich schedules, many have none. Program data is also intrinsically time-sensitive — "now" changes every half hour — so it cannot ride the once-daily, human-gated catalog snapshot that the rest of the data uses. The feature has to add genuine "what's on" value where it can while never making the empty regions look broken.

---

## Actors

- A1. Visitor: wants to see what's airing now and pick something to watch.
- A2. EPG refresh job: periodically fetches and normalizes guide data into a compact schedule dataset.
- A3. Runtime app: renders now/next labels and the Live-now board, computing "now" against the viewer's clock.

---

## Key Flows

- F1. Now/next label
  - **Trigger:** A channel card or channel page renders for a channel that has guide data.
  - **Actors:** A3, A1
  - **Steps:** Read the channel's schedule for today → compute the current and next program from the current time → render "Now: … · Next: …". If no schedule exists, render nothing (no placeholder).
  - **Outcome:** Channels with coverage gain a live, time-relevant label; others are unchanged.
  - **Covered by:** R3, R4, R7

- F2. Live-now board
  - **Trigger:** Visitor lands on a country/category surface that meets the coverage threshold.
  - **Actors:** A3, A1
  - **Steps:** For the qualifying scope, list channels with a current program, ranked, with a LIVE indicator → the board is shown only for scopes above the coverage threshold; below it, the board is omitted entirely and browse stays channel-centric.
  - **Outcome:** A compelling "what's on right now" entry point appears only where it renders well.
  - **Covered by:** R5, R6, R8

---

## Requirements

**Ingestion & refresh**
- R1. Fetch program data from the guide sources referenced by iptv-org `guides.json` (e.g., hosted XMLTV such as epg.pw), normalized into a compact per-channel schedule keyed to channel/feed.
- R2. Refresh EPG on its own cadence, independent of and more frequent than the daily catalog snapshot; EPG data is never baked into the catalog snapshot.

**Now/next computation**
- R3. Normalize all program times to absolute UTC instants at ingestion (resolving each XMLTV source's offset), then compute "now"/"next" by comparing UTC-now to those instants. The runtime must fetch a schedule window that **brackets** viewer-now (±1 source-day, not just "today") so far-offset viewers and programs crossing the source-day boundary aren't missed. Mishandling the source offset makes every now/next wrong regardless of the viewer's clock; because missing data renders nothing (R7), such bugs are silent and look like "no coverage."
- R4. Show now/next labels anywhere channels are presented (cards, channel page, player) when schedule data exists for that channel.
- R7. When a channel has no schedule data, render no EPG element for it — no empty placeholder, no "no data" notice.

**Live-now board & coverage gating**
- R5. Provide a "Live now" board listing currently-airing programs for a country/category scope, with a LIVE indicator per item.
- R6. Show the Live-now board for a given scope only when BOTH conditions hold: (a) that scope's EPG coverage exceeds a threshold, AND (b) at least N channels have a currently-airing program right now. If either fails, omit the board entirely and fall back to channel-centric browse (a covered scope with nothing currently airing — e.g., late night — must not render an empty board).
- R8. Rank the board by currently-airing programs; channels without a current program are excluded from the board (but remain in normal browse).

**SEO**
- R9. Where program data is stable enough to render server-side (e.g., a channel's current/upcoming schedule), expose it in the page's structured data (`BroadcastEvent` / schedule) to strengthen freshness signals — without making correctness depend on per-second accuracy.

---

## Acceptance Examples

- AE1. **Covers R4, R7.** Given two channels in a list, one with guide data and one without, when the list renders, the first shows "Now: … · Next: …" and the second shows no EPG element at all.
- AE2. **Covers R6.** Given India is above the coverage threshold and a small country is below it, when each country page renders, India shows a Live-now board and the small country shows only channel browse.
- AE3. **Covers R3.** Given a viewer in a different timezone, when a channel page renders, the "Now" program reflects the viewer's local clock, not a server default.
- AE4. **Covers R2.** Given the catalog snapshot last refreshed this morning, when the EPG job runs midday, now/next labels update without a catalog rebuild or deploy.
- AE5. **Covers R3.** Given a DST-transition day and a viewer several zones from the source, when a program spans the source-day boundary, now/next still resolves correctly because the bracketed ±1-source-day window includes it — rather than showing a spurious gap.

---

## Success Criteria

- Channels with coverage gain accurate, timezone-correct now/next; channels without it look intentional, not broken.
- The Live-now board appears only where coverage makes it compelling, and never renders a half-empty grid.
- EPG freshness is independent of the daily catalog cadence and adds no hosting bill.
- `ce-plan` can implement EPG without re-deciding centrality, coverage gating, or the now-computation model.

---

## Scope Boundaries

- Full multi-hour TV-guide grid / timeline view — deferred; v2 is now/next + a live board, not a full guide.
- Program reminders, notifications, or "notify me when X starts" — would require storing user state/identity; excluded (no cloud user data).
- Per-program detail pages — deferred unless coverage and SEO value justify them later.
- Running our own XMLTV scrapers (iptv-org/epg) — preferred to consume hosted feeds; self-scraping is a later fallback only if hosted coverage is inadequate.
- Catalog membership — EPG never adds/removes channels; that is the pipeline's job.

---

## Key Decisions

- EPG is decoupled from the daily snapshot on its own faster cadence: program data is time-sensitive and would be stale or wrongly-static if baked into the once-daily catalog.
- Client-side now/next from a periodically-fetched schedule: fetching a day's schedule and computing "now" against the viewer's clock is timezone-correct and avoids needing minute-fresh server data or per-request compute.
- Coverage-gated hero board: showing "Live now" only above a coverage threshold captures the engagement upside without the patchy-data downside that would undercut the polish/SEO goals.
- Silent degradation: missing EPG renders nothing rather than a placeholder, so absence never reads as breakage.

---

## Dependencies / Assumptions

- Depends on the pipeline carrying each channel's EPG source reference (from `guides.json`) so the EPG job knows where to look (see [data-pipeline doc](2026-06-28-v2-data-pipeline-requirements.md)).
- Assumes hosted XMLTV sources (e.g., epg.pw) provide adequate coverage for at least a few high-value regions without self-scraping.
- Assumes a compact normalized schedule for covered channels fits within the free runtime store and refresh budget.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2][Needs research] Which guide source(s) to consume, their coverage, and the refresh cadence (e.g., a few times daily vs hourly).
- [Affects R6][User decision likely] The concrete coverage threshold for showing the Live-now board (what % of a scope's channels need current programs).
- [Affects R1][Technical] Where the normalized schedule lives at runtime (shared store with the catalog vs a separate EPG store) and how channel/feed IDs map to guide-source IDs.
- [Affects R3][Technical] Timezone handling — detect viewer timezone client-side vs offer a selector.
