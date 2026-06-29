---
date: 2026-06-28
topic: v2-monetization
---

# IPTV Viewer v2 — Monetization (Decision Record)

> Part of the v2 rebuild — see [master brainstorm index](2026-06-28-v2-master-brainstorm.md).

## Summary

v2 ships with no monetization. Ads are ruled out; a donations option (Ko-fi or similar) is the intended path, added later only once traffic justifies it. This is a deferred decision record, not a feature to build now.

---

## Problem Frame

The owner is open to monetizing eventually but is happy for this to stay a personal project, and doesn't want monetization to compromise the free/no-bill, SEO-first, low-legal-profile posture. Two external facts settle the shape: AdSense (and most ad networks) categorically reject IPTV/directory sites that link to copyrighted streams, so ads are both unlikely to be approved and a ToS/account risk; and Vercel-style hosts forbid commercial use on free tiers while explicitly permitting donations. The decision is therefore less "how to make money" and more "what not to foreclose."

---

## Requirements

- R1. v2 launches with no ads and no payment/subscription flows.
- R2. Preserve donation-readiness: nothing in the architecture, hosting choice, or legal posture should block adding a donations link (e.g., Ko-fi) later without re-platforming.
- R3. Keep the legal posture that makes later donations safe: remain a linker/indexer with a provenance disclaimer, SFW-filtered catalog, and blocklist compliance (defined in the pipeline doc).
- R4. When donations are added, implement them as a lightweight outbound link/button (no payment processing on-site, no user data).

---

## Success Criteria

- v2 carries zero monetization surface and zero associated legal/ToS risk at launch.
- Adding donations later is a small, additive change — no architectural or hosting migration required.

---

## Scope Boundaries

- Advertising of any kind (display, affiliate networks requiring content review) — ruled out for this catalog.
- On-site payments, subscriptions, memberships, paywalls — out of scope.
- FAST-channel pivot to unlock ad eligibility — considered and dropped (ads are not the path).
- Any monetization that would require collecting user data or processing payments on our infrastructure.

---

## Key Decisions

- No ads, ever, for this catalog: AdSense/ad-network rejection and account-termination risk make ads a liability, not income.
- Donations-later over donations-now: with low launch traffic there's nothing to monetize yet; build the option when there's an audience to ask.
- Donation-readiness is a constraint on other decisions: the Cloudflare (commercial-OK) hosting choice and the linker legal posture are what keep this door open — already reflected in the pipeline and player docs.

---

## Outstanding Questions

### Deferred (revisit when triggered)

- [Trigger] What traffic level (e.g., sustained monthly visitors) warrants adding donations — a threshold to revisit, not a blocker now.
- [Affects R4] Donation platform choice (Ko-fi vs alternatives) — decided at the time it's added.
