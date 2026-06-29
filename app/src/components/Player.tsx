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

  const streams = channel.streams
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
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true
    const candidates = buildCandidates(streams, pageProtocol)
    const attempts: FailureClass[] = []

    let idx = 0
    let attemptId = 0 // guards stale async (dynamic import) resolutions
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
        video.src = c.url
        tryPlayMuted()
        deadline = setTimeout(() => fail('dead'), DEADLINE_MS)
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
                online,
              ),
            )
          })
          instance.loadSource(c.url)
          instance.attachMedia(video)
          deadline = setTimeout(() => fail('dead'), DEADLINE_MS)
        })
        .catch(() => {
          if (!cancelled && myId === attemptId) fail('dead')
        })
    }

    // First playable signal from the media element = success (true for both the
    // hls.js and native paths; survives autoplay being blocked, since metadata
    // loads regardless of whether playback was allowed to start audibly).
    const onPlayable = () => markPlaying()
    // Native-path error (the hls.js path classifies via its own ERROR event).
    const onNativeError = () => {
      if (hls) return
      fail(classifyFailure({ scheme: candidates[idx]?.scheme ?? 'https' }, pageProtocol, online))
    }
    video.addEventListener('loadedmetadata', onPlayable)
    video.addEventListener('playing', onPlayable)
    video.addEventListener('error', onNativeError)

    attempt()

    return () => {
      cancelled = true
      clearDeadline()
      video.removeEventListener('loadedmetadata', onPlayable)
      video.removeEventListener('playing', onPlayable)
      video.removeEventListener('error', onNativeError)
      teardownHls()
    }
  }, [channel.id, retryToken, hasStreams, streams])

  if (!hasStreams) {
    return <p className="rounded bg-gray-100 p-4 text-sm text-gray-600">No stream available for this channel.</p>
  }

  if (status === 'failed') {
    return (
      <div className="overflow-hidden rounded-lg bg-gray-900 p-4 text-sm text-gray-200" data-testid="player">
        <p role="status" data-testid="player-error">
          {messageFor(failureClass)}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('loading') // remount the <video> so the effect's ref is live again
            setRetryToken((t) => t + 1)
          }}
          data-testid="player-retry"
          className="mt-3 rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 focus:outline focus:outline-2 focus:outline-blue-400"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-black" data-testid="player">
      <video ref={videoRef} controls playsInline autoPlay muted className="aspect-video w-full" />
      {status === 'playing' && muted && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          data-testid="player-unmute"
          className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1 text-sm text-white hover:bg-black/90 focus:outline focus:outline-2 focus:outline-blue-400"
        >
          Unmute
        </button>
      )}
    </div>
  )
}
