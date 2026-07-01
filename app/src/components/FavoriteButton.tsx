import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useFavorite } from '../lib/useEngagement'

// A star toggle. Client-only (renders nothing on the server / first paint — favorites
// live in localStorage), and safe to place inside ChannelCard's <Link>: its click
// prevents default + stops propagation so tapping the star never navigates.
export function FavoriteButton({ channelId, className }: { channelId: string; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { active, toggle } = useFavorite(channelId)

  if (!mounted) return null

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      data-testid="favorite-button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      className={
        className ??
        'rounded-full p-1.5 text-muted transition hover:bg-paper hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
      }
    >
      <Star className="h-4 w-4" fill={active ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden style={active ? { color: 'var(--color-accent)' } : undefined} />
    </button>
  )
}
