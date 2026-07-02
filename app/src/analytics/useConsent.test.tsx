import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// Mock the client-only GA loader so we can assert it is / isn't called.
const loadGtag = vi.fn()
vi.mock('./gtag.client', () => ({ loadGtag }))

// Reset module state (singleton store + loadStarted) between tests.
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  loadGtag.mockClear()
})
afterEach(cleanup)

async function renderProbe() {
  const { useConsent } = await import('./useConsent')
  function Probe() {
    const { status, accept, decline } = useConsent()
    return (
      <div>
        <span data-testid="status">{status}</span>
        <button onClick={accept}>accept</button>
        <button onClick={decline}>decline</button>
      </div>
    )
  }
  render(<Probe />)
}

describe('useConsent', () => {
  it('starts unset (mounted-gate); accept → granted, persists, loads GA', async () => {
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unset'))
    fireEvent.click(screen.getByText('accept'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('granted'))
    expect(localStorage.getItem('ftv:consent:v1')).toBe('granted')
    await waitFor(() => expect(loadGtag).toHaveBeenCalled())
  })

  it('decline → denied, persists, and does NOT load GA', async () => {
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unset'))
    fireEvent.click(screen.getByText('decline'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('denied'))
    await new Promise((r) => setTimeout(r, 20))
    expect(loadGtag).not.toHaveBeenCalled()
  })

  it('a returning granted visitor loads GA on mount', async () => {
    localStorage.setItem('ftv:consent:v1', 'granted')
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('granted'))
    await waitFor(() => expect(loadGtag).toHaveBeenCalled())
  })
})
