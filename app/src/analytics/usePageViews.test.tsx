import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { usePageViews } from './usePageViews'

// Controllable consent status + a minimal router.
const state = vi.hoisted(() => ({ status: 'unset' as 'unset' | 'granted' | 'denied' }))
const track = vi.hoisted(() => vi.fn())
const mockRouter = {
  state: { location: { pathname: '/country/gb', searchStr: '' } },
  subscribe: () => () => {},
}

vi.mock('./gtag', () => ({ track }))
vi.mock('./useConsent', () => ({ useConsent: () => ({ status: state.status, accept() {}, decline() {} }) }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => mockRouter }))

function Probe() {
  usePageViews()
  return null
}

beforeEach(() => {
  track.mockClear()
  state.status = 'unset'
})
afterEach(cleanup)

describe('usePageViews', () => {
  it('does not emit page_view while consent is not granted', async () => {
    render(<Probe />)
    await new Promise((r) => setTimeout(r, 10))
    expect(track).not.toHaveBeenCalled()
  })

  it('emits a page_view for the current page once consent is granted', async () => {
    state.status = 'granted'
    render(<Probe />)
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('page_view', expect.objectContaining({ page_path: '/country/gb' })),
    )
  })
})
