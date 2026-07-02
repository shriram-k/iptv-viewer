import { describe, it, expect, afterEach } from 'vitest'
import { track } from './gtag'

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }

afterEach(() => {
  delete (window as W).gtag
  delete (window as W).dataLayer
})

describe('track', () => {
  it('no-ops before GA is loaded (no consent) without throwing', () => {
    expect((window as W).gtag).toBeUndefined()
    expect(() => track('channel_open', { channel_id: 'x' })).not.toThrow()
  })

  it('emits an event once window.gtag exists', () => {
    // Simulate a loaded gtag (what gtag.client.loadGtag installs).
    const dataLayer: unknown[] = []
    ;(window as W).dataLayer = dataLayer
    ;(window as W).gtag = function () {
      dataLayer.push(arguments)
    } as (...a: unknown[]) => void

    track('channel_open', { channel_id: 'BBCNews.uk' })
    const calls = dataLayer.map((a) => Array.from(a as ArrayLike<unknown>))
    const event = calls.find((c) => c[0] === 'event' && c[1] === 'channel_open')
    expect(event?.[2]).toMatchObject({ channel_id: 'BBCNews.uk' })
  })
})
