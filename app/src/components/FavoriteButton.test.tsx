import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { FavoriteButton } from './FavoriteButton'
import { useFavorites } from '../lib/useEngagement'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('FavoriteButton', () => {
  it('toggles favorite state on click and flips aria-pressed', async () => {
    render(<FavoriteButton channelId="a.uk" />)
    const btn = await screen.findByTestId('favorite-button')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('favorite-button').getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(screen.getByTestId('favorite-button'))
    await waitFor(() => expect(screen.getByTestId('favorite-button').getAttribute('aria-pressed')).toBe('false'))
  })

  it('does not navigate when placed inside a link (preventDefault + stopPropagation)', async () => {
    const onParentClick = vi.fn()
    render(
      // eslint-disable-next-line jsx-a11y/anchor-is-valid
      <a href="/somewhere" onClick={onParentClick}>
        <FavoriteButton channelId="a.uk" />
      </a>,
    )
    const btn = await screen.findByTestId('favorite-button')
    fireEvent.click(btn)
    expect(onParentClick).not.toHaveBeenCalled() // stopPropagation kept it off the anchor
  })

  it('two buttons for the same channel share state', async () => {
    render(
      <>
        <FavoriteButton channelId="x.in" />
        <div data-testid="second">
          <FavoriteButton channelId="x.in" />
        </div>
      </>,
    )
    const buttons = await screen.findAllByTestId('favorite-button')
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])
    await waitFor(() => {
      const all = screen.getAllByTestId('favorite-button')
      expect(all.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
    })
  })

  it('updates a useFavorites consumer rendered alongside', async () => {
    function List() {
      const favs = useFavorites()
      return <ul data-testid="favs">{favs.map((id) => <li key={id}>{id}</li>)}</ul>
    }
    render(
      <>
        <FavoriteButton channelId="b.fr" />
        <List />
      </>,
    )
    const btn = await screen.findByTestId('favorite-button')
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('favs').textContent).toContain('b.fr'))
  })
})
