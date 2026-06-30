import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { NowNext } from './NowNext'
import type { Programme } from '../data/types'

const H = 3600_000
function around(now: number): Programme[] {
  return [
    { startUtcMs: now - H, stopUtcMs: now, title: 'Earlier Show' },
    { startUtcMs: now, stopUtcMs: now + H, title: 'Current Show' },
    { startUtcMs: now + H, stopUtcMs: now + 2 * H, title: 'Next Show' },
  ]
}

afterEach(cleanup)

describe('NowNext', () => {
  it('shows Now and Next after mount when a schedule exists', async () => {
    render(<NowNext schedule={around(Date.now())} />)
    await waitFor(() => expect(screen.getByTestId('now-next')).toBeTruthy())
    expect(screen.getByTestId('now-next').textContent).toMatch(/Now:.*Current Show/)
    expect(screen.getByTestId('now-next').textContent).toMatch(/Next:.*Next Show/)
  })

  it('renders nothing when there is no schedule (silent degradation)', () => {
    const { container } = render(<NowNext schedule={undefined} />)
    expect(screen.queryByTestId('now-next')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('renders nothing for an empty schedule', () => {
    render(<NowNext schedule={[]} />)
    expect(screen.queryByTestId('now-next')).toBeNull()
  })

  it('shows only Next when nothing is currently airing', async () => {
    const now = Date.now()
    const future: Programme[] = [{ startUtcMs: now + H, stopUtcMs: now + 2 * H, title: 'Upcoming' }]
    render(<NowNext schedule={future} />)
    await waitFor(() => expect(screen.getByTestId('now-next')).toBeTruthy())
    const text = screen.getByTestId('now-next').textContent || ''
    expect(text).toMatch(/Next:.*Upcoming/)
    expect(text).not.toMatch(/Now:/)
  })
})
