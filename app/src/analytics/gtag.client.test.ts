import { describe, it, expect, afterEach, vi } from 'vitest'
import { loadGtag } from './gtag.client'

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }

afterEach(() => {
  vi.unstubAllEnvs()
  document.getElementById('ga-gtag')?.remove()
  delete (window as W).gtag
  delete (window as W).dataLayer
})

describe('loadGtag', () => {
  it('does nothing without a measurement id (analytics off)', () => {
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', '')
    loadGtag()
    expect(typeof (window as W).gtag).toBe('undefined')
    expect(document.getElementById('ga-gtag')).toBeNull()
  })

  it('with an id: injects the tag, sets analytics_storage granted, disables auto page_view', () => {
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123')
    loadGtag()

    const script = document.getElementById('ga-gtag') as HTMLScriptElement
    expect(script?.src).toContain('googletagmanager.com/gtag/js?id=G-TEST123')

    const calls = ((window as W).dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>))
    const consent = calls.find((c) => c[0] === 'consent' && c[1] === 'default')
    expect(consent?.[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' })
    const config = calls.find((c) => c[0] === 'config')
    expect(config?.[1]).toBe('G-TEST123')
    expect(config?.[2]).toMatchObject({ send_page_view: false })
  })

  it('is idempotent — a second call does not append a second script', () => {
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123')
    loadGtag()
    loadGtag()
    expect(document.querySelectorAll('#ga-gtag')).toHaveLength(1)
  })
})
