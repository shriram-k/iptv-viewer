import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { Player } from './Player'
import type { Channel, Stream } from '../data/types'

// Controllable hls.js fake: records instances so tests can emit MANIFEST_PARSED /
// fatal ERROR and assert loadSource/destroy. (vi.hoisted so the mock factory and
// the test body share the same registry.)
const hlsMock = vi.hoisted(() => {
  const instances: Array<{
    config: unknown
    handlers: Record<string, (e: unknown, data: unknown) => void>
    loadSource: ReturnType<typeof vi.fn>
    attachMedia: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    emit: (event: string, data?: unknown) => void
  }> = []
  class FakeHls {
    config: unknown
    handlers: Record<string, (e: unknown, data: unknown) => void> = {}
    loadSource = vi.fn()
    attachMedia = vi.fn()
    stopLoad = vi.fn()
    detachMedia = vi.fn()
    destroy = vi.fn()
    constructor(config: unknown) {
      this.config = config
      instances.push(this as never)
    }
    on(event: string, cb: (e: unknown, data: unknown) => void) {
      this.handlers[event] = cb
    }
    emit(event: string, data?: unknown) {
      this.handlers[event]?.(event, data)
    }
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' }
    static isSupported = vi.fn(() => true)
  }
  return { instances, FakeHls }
})
vi.mock('hls.js', () => ({ default: hlsMock.FakeHls }))

function stream(url: string, overrides: Partial<Stream> = {}): Stream {
  const scheme = url.startsWith('https') ? 'https' : 'http'
  return { url, status: 'online', checkedAt: null, scheme, likelyPlayable: true, quality: null, ...overrides }
}
function channel(streams: Stream[]): Channel {
  return { id: 'x', name: 'X', country: 'gb', categories: [], languages: [], logo: null, guide: null, playable: true, streams }
}
function video() {
  return screen.getByTestId('player').querySelector('video') as HTMLVideoElement
}

let originalLocation: PropertyDescriptor | undefined
function setProtocol(protocol: string) {
  originalLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', { configurable: true, value: { protocol, href: `${protocol}//localhost/` } })
}

beforeEach(() => {
  hlsMock.instances.length = 0
  hlsMock.FakeHls.isSupported.mockReturnValue(true)
  // jsdom doesn't implement media playback — stub to keep the console quiet.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.load = vi.fn()
})
afterEach(() => {
  cleanup()
  if (originalLocation) {
    Object.defineProperty(window, 'location', originalLocation)
    originalLocation = undefined
  }
})

