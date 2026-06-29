# U1 — Playability Probe Results

**Date:** 2026-06-28
**Script:** `scripts/playability-probe.js` (throwaway spike)
**Source:** committed `playlist.json` (13,509 stream entries)
**Sample:** 200 HTTPS streams, deterministic stride sample, 6 s timeout, manifest GET + CORS-header check

## Headline

**~53% of the catalog is plausibly browser-playable without a proxy** (optimistic estimate — manifest-only).

## Measurements

| Signal | Result |
|--------|--------|
| Total streams | 13,509 |
| `http://` (mixed-content, **hard-blocked** on an HTTPS page) | 2,126 — **15.7%** |
| `https://` | 11,376 — 84.2% |
| Sampled HTTPS: manifest reachable (2xx) | 147/200 — 73.5% |
| Sampled HTTPS: CORS-permissive (ACAO header present) | 148/200 — 74.0% |
| Sampled HTTPS: **browser-playable estimate** (2xx **and** CORS) | 127/200 — **63.5%** |
| **Catalog projection** (https-share × sampled playable rate) | **~53.5%** |

## Interpretation

- The 15.7% mixed-content floor is firm and matches the doc-review estimate exactly — those will never play on an HTTPS site without a proxy.
- Of the HTTPS majority, ~1 in 4 is already dead (unreachable) or CORS-blocked. Net: **roughly half** the catalog is plausibly watchable in-browser.

## Caveats (why this is an upper estimate)

- **Manifest-only.** hls.js also fetches TS/fMP4 segments and AES keys, each a separate CORS surface that can fail independently. Real browser-playable rate is likely **somewhat lower** than 53%.
- **No `Origin` header sent** from Node, so the ACAO check reflects server config, not a true browser preflight. Approximate, not exact.
- **Point-in-time.** Stream liveness churns hourly; a single sample understates volatility.
- A real-browser run (Playwright + hls.js, checking segment+key) would tighten the number; the spike script intentionally stops at the manifest.

## Go/No-Go read

**Conditional GO for pure-linker, with two non-negotiables:**

1. **Browser-playability-first ordering (pipeline R18) is essential**, not optional — surfacing the playable ~half first is what makes the product usable. A channel page that picks a random/HTTP-first URL will fail ~half the time.
2. **The honest-failure UX (player feature) is a primary path, not an edge case** — ~half of naive first-clicks would fail without ordering; even with ordering, failures are common enough to be a first-class state.

**Implication for scope:** the effective catalog is ~half its nominal size. This strengthens the case to **rank by playability + recency** and weakens any "13,509 channels!" framing. If a real-browser run later shows the playable rate well under ~40%, revisit the no-proxy decision for a narrow HTTPS-CORS-failing-but-reachable subset.
