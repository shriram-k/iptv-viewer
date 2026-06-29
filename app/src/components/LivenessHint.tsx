import { useEffect, useState } from 'react'
import type { Stream } from '../data/types'
import { livenessHint } from '../lib/liveness'

// Client-only liveness hint. The relative time depends on `now`, which differs
// between the SSR render and hydration — computing it during render produces a
// hydration mismatch and a visible text patch. So we render nothing on the
// server / first paint and fill it in after mount. The hint is decorative
// (not SEO content), so deferring it costs nothing.
export function LivenessHint({ stream }: { stream: Stream | undefined }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    setText(livenessHint(stream, new Date())?.text ?? null)
  }, [stream])

  if (!text) return null
  return (
    <p className="text-xs text-gray-400" title="best-effort — streams are checked about daily">
      {text}
    </p>
  )
}
