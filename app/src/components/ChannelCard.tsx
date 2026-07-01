import { Link } from '@tanstack/react-router'
import type { Channel, Programme } from '../data/types'
import { isPlausiblyLive } from '../data/status'
import { NowNext } from './NowNext'

type Mode = 'compact' | 'full'

// Deterministic accent colour from the channel name (logo-fallback avatar).
function hueFromName(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

function Liveness({ channel }: { channel: Channel }) {
  // Best-effort hint only; suppress when unknown or known-dead (no false "LIVE").
  if (!isPlausiblyLive(channel.streams[0]?.status)) return null
  return <span aria-label="recently online" title="recently online" className="live-dot inline-block h-2 w-2 shrink-0 rounded-full bg-accent" />
}

function Logo({ channel }: { channel: Channel }) {
  const hue = hueFromName(channel.name || channel.id)
  const initials = (channel.name || channel.id).slice(0, 2).toUpperCase()
  if (!channel.logo) {
    return (
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-white" style={{ background: `hsl(${hue} 45% 42%)` }}>
        {initials}
      </span>
    )
  }
  return (
    <img
      src={channel.logo}
      alt=""
      loading="lazy"
      className="h-11 w-11 shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-line"
      onError={(e) => {
        // Swap a broken logo for the deterministic initial avatar.
        const el = e.currentTarget
        el.style.display = 'none'
        el.insertAdjacentHTML(
          'afterend',
          `<span aria-hidden class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-white" style="background:hsl(${hue} 45% 42%)">${initials}</span>`,
        )
      }}
    />
  )
}

export function ChannelCard({ channel, mode = 'full', schedule }: { channel: Channel; mode?: Mode; schedule?: Programme[] }) {
  return (
    <Link
      to="/channel/$id"
      params={{ id: channel.id }}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_6px_20px_-12px_rgba(27,23,32,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      data-testid="channel-card"
    >
      <Logo channel={channel} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{channel.name || channel.id}</span>
          <Liveness channel={channel} />
        </span>
        {mode === 'full' && (
          <span className="mt-0.5 block truncate font-mono text-xs uppercase tracking-wide text-muted">
            {[channel.country?.toUpperCase(), channel.categories[0]].filter(Boolean).join(' · ')}
          </span>
        )}
        {mode === 'full' && <NowNext schedule={schedule} className="mt-1 text-xs text-muted" />}
      </span>
      <span aria-hidden className="font-display text-lg text-line transition group-hover:translate-x-0.5 group-hover:text-accent">→</span>
    </Link>
  )
}
