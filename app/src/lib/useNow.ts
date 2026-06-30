import { useEffect, useState } from 'react'

// A ticking "now" for client-only, time-relative UI (now/next labels, the Live
// board). Returns null on the server and first paint — so SSR markup matches and
// there's no hydration mismatch — then a live Date.now() that advances on an
// interval, so labels and the board don't freeze on the page-load instant for a
// long-running live-TV session.
export function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
