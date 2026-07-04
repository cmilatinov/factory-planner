import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { layoutStateKey, projectStateKey } from '../src/domain'

describe('Factory Planner app', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the default workspace without blueprint editor or statistics windows', async () => {
    render(<App />)

    expect(await screen.findByTestId('dockview-workspace')).toBeInTheDocument()
    expect((await screen.findAllByTestId('panel-planner')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Blueprint Editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Statistics/ })).not.toBeInTheDocument()
  })

  it('opens one floating statistics window per source panel and closes it', async () => {
    const user = userEvent.setup()
    render(<App />)

    const plannerPanel = (await screen.findAllByTestId('panel-planner'))[0]
    fireEvent.contextMenu(plannerPanel)
    await user.click(await screen.findByRole('menuitem', { name: /Show Statistics/i }))

    expect(await screen.findByRole('dialog', { name: 'Production planner - Statistics' })).toBeInTheDocument()

    fireEvent.contextMenu(plannerPanel)
    await user.click(await screen.findByRole('menuitem', { name: /Show Statistics/i }))
    expect(screen.getAllByTestId('stats-window-planner')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Close Production planner - Statistics/i }))
    await waitFor(() => {
      expect(screen.queryByTestId('stats-window-planner')).not.toBeInTheDocument()
    })
  })

  it('keeps project and layout reset controls scoped to separate storage keys', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem(layoutStateKey, JSON.stringify({ persisted: true }))
    localStorage.setItem(projectStateKey, JSON.stringify({ persisted: true }))

    render(<App />)
    await screen.findAllByTestId('panel-planner')
    await user.click(screen.getAllByRole('button', { name: /Clear current project/i })[0])
    expect(localStorage.getItem(projectStateKey)).not.toContain('persisted')

    localStorage.setItem(layoutStateKey, JSON.stringify({ persisted: true }))
    await user.click(screen.getAllByRole('button', { name: /Reset layout/i })[0])
    expect(localStorage.getItem(layoutStateKey)).not.toContain('persisted')
  })
})
