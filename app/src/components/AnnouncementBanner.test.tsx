import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnnouncementBanner } from './AnnouncementBanner'

const rc = vi.hoisted(() => ({ value: { announcement: '', killed: new Set<string>(), collections: [] } }))
vi.mock('../lib/useRemoteConfig', () => ({ useRemoteConfig: () => rc.value }))

afterEach(cleanup)

describe('AnnouncementBanner', () => {
  it('renders the announcement when set', () => {
    rc.value = { announcement: 'Maintenance Sunday 02:00 UTC', killed: new Set(), collections: [] }
    render(<AnnouncementBanner />)
    expect(screen.getByTestId('announcement').textContent).toContain('Maintenance Sunday')
  })

  it('renders nothing when the announcement is empty (the default)', () => {
    rc.value = { announcement: '', killed: new Set(), collections: [] }
    render(<AnnouncementBanner />)
    expect(screen.queryByTestId('announcement')).toBeNull()
  })
})
