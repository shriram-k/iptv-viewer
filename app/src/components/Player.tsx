import { useEffect, useRef, useState } from 'react'
import type { Channel } from '../data/types'
import { buildCandidates, classifyFailure, dominantClass, messageFor } from '../lib/playback'
import type { FailureClass } from '../lib/playback'

// Full-playback player (pure linker — never proxies bytes). Walks the channel's
// ordered stream URLs, failing over silently on fatal hls.js errors, and when
// nothing plays shows one honest failure card (R4/R7) with a retry. Mixed-content
// (http: on our https: page) is classified pre-flight and never attempted (R5).
//
// Classification lives in ../lib/playback (pure, tested there); this component is
// the imperative hls.js adapter + state machine.

// Aggressive load policies: hls.js defaults wait ~40-60s on a dead manifest, far
// too patient for channel-zapping. We want fast failover to the next URL.
const FAST_RETRY = { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 }
const HLS_CONFIG = {
  enableWorker: true,
  manifestLoadPolicy: {
    default: { maxTimeToFirstByteMs: 4000, maxLoadTimeMs: 8000, timeoutRetry: FAST_RETRY, errorRetry: { maxNumRetry: 0, retryDelayMs: 1000, maxRetryDelayMs: 4000 } },
  },
  playlistLoadPolicy: {
    default: { maxTimeToFirstByteMs: 4000, maxLoadTimeMs: 8000, timeoutRetry: FAST_RETRY, errorRetry: { maxNumRetry: 1, retryDelayMs: 1000, maxRetryDelayMs: 4000 } },
  },
  fragLoadPolicy: {
    default: { maxTimeToFirstByteMs: 6000, maxLoadTimeMs: 15000, timeoutRetry: FAST_RETRY, errorRetry: { maxNumRetry: 2, retryDelayMs: 1000, maxRetryDelayMs: 4000 } },
  },
}

// Component-owned wall-clock deadline per URL: catches "connects but never
// renders a frame" cases the load policies handle too slowly. Cleared the moment
// the media element signals it has playable content.
const DEADLINE_MS = 12_000

// Minimal shape of the bits of an hls.js instance we drive (avoids static import).
interface HlsInstance {
  on(event: string, cb: (e: unknown, data: HlsErrorData) => void): void
  loadSource(url: string): void
  attachMedia(video: HTMLMediaElement): void
  stopLoad(): void
  detachMedia(): void
  destroy(): void
}
interface HlsErrorData {
  fatal: boolean
  type?: string
  details?: string
  response?: { code?: number }
}

