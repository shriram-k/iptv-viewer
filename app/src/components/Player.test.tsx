import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Player } from './Player'
import type { Channel } from '../data/types'

function channel(streams: Channel['streams']): Channel {
  return { id: 'x', name: 'X', country: 'gb', categories: [], languages: [], logo: null, guide: null, playable: true, streams }
}

describe('Player', () => {
  it('renders a video element when a stream URL exists', () => {
    render(<Player channel={channel([{ url: 'https://x/y.m3u8', status: 'online', checkedAt: null, scheme: 'https', likelyPlayable: true, quality: null }])} />)
    expect(screen.getByTestId('player')).toBeTruthy()
    expect(document.querySelector('video')).toBeTruthy()
  })

  it('shows a no-stream message when there are no streams', () => {
    render(<Player channel={channel([])} />)
    expect(screen.getByText(/No stream available/i)).toBeTruthy()
    expect(screen.queryByTestId('player')).toBeNull()
  })
})
