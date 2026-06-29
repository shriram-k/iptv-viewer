---
date: 2026-06-28
topic: v2-player
---

# IPTV Viewer v2 — Player & Playback

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

An in-browser HLS player that plays a channel by trying its stream URLs in order, silently failing over on error, and — when nothing plays — failing honestly with a plain-language reason. It stays a pure linker: it never proxies or carries stream bytes.

---

## Problem Frame

v1 plays streams with video.js and a single URL, and a stream that is dead, region-locked, or browser-blocked just yields a black player with no explanation — the dominant frustration of any IPTV viewer. Channels in the catalog often carry several stream URLs and a best-effort health status, none of which v1 uses to improve the odds or to tell the user what went wrong. Meanwhile, the project's constraints (no-bill hosting, linker-not-carrier legal posture) rule out the usual "just proxy everything" rescue, so the player must do the best it can with what plays natively and be honest about the rest.

---

## Actors

- A1. Visitor: clicks a channel and expects it to play or to be told why it can't.
- A2. Player component: the client-side module that mounts hls.js, walks the URL list, classifies failures, and renders state.

---

## Key Flows

- F1. Play a channel
  - **Trigger:** Visitor opens a channel page (`/channel/$id`).
  - **Actors:** A1, A2
  - **Steps:** Read the channel's ordered stream URLs (HTTPS preferred) + last-known status from the rendered page → attempt the first URL via hls.js → on a fatal error, advance to the next URL → on success, play.
  - **Outcome:** The channel plays from the first working URL, or the flow reaches F2.
  - **Covered by:** R1, R2, R3, R6

- F2. Honest failure
  - **Trigger:** All of a channel's stream URLs fail.
  - **Actors:** A2, A1
  - **Steps:** Classify the dominant failure (offline/dead, region-restricted, browser-blocked HTTP/CORS) → show a plain-language message naming the likely reason → offer a manual retry.
  - **Outcome:** The visitor understands why it didn't play instead of staring at a black screen.
  - **Covered by:** R4, R5, R7

---

## Requirements

**Playback core**
- R1. Play HLS streams in-browser using hls.js (not video.js), with native HLS fallback on browsers that support it directly.
- R2. Autoplay on the channel page (the visitor navigated specifically to watch), with standard controls (play/pause, volume/mute, fullscreen) and hls.js's adaptive quality.
- R3. Dispose the player and its resources cleanly on navigation away from the channel page.

**Failover & failure handling**
- R6. Attempt a channel's stream URLs in order (HTTPS-preferred ordering supplied by the snapshot), failing over to the next URL automatically and silently on a fatal playback error.
- R7. Classify a failed stream into a plain-language cause — offline/dead, likely region-restricted, or browser-blocked (HTTP-on-HTTPS / CORS) — using hls.js error types and the URL's scheme.
- R4. When all of a channel's URLs fail, surface a single honest message naming the most likely cause and offer a manual retry. Never present a silent black player.
- R5. Do not proxy, rewrite, or otherwise carry stream bytes through our own infrastructure. Streams that only work via a proxy are treated as not-playable and fail per R4.

**Liveness display**
- R8. Show the channel's last-known status as a best-effort, time-stamped label (e.g., "checked 4h ago") — framed as a hint, never as a guarantee that the stream is live.
- R9. Where multiple channels are listed, order/representation may down-rank likely-dead streams, but must not hide them outright.

**Channel context**
- R10. The channel page shows identifying context alongside the player: channel logo, name, country, and categories.

---

## Acceptance Examples

- AE1. **Covers R6.** Given a channel with three stream URLs where the first 404s, when the visitor opens it, the player advances to the second URL without any visible error and plays if it works.
- AE2. **Covers R4, R5.** Given a channel whose only stream is HTTP (mixed-content blocked), when playback is attempted, the player does not proxy it; it shows "this stream can't be played in your browser" with the browser-blocked reason and a retry.
- AE3. **Covers R7.** Given a stream that returns a network error consistent with geo-restriction, when it fails, the message names "may be region-restricted in your area" rather than a generic error.
- AE4. **Covers R8.** Given a channel last checked 30 hours ago, when its page renders, the liveness label reads as a stale-but-informative hint, not "LIVE".

---

## Success Criteria

- A channel with at least one natively-playable URL plays without the visitor seeing intermediate errors.
- A channel that can't play tells the visitor why, in plain language, every time — no silent black players.
- No stream bytes ever transit our infrastructure; the player adds zero hosting bill and minimizes *direct/carrier* liability. (This does not eliminate contributory/inducement exposure — that tracks curation + knowledge, not byte-handling — see Key Decisions.)
- `ce-plan` can implement the player without re-deciding proxy policy, failover behavior, or liveness framing.

---

## Scope Boundaries

- Proxying / CORS-rewriting / mixed-content rescue — explicitly excluded (pure-linker decision). May be revisited later if analytics show an unacceptable native-failure rate.
- EPG "now/next" overlay on the player — belongs to the EPG feature.
- Favorites / "add to favorites" control — belongs to the engagement feature (the player page may host the control, but its behavior is specified there).
- Multi-stream / picture-in-picture grid and any personal "watch wall" — out of scope for the public v2.
- Reporting a broken stream via a form — would imply collecting user input server-side; excluded (liveness comes from passive analytics instead).

---

## Key Decisions

- Pure linker, no proxy: keeps the player within no-bill hosting and reduces *direct/carrier* liability; the cost is that some streams won't play. The posture is not *zero* legal exposure — curating, ranking, and health-checking links with knowledge leaves a contributory/inducement surface; risk reduction comes from honoring the blocklist immediately, a provenance disclaimer, and not promoting known-infringing content.
- hls.js over video.js: lighter, direct control over the error/failover lifecycle, no plugin overhead.
- Honest failure over optimistic UI: a named reason builds trust and doubles as a passive analytics signal (feeds the analytics feature), which is more valuable than pretending.
- Liveness is a hint, not a badge: status can be up to a day stale (pipeline is daily), so the UI must not claim certainty.

---

## Dependencies / Assumptions

- Depends on the data pipeline supplying, per channel, the full ordered stream-URL list (HTTPS-preferred) plus last-known `status`/`checked_at` (see [data-pipeline doc](2026-06-28-v2-data-pipeline-requirements.md), R2).
- Depends on the pipeline's best-effort browser-playability hint (pipeline R18) to order streams so the most-likely-to-play URL is tried first; absent it, the first click often hits the honest-failure card because "online upstream" ≠ "plays in-browser." The genuinely-playable fraction is unmeasured — see the pipeline doc's pre-planning playability probe.
- Assumes hls.js error events are sufficient to distinguish the failure classes well enough for a useful (not perfect) message.
- Geo-restriction is not reliably detectable; the "region-restricted" message is a best-effort inference, not a verified diagnosis.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R7][Needs research] The exact mapping from hls.js error types + HTTP signals to the three user-facing failure classes.
- [Affects R6][Technical] Failover timing — how long to wait on a stalling stream before advancing to the next URL.
- [Affects R2][Technical] Whether autoplay must be muted to satisfy browser autoplay policies, and the unmute affordance.
