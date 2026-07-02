import { describe, it, expect, beforeEach, vi } from 'vitest'

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }

// Fresh module (queue state) per test; consent is driven purely by localStorage.
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  delete (window as W).gtag
  delete (window as W).dataLayer
})

function installGtag(): unknown[] {
  const dataLayer: unknown[] = []
  ;(window as W).dataLayer = dataLayer
  ;(window as W).gtag = function () {
    dataLayer.push(arguments)
  } as (...a: unknown[]) => void
  return dataLayer
}
const events = (dl: unknown[]) => dl.map((a) => Array.from(a as ArrayLike<unknown>)).filter((c) => c[0] === 'event')
const grant = () => localStorage.setItem('ftv:consent:v1', 'granted')
const revoke = () => localStorage.setItem('ftv:consent:v1', 'denied')

describe('track (consent-gated + buffered)', () => {
  it('no-ops with no consent, even if gtag is present', async () => {
    const { track } = await import('./gtag')
    const dl = installGtag()
    track('channel_open', { channel_id: 'x' })
    expect(events(dl)).toHaveLength(0)
  })

  it('emits directly when consent is granted and gtag is loaded', async () => {
    grant()
    const { track } = await import('./gtag')
    const dl = installGtag()
    track('channel_open', { channel_id: 'BBCNews.uk' })
    expect(events(dl)[0]?.[2]).toMatchObject({ channel_id: 'BBCNews.uk' })
  })

  it('buffers events fired before GA loads, then flushQueue replays them', async () => {
    grant()
    const { track, flushQueue } = await import('./gtag')
    track('stream_play', { channel_id: 'a' }) // granted but gtag not installed yet → buffered
    const dl = installGtag()
    expect(events(dl)).toHaveLength(0) // not sent until flush
    flushQueue()
    expect(events(dl)[0]?.[1]).toBe('stream_play')
  })

  it('revoke drops buffered events, tells gtag denied, and stops further emits', async () => {
    grant()
    const { track, flushQueue, syncConsent } = await import('./gtag')
    track('stream_play', { channel_id: 'a' }) // buffered
    revoke()
    const dl = installGtag()
    syncConsent()
    const update = dl.map((a) => Array.from(a as ArrayLike<unknown>)).find((c) => c[0] === 'consent' && c[1] === 'update')
    expect(update?.[2]).toMatchObject({ analytics_storage: 'denied' })
    flushQueue() // must not replay after revoke
    track('page_view', {}) // must not emit after revoke
    expect(events(dl)).toHaveLength(0)
  })
})
