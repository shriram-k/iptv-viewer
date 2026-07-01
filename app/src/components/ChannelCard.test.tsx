import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChannelCard } from './ChannelCard'
import type { Channel } from '../data/types'

beforeEach(() => localStorage.clear())

// Render Link as a plain anchor so the card can be tested without a router.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

function channel(over: Partial<Channel> = {}): Channel {
  return {
    id: 'BBCNews.uk', name: 'BBC News', country: 'gb', categories: ['news'], languages: ['eng'],
    logo: null, guide: null, playable: true,
    streams: [{ url: 'https://x/y.m3u8', status: 'online', checkedAt: null, scheme: 'https', likelyPlayable: true, quality: null }],
    ...over,
  }
}

describe('ChannelCard', () => {
  it('full mode shows name + country/category line', () => {
    render(<ChannelCard channel={channel()} mode="full" />)
    expect(screen.getByText('BBC News')).toBeTruthy()
    expect(screen.getByText('GB · news')).toBeTruthy()
  })

  it('compact mode omits the country/category line', () => {
    render(<ChannelCard channel={channel()} mode="compact" />)
    expect(screen.getByText('BBC News')).toBeTruthy()
    expect(screen.queryByText('GB · news')).toBeNull()
  })

  it('no logo → deterministic initial avatar', () => {
    render(<ChannelCard channel={channel({ logo: null })} mode="full" />)
    expect(screen.getByText('BB')).toBeTruthy() // first two letters of "BBC News"
  })

  it('online status → liveness dot present', () => {
    render(<ChannelCard channel={channel()} mode="full" />)
    expect(screen.getByLabelText('recently online')).toBeTruthy()
  })

  it('dead/unknown status → no liveness dot', () => {
    const dead = channel({ streams: [{ url: 'https://x', status: 'timeout', checkedAt: null, scheme: 'https', likelyPlayable: false, quality: null }] })
    render(<ChannelCard channel={dead} mode="full" />)
    expect(screen.queryByLabelText('recently online')).toBeNull()
  })

  it('renders a favorite toggle that favorites without navigating', async () => {
    render(<ChannelCard channel={channel()} mode="full" />)
    const star = await screen.findByTestId('favorite-button')
    // The card link is a separate element; the star is its sibling (valid HTML).
    expect(screen.getByTestId('channel-card').contains(star)).toBe(false)
    fireEvent.click(star)
    await waitFor(() => expect(screen.getByTestId('favorite-button').getAttribute('aria-pressed')).toBe('true'))
  })
})
