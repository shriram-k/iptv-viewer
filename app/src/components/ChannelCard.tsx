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
  return <span aria-label="recently online" title="recently online" className="inline-block h-2 w-2 rounded-full bg-green-500" />
}

function Logo({ channel }: { channel: Channel }) {
  const hue = hueFromName(channel.name || channel.id)
  const initials = (channel.name || channel.id).slice(0, 2).toUpperCase()
  if (!channel.logo) {
    return (
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded text-xs font-bold text-white" style={{ background: `hsl(${hue} 55% 45%)` }}>
        {initials}
      </span>
    )
  }
  return (
    <img
      src={channel.logo}
      alt=""
      loading="lazy"
      className="h-10 w-10 rounded object-contain"
      onError={(e) => {
        // Swap a broken logo for the deterministic initial avatar.
        const el = e.currentTarget
        el.style.display = 'none'
        el.insertAdjacentHTML(
          'afterend',
          `<span aria-hidden class="flex h-10 w-10 items-center justify-center rounded text-xs font-bold text-white" style="background:hsl(${hue} 55% 45%)">${initials}</span>`,
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
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 focus:outline focus:outline-2 focus:outline-blue-500"
      data-testid="channel-card"
    >
      <Logo channel={channel} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{channel.name || channel.id}</span>
          <Liveness channel={channel} />
        </span>
        {mode === 'full' && (
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {[channel.country?.toUpperCase(), channel.categories[0]].filter(Boolean).join(' · ')}
          </span>
        )}
        {mode === 'full' && <NowNext schedule={schedule} />}
      </span>
    </Link>
  )
}
