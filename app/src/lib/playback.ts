// Pure playback failure-classification + candidate-building. No DOM, no hls.js
// import — the Player component adapts hls.js error events into the small
// `FailureInput` descriptor below and calls in here. Keeping this isolated
// makes the branchy R7 logic unit-testable, and gives the future analytics
// feature a stable machine-readable `FailureClass` to consume.
import type { Stream } from '../data/types'

export type FailureClass = 'dead' | 'browser-blocked' | 'region-restricted'

/** A stream URL to attempt, in snapshot order. */
export interface Candidate {
  url: string
  scheme: Stream['scheme']
  /** Set when the candidate is known-unplayable before hls.js is even tried
   *  (http: on an https: page = mixed content). Such candidates are still
   *  listed (R5/R9: surface, don't hide) but classified without a network hit. */
  preflightClass?: FailureClass
}

/** Minimal, hls.js-decoupled descriptor of a fatal playback failure. */
export interface FailureInput {
  /** URL scheme of the attempted stream. */
  scheme: Stream['scheme']
  /** HTTP status from hls.js `data.response.code`, when the origin returned
   *  CORS-permissive headers. `0` or undefined means no usable status (CORS /
   *  DNS / dead host / header-less 4xx all collapse here — indistinguishable). */
  responseCode?: number
  /** hls.js `data.details` (e.g. 'manifestLoadTimeOut', 'manifestParsingError'). */
  details?: string
  /** hls.js `data.type` (e.g. 'networkError', 'mediaError'). */
  fatalType?: string
}

const MESSAGES: Record<FailureClass, string> = {
  dead: 'This stream appears to be offline or unavailable right now.',
  'browser-blocked':
    "This stream can’t be played in your browser — it’s blocked or unreachable from this page.",
  'region-restricted': 'This stream may be region-restricted in your area.',
}

/** Plain-language copy for a failure class. Intentionally conservative: the
 *  browser-blocked message never asserts a specific cause (CORS vs DNS vs a
 *  header-less 403 are not distinguishable in the browser). */
export function messageFor(failure: FailureClass): string {
  return MESSAGES[failure]
}

/**
 * Build the ordered candidate list from a channel's snapshot streams.
 * Order is preserved (the pipeline supplies HTTPS-preferred ordering, R6/R18).
 * Nothing is dropped — http-on-https is marked browser-blocked up front (R5).
 */
export function buildCandidates(streams: Stream[], pageProtocol: string): Candidate[] {
  const httpsPage = pageProtocol === 'https:'
  return streams.map((s) => {
    const candidate: Candidate = { url: s.url, scheme: s.scheme }
    if (httpsPage && s.scheme === 'http') candidate.preflightClass = 'browser-blocked'
    return candidate
  })
}

/**
 * Classify a fatal stream failure into one user-facing class (R7).
 *
 * Decision order (from the hls.js v1.6.16 error-model research):
 *  1. Mixed content — http: on an https: page. Reliable, no network needed.
 *  2. A real HTTP status (origin was CORS-permissive):
 *       403 / 451 → region-restricted; 404 / 410 / 5xx → dead.
 *  3. No usable status AND the viewer is offline → dead (don't blame the channel).
 *  4. No usable status AND online → browser-blocked (best-effort; this bucket
 *       unavoidably also holds DNS-dead hosts and header-less 4xx).
 *  5. Timeouts / parse / incompatible-codec / media failures → dead.
 */
export function classifyFailure(input: FailureInput, pageProtocol: string, online: boolean): FailureClass {
  // 1. Mixed content — decidable from the scheme alone.
  if (pageProtocol === 'https:' && input.scheme === 'http') return 'browser-blocked'

  // 2. A real, CORS-visible HTTP status.
  const code = input.responseCode
  if (typeof code === 'number' && code > 0) {
    if (code === 403 || code === 451) return 'region-restricted'
    if (code === 404 || code === 410) return 'dead'
    if (code >= 500 && code <= 599) return 'dead'
    // Any other explicit status: treat as dead (unusable), not a geo claim.
    return 'dead'
  }

  // 3. No usable status, viewer offline — their connection, not the channel.
  if (!online) return 'dead'

  // 4. No usable status, online — most likely CORS/mixed/unreachable. Best-effort.
  //    Timeouts and content errors still carry a status-less signal but read as
  //    "dead/unavailable" rather than "blocked"; separate them out first.
  const d = (input.details ?? '').toLowerCase()
  const isContentOrTimeout =
    d.includes('timeout') ||
    d.includes('parsing') ||
    d.includes('parse') ||
    d.includes('codec') ||
    d.includes('buffer') ||
    d.includes('mux') ||
    input.fatalType === 'mediaError'
  if (isContentOrTimeout) return 'dead'

  // 5. A bare network failure with no status while online: blocked or unreachable.
  return 'browser-blocked'
}

// More-informative classes win: a confirmed geo-gate (403/451) is more
// actionable than a bare network failure, so it should dominate the final card.
const INFORMATIVENESS: Record<FailureClass, number> = {
  'region-restricted': 3,
  dead: 2,
  'browser-blocked': 1,
}

/** Pick the dominant failure class across all attempted URLs (origin F2). */
export function dominantClass(classes: FailureClass[]): FailureClass {
  let best: FailureClass = 'dead' // safe default so the UI never renders empty copy
  let bestScore = -1
  for (const c of classes) {
    if (INFORMATIVENESS[c] > bestScore) {
      best = c
      bestScore = INFORMATIVENESS[c]
    }
  }
  return best
}
