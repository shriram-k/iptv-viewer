import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { createRootRoute, createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { LiveNowBoard } from './LiveNowBoard'
import type { EpgShard, EpgMeta } from '../data/types'

// LiveNowBoard renders <Link>, so it needs a router context. Wrap it in a minimal
// in-memory router whose root renders the board with the given props.
function renderBoard(props: Parameters<typeof LiveNowBoard>[0]) {
  const rootRoute = createRootRoute({ component: () => <LiveNowBoard {...props} /> })
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<RouterProvider router={router as never} />)
}

const H = 3600_000
function airingShard(now: number, ids: string[]): EpgShard {
  return Object.fromEntries(ids.map((id) => [id, [{ startUtcMs: now - H, stopUtcMs: now + H, title: `${id} live` }]]))
}
const meta = (overrides: Partial<EpgMeta['config']> = {}): EpgMeta => ({
  generatedAt: 'x',
  coverage: {},
  config: { coverageThreshold: 0.2, minAiring: 2, bracketHours: 36, ...overrides },
})

afterEach(cleanup)

describe('LiveNowBoard', () => {
  it('renders ranked airing channels when the scope is eligible', async () => {
    const now = Date.now()
    renderBoard({
      shard: airingShard(now, ['A.in', 'B.in', 'C.in']),
      meta: meta(),
      coverage: 0.5,
      nameById: { 'A.in': 'Alpha', 'B.in': 'Bravo', 'C.in': 'Charlie' },
    })
    await waitFor(() => expect(screen.getByTestId('live-now-board')).toBeTruthy())
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getAllByText('LIVE')).toHaveLength(3)
  })

  it('renders nothing when coverage is below threshold', async () => {
    const now = Date.now()
    renderBoard({ shard: airingShard(now, ['A.in', 'B.in']), meta: meta(), coverage: 0.05, nameById: {} })
    // Give the mount effect a tick; the board must stay absent.
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('live-now-board')).toBeNull()
  })

  it('renders nothing when too few channels are currently airing (late night)', async () => {
    const now = Date.now()
    // Only 1 airing, minAiring is 2.
    renderBoard({ shard: airingShard(now, ['A.in']), meta: meta(), coverage: 0.9, nameById: { 'A.in': 'Alpha' } })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('live-now-board')).toBeNull()
  })

  it('renders nothing when EPG meta is absent', async () => {
    const now = Date.now()
    renderBoard({ shard: airingShard(now, ['A.in', 'B.in']), meta: null, coverage: 0.9, nameById: {} })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('live-now-board')).toBeNull()
  })
})
