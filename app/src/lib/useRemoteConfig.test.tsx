import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useRemoteConfig } from './useRemoteConfig'

// With no VITE_FIREBASE_* config (the test/dev default), getRC() returns null and
// the hook stays on defaults — the site's "RC never loads" path. It must render
// defaults without throwing.
function Probe() {
  const rc = useRemoteConfig()
  return (
    <div>
      <span data-testid="announcement">{rc.announcement || '(none)'}</span>
      <span data-testid="killed">{rc.killed.size}</span>
      <span data-testid="collections">{rc.collections.length}</span>
    </div>
  )
}

afterEach(cleanup)

describe('useRemoteConfig (defaults-safe)', () => {
  it('renders default config (empty) when Firebase is not configured, without throwing', async () => {
    render(<Probe />)
    // Let the mount effect + any dynamic import settle.
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.getByTestId('announcement').textContent).toBe('(none)')
    expect(screen.getByTestId('killed').textContent).toBe('0')
    expect(screen.getByTestId('collections').textContent).toBe('0')
  })
})