describe('Player', () => {
  it('renders a video element when a stream URL exists', async () => {
    render(<Player channel={channel([stream('https://x/y.m3u8')])} />)
    expect(screen.getByTestId('player')).toBeTruthy()
    expect(video()).toBeTruthy()
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
  })

  it('shows a no-stream message when there are no streams', () => {
    render(<Player channel={channel([])} />)
    expect(screen.getByText(/No stream available/i)).toBeTruthy()
    expect(screen.queryByTestId('player')).toBeNull()
  })

  it('plays the first stream and offers an unmute affordance once playing', async () => {
    render(<Player channel={channel([stream('https://x/first.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    expect(hlsMock.instances[0].loadSource).toHaveBeenCalledWith('https://x/first.m3u8')
    hlsMock.instances[0].emit('hlsManifestParsed')
    fireEvent.canPlay(video())
    await waitFor(() => expect(screen.getByTestId('player-unmute')).toBeTruthy())
    expect(screen.queryByTestId('player-error')).toBeNull()
  })

  it('does not settle on loadedmetadata alone, so a later fatal error still fails over', async () => {
    render(<Player channel={channel([stream('https://x/first.m3u8'), stream('https://x/second.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    // Metadata parses, but no `canplay` — then the segments fail fatally.
    fireEvent.loadedMetadata(video())
    hlsMock.instances[0].emit('hlsError', { fatal: true, type: 'networkError', details: 'fragLoadError', response: { code: 403 } })
    await waitFor(() => expect(hlsMock.instances).toHaveLength(2))
    expect(hlsMock.instances[1].loadSource).toHaveBeenCalledWith('https://x/second.m3u8')
  })

  it('shows the no-stream message when the only stream has an empty URL', () => {
    render(<Player channel={channel([stream('')])} />)
    expect(screen.getByText(/No stream available/i)).toBeTruthy()
    expect(screen.queryByTestId('player')).toBeNull()
  })

  it('fails over to the second URL on a fatal error without showing an error card', async () => {
    render(<Player channel={channel([stream('https://x/first.m3u8'), stream('https://x/second.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    hlsMock.instances[0].emit('hlsError', { fatal: true, type: 'networkError', details: 'manifestLoadError', response: { code: 404 } })
    await waitFor(() => expect(hlsMock.instances).toHaveLength(2))
    expect(hlsMock.instances[0].destroy).toHaveBeenCalled()
    expect(hlsMock.instances[1].loadSource).toHaveBeenCalledWith('https://x/second.m3u8')
    expect(screen.queryByTestId('player-error')).toBeNull()
  })

  it('classifies an http-only stream on an https page as browser-blocked without touching hls.js', async () => {
    setProtocol('https:')
    render(<Player channel={channel([stream('http://x/only.m3u8')])} />)
    await waitFor(() => expect(screen.getByTestId('player-error')).toBeTruthy())
    expect(hlsMock.instances).toHaveLength(0)
    expect(screen.getByTestId('player-error').textContent).toMatch(/blocked or unreachable/i)
    expect(screen.getByTestId('player-retry')).toBeTruthy()
  })

  it('shows the region-restricted message when all streams return 403', async () => {
    render(<Player channel={channel([stream('https://x/a.m3u8'), stream('https://x/b.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    hlsMock.instances[0].emit('hlsError', { fatal: true, type: 'networkError', details: 'manifestLoadError', response: { code: 403 } })
    await waitFor(() => expect(hlsMock.instances).toHaveLength(2))
    hlsMock.instances[1].emit('hlsError', { fatal: true, type: 'networkError', details: 'manifestLoadError', response: { code: 403 } })
    await waitFor(() => expect(screen.getByTestId('player-error')).toBeTruthy())
    expect(screen.getByTestId('player-error').textContent).toMatch(/region-restricted/i)
  })

  it('shows exactly one honest failure card with a retry and no playing video when exhausted', async () => {
    render(<Player channel={channel([stream('https://x/only.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    hlsMock.instances[0].emit('hlsError', { fatal: true, type: 'networkError', details: 'manifestLoadError', response: { code: 410 } })
    await waitFor(() => expect(screen.getByTestId('player-error')).toBeTruthy())
    expect(screen.getAllByTestId('player-error')).toHaveLength(1)
    expect(screen.getByTestId('player-retry')).toBeTruthy()
    expect(screen.getByTestId('player').querySelector('video')).toBeNull()
  })

  it('retries from the first URL when the user clicks Try again', async () => {
    render(<Player channel={channel([stream('https://x/first.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    hlsMock.instances[0].emit('hlsError', { fatal: true, type: 'networkError', details: 'manifestLoadError', response: { code: 404 } })
    await waitFor(() => expect(screen.getByTestId('player-retry')).toBeTruthy())
    fireEvent.click(screen.getByTestId('player-retry'))
    await waitFor(() => expect(hlsMock.instances).toHaveLength(2))
    expect(hlsMock.instances[1].loadSource).toHaveBeenCalledWith('https://x/first.m3u8')
  })

  it('tears down hls.js on unmount', async () => {
    const { unmount } = render(<Player channel={channel([stream('https://x/only.m3u8')])} />)
    await waitFor(() => expect(hlsMock.instances).toHaveLength(1))
    unmount()
    expect(hlsMock.instances[0].destroy).toHaveBeenCalled()
  })

  it('falls over to honest failure when hls.js is unsupported', async () => {
    hlsMock.FakeHls.isSupported.mockReturnValue(false)
    render(<Player channel={channel([stream('https://x/only.m3u8')])} />)
    await waitFor(() => expect(screen.getByTestId('player-error')).toBeTruthy())
  })
})
