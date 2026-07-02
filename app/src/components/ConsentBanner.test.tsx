import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ConsentBanner } from './ConsentBanner'

const loadGtag = vi.fn()
vi.mock('../analytics/gtag.client', () => ({ loadGtag }))

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: 'ftv:consent:v1' }))
  loadGtag.mockClear()
})
afterEach(cleanup)

describe('ConsentBanner', () => {
  it('shows for a new visitor (unset) with Accept/Decline', async () => {
    render(<ConsentBanner />)
    await waitFor(() => expect(screen.getByTestId('consent-banner')).toBeTruthy())
    expect(screen.getByText('Accept')).toBeTruthy()
    expect(screen.getByText('Decline')).toBeTruthy()
  })

  it('Covers AE2 — Decline hides the banner and loads NO analytics; page stays usable', async () => {
    render(<ConsentBanner />)
    await waitFor(() => expect(screen.getByTestId('consent-banner')).toBeTruthy())
    fireEvent.click(screen.getByText('Decline'))
    await waitFor(() => expect(screen.queryByTestId('consent-banner')).toBeNull())
    await new Promise((r) => setTimeout(r, 20))
    expect(loadGtag).not.toHaveBeenCalled()
  })

  it('Accept hides the banner and loads analytics', async () => {
    render(<ConsentBanner />)
    await waitFor(() => expect(screen.getByTestId('consent-banner')).toBeTruthy())
    fireEvent.click(screen.getByText('Accept'))
    await waitFor(() => expect(screen.queryByTestId('consent-banner')).toBeNull())
    await waitFor(() => expect(loadGtag).toHaveBeenCalled())
  })

  it('renders nothing once a choice already exists', async () => {
    localStorage.setItem('ftv:consent:v1', 'denied')
    window.dispatchEvent(new StorageEvent('storage', { key: 'ftv:consent:v1' }))
    render(<ConsentBanner />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('consent-banner')).toBeNull()
  })
})