export function Player({ channel }: { channel: Channel }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'playing' | 'failed'>('loading')
  const [failureClass, setFailureClass] = useState<FailureClass>('dead')
  const [muted, setMuted] = useState(true)
  const [retryToken, setRetryToken] = useState(0)

  // Drop streams with no usable URL up front so they don't masquerade as playable.
  const streams = channel.streams.filter((s) => !!s.url)
  const hasStreams = streams.length > 0

  // Keep the media element's muted property in sync with React state (the `muted`
  // attribute is not reliably reflected by React, so drive it via the ref).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasStreams) return

    const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
    // Read connectivity fresh at classification time, not once — it can change mid-failover.
    const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
    const candidates = buildCandidates(streams, pageProtocol)
    const attempts: FailureClass[] = []

    let idx = 0
    let attemptId = 0 // guards stale async (dynamic import) resolutions
    let nativeAttemptId = -1 // which attempt (if any) is the live native-HLS one
    let settled = false // whether the current attempt has resolved (success or failover)
    let hls: HlsInstance | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    setStatus('loading')
    setMuted(true)

    const clearDeadline = () => {
      if (deadline) clearTimeout(deadline)
      deadline = undefined
    }
    // Per-URL wall-clock guard: if nothing becomes playable in time, fail over.
    const armDeadline = () => {
      deadline = setTimeout(() => fail('dead'), DEADLINE_MS)
    }
    const teardownHls = () => {
      if (hls) {
        try {
          hls.stopLoad()
          hls.detachMedia()
          hls.destroy()
        } catch {
          /* hls teardown is best-effort */
        }
        hls = undefined
      }
      try {
        video.removeAttribute('src')
        video.load() // flush the media element (may fire a spurious 'error' — guarded by `settled`)
      } catch {
        /* ignore */
      }
    }
    const tryPlayMuted = () => {
      video.muted = true
      const p = video.play()
      if (p && typeof p.catch === 'function') p.catch(() => {}) // autoplay may be blocked; stay muted
    }

    // Move on to the next candidate (or fail honestly when exhausted).
    const advance = () => {
      clearDeadline()
      teardownHls()
      idx += 1
      if (cancelled) return
      if (idx < candidates.length) {
        attempt()
      } else {
        setFailureClass(dominantClass(attempts))
        setStatus('failed')
      }
    }
    // The current attempt produced a usable stream — stop here (terminal success).
    const markPlaying = () => {
      if (settled || cancelled) return
      settled = true
      clearDeadline()
      setStatus('playing')
    }
    // The current attempt failed — record the class and fail over.
    const fail = (cls: FailureClass) => {
      if (settled || cancelled) return
      settled = true
      attempts.push(cls)
      advance()
    }

    const attempt = () => {
      settled = false
      attemptId += 1
      const myId = attemptId
      const c = candidates[idx]

      // Known-unplayable before any network: don't even construct hls (R5).
      if (c.preflightClass) {
        fail(c.preflightClass)
        return
      }

      // Native HLS (Safari): hand the URL straight to the media element.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        nativeAttemptId = myId
        video.src = c.url
        tryPlayMuted()
        armDeadline()
        return
      }

      // Everyone else: hls.js over MSE (client-only dynamic import).
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || myId !== attemptId) return
          if (!Hls.isSupported()) {
            fail('dead')
            return
          }
          const instance = new Hls(HLS_CONFIG) as unknown as HlsInstance
          hls = instance
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled || myId !== attemptId) return
            tryPlayMuted()
          })
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (cancelled || myId !== attemptId || !data?.fatal) return
            fail(
              classifyFailure(
                { scheme: c.scheme, responseCode: data.response?.code, details: data.details, fatalType: data.type },
                pageProtocol,
                isOnline(),
              ),
            )
          })
          instance.loadSource(c.url)
          instance.attachMedia(video)
          armDeadline()
        })
        .catch(() => {
          if (!cancelled && myId === attemptId) fail('dead')
        })
    }

    // Success = the media element can actually start playback (`canplay`) or is
    // playing. We deliberately do NOT settle on `loadedmetadata`: metadata can
    // parse while the media segments are dead/geo-blocked, and settling there
    // would swallow the subsequent fatal error and freeze on a black player.
    // `canplay` fires after decodable data arrives, even if autoplay is blocked.
    // Native-path error (the hls.js path classifies via its own ERROR event).
    // Guarded by nativeAttemptId so a torn-down attempt's spurious `error`
    // (from video.load()) can't fail over the next candidate prematurely.
    const onNativeError = () => {
      if (hls || nativeAttemptId !== attemptId) return
      fail(classifyFailure({ scheme: candidates[idx]?.scheme ?? 'https' }, pageProtocol, isOnline()))
    }
    video.addEventListener('canplay', markPlaying)
    video.addEventListener('playing', markPlaying)
    video.addEventListener('error', onNativeError)

    attempt()

    return () => {
      cancelled = true
      clearDeadline()
      video.removeEventListener('canplay', markPlaying)
      video.removeEventListener('playing', markPlaying)
      video.removeEventListener('error', onNativeError)
      teardownHls()
    }
    // streams/hasStreams are invariant for a given channel.id; depending on the
    // streams array ref would tear down and rebuild the player on any re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, retryToken])

  if (!hasStreams) {
    return <p className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">No stream available for this channel.</p>
  }

  if (status === 'failed') {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl bg-ink p-6 text-center" data-testid="player">
        <span aria-hidden className="font-mono text-2xl text-white/25">— no signal —</span>
        <p role="status" data-testid="player-error" className="max-w-sm text-sm text-white/80">
          {messageFor(failureClass)}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('loading') // remount the <video> so the effect's ref is live again
            setRetryToken((t) => t + 1)
          }}
          data-testid="player-retry"
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black shadow-[0_10px_40px_-20px_rgba(27,23,32,0.6)]" data-testid="player">
      <video ref={videoRef} controls playsInline autoPlay muted className="aspect-video w-full" />
      {status === 'playing' && muted && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          data-testid="player-unmute"
          className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white backdrop-blur transition hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Unmute
        </button>
      )}
    </div>
  )
}
