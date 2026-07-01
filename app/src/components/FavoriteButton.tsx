import { Star } from 'lucide-react'
import { useFavorite } from '../lib/useEngagement'

// A star toggle. `useFavorite` is SSR-safe (inactive on the server and first paint,
// then fills in after mount from localStorage — no hydration mismatch), so the
// button needs no separate mount gate. The click prevents default + stops
// propagation defensively, so if it ever sits near/inside a clickable ancestor
// tapping the star won't also activate that ancestor.
export function FavoriteButton({ channelId, className }: { channelId: string; className?: string }) {
  const { active, toggle } = useFavorite(channelId)

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
