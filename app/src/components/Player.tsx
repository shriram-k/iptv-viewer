import { useEffect, useRef, useState } from 'react'
import type { Channel } from '../data/types'

// U7 — basic hls.js player. Plays the first (playability-ordered) stream URL.
// Browser-only: hls attaches in an effect, so SSR just renders the <video> shell.
// Full multi-URL failover + failure classification is the separate player feature;
// here we show an honest message on error instead of a silent black screen.
export function Player({ channel }: { channel: Channel }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const src = channel.streams[0]?.url

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    let hls: { destroy(): void } | undefined
    let cancelled = false

    // Native HLS (Safari) first; otherwise dynamically import hls.js (client-only).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (Hls.isSupported()) {
          const instance = new Hls({ enableWorker: true })
          hls = instance
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setFailed(true)
          })
          instance.loadSource(src)
          instance.attachMedia(video)
        } else {
          setFailed(true)
        }
      }).catch(() => setFailed(true))
    }
    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  if (!src) return <p className="rounded bg-gray-100 p-4 text-sm text-gray-600">No stream available for this channel.</p>

  return (
    <div className="overflow-hidden rounded-lg bg-black" data-testid="player">
      {failed && (
        <p role="status" className="bg-gray-900 p-4 text-sm text-gray-300" data-testid="player-error">
          This stream can’t be played in your browser — it may be offline or region-restricted.
        </p>
      )}
      <video ref={videoRef} controls playsInline className="aspect-video w-full" />
    </div>
  )
}
