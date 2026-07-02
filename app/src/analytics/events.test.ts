import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Channel } from '../data/types'
import {
  trackChannelOpen,
  trackStreamPlay,
  trackPlaySuccess,
  trackStreamError,
  trackWatchDuration,
  trackSearch,
} from './events'
import { track } from './gtag'

vi.mock('./gtag', () => ({ track: vi.fn() }))
const mockTrack = vi.mocked(track)

beforeEach(() => mockTrack.mockClear())

function channel(over: Partial<Channel> = {}): Channel {
  return {
    id: 'BBCNews.uk', name: 'BBC News', country: 'gb', categories: ['news'], languages: ['eng'],
    logo: null, guide: null, playable: true, streams: [], ...over,
  }
}

// The full set of param keys any emitter is allowed to send — asserts identity-free.
const ALLOWED = new Set([
  'channel_id', 'country_code', 'category', 'language',
  'first_frame_ms', 'failure_class', 'seconds', 'search_term',
])

describe('event emitters', () => {
  it('trackChannelOpen sends channel_open with the channel dimensions', () => {
    trackChannelOpen(channel())
    expect(mockTrack).toHaveBeenCalledWith('channel_open', {
      channel_id: 'BBCNews.uk', country_code: 'gb', category: 'news', language: 'eng',
    })
  })

  it('trackStreamPlay sends stream_play', () => {
    trackStreamPlay(channel())
    expect(mockTrack).toHaveBeenCalledWith('stream_play', expect.objectContaining({ channel_id: 'BBCNews.uk' }))
  })

  it('trackPlaySuccess sends play_success with rounded first_frame_ms', () => {
    trackPlaySuccess(channel(), 1234.7)
    expect(mockTrack).toHaveBeenCalledWith('play_success', expect.objectContaining({ first_frame_ms: 1235 }))
  })

  it('trackStreamError sends stream_error with the failure class', () => {
    trackStreamError(channel(), 'region-restricted')
    expect(mockTrack).toHaveBeenCalledWith('stream_error', expect.objectContaining({ failure_class: 'region-restricted' }))
  })

  it('trackWatchDuration rounds seconds, and skips non-positive AND sub-second durations', () => {
    trackWatchDuration(channel(), 42.4)
    expect(mockTrack).toHaveBeenCalledWith('watch_duration', expect.objectContaining({ seconds: 42 }))
    mockTrack.mockClear()
    trackWatchDuration(channel(), 0)
    expect(mockTrack).not.toHaveBeenCalled()
    trackWatchDuration(channel(), 0.4) // rounds to 0 → must not emit seconds:0
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('trackSearch sends a trimmed term, and skips empty queries', () => {
    trackSearch('  bbc  ')
    expect(mockTrack).toHaveBeenCalledWith('search_perform', { search_term: 'bbc' })
    mockTrack.mockClear()
    trackSearch('   ')
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('omits missing optional dimensions rather than sending undefined', () => {
    trackChannelOpen(channel({ country: null, categories: [], languages: [] }))
    expect(mockTrack).toHaveBeenCalledWith('channel_open', { channel_id: 'BBCNews.uk' })
  })

  it('never emits a param outside the identity-free allowlist', () => {
    trackChannelOpen(channel())
    trackPlaySuccess(channel(), 100)
    trackStreamError(channel(), 'dead')
    trackWatchDuration(channel(), 10)
    trackSearch('x')
    for (const [, params] of mockTrack.mock.calls) {
      for (const key of Object.keys(params ?? {})) expect(ALLOWED.has(key)).toBe(true)
    }
  })
})
