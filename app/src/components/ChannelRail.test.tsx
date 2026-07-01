import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { ChannelRail } from './ChannelRail'

// Plain-anchor Link (no router) and a controlled channel index.
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, ...p }: any) => <a {...p}>{children}</a> }))
vi.mock('../data/kv', () => ({
  getChannelIndex: async () => ({
    'BBCNews.uk': { country: 'gb', categories: ['news'], name: 'BBC News' },
    'NDTV.in': { country: 'in', categories: ['news'], name: 'NDTV 24x7' },
  }),
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('ChannelRail', () => {
  it('renders resolved channels for the given ids', async () => {
    render(<ChannelRail title="Your favorites" ids={['BBCNews.uk', 'NDTV.in']} />)
    await waitFor(() => expect(screen.getByTestId('channel-rail')).toBeTruthy())
    expect(screen.getByText('BBC News')).toBeTruthy()
    expect(screen.getByText('NDTV 24x7')).toBeTruthy()
    expect(screen.getByText('Your favorites')).toBeTruthy()
  })

  it('renders nothing when the id list is empty', () => {
    render(<ChannelRail title="Recently watched" ids={[]} />)
    expect(screen.queryByTestId('channel-rail')).toBeNull()
  })

  it('skips ids not present in the index (stale), never rendering broken', async () => {
    render(<ChannelRail title="Your favorites" ids={['Ghost.zz', 'BBCNews.uk']} />)
    await waitFor(() => expect(screen.getByText('BBC News')).toBeTruthy())
    expect(screen.queryByText('Ghost.zz')).toBeNull()
    expect(screen.getAllByTestId('channel-card')).toHaveLength(1)
  })
})
