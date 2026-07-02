import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { useConsent } from './useConsent'

// Mock the client-only GA loader so we can assert it is / isn't called.
const loadGtag = vi.fn()
vi.mock('./gtag.client', () => ({ loadGtag }))

// The consent store is a module-shared singleton; reset it between tests by clearing
// storage and dispatching the `storage` event it listens to.
beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: 'ftv:consent:v1' }))
  loadGtag.mockClear()
})
afterEach(cleanup)

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

describe('useConsent', () => {
  it('starts unset (mounted-gate); accept → granted, persists, loads GA', async () => {
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unset'))
    fireEvent.click(screen.getByText('accept'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('granted'))
    expect(localStorage.getItem('ftv:consent:v1')).toBe('granted')
    await waitFor(() => expect(loadGtag).toHaveBeenCalled())
  })

  it('decline → denied, persists, and does NOT load GA', async () => {
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unset'))
    fireEvent.click(screen.getByText('decline'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('denied'))
    expect(localStorage.getItem('ftv:consent:v1')).toBe('denied')
    await new Promise((r) => setTimeout(r, 20))
    expect(loadGtag).not.toHaveBeenCalled()
  })

  it('a returning granted visitor loads GA on mount', async () => {
    localStorage.setItem('ftv:consent:v1', 'granted')
    window.dispatchEvent(new StorageEvent('storage', { key: 'ftv:consent:v1' }))
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('granted'))
    await waitFor(() => expect(loadGtag).toHaveBeenCalled())
  })
})
