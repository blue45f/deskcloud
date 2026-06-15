import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListSummary } from '../../components/ListSummary'

describe('ListSummary', () => {
  it('renders one figure per stat with its label', () => {
    render(
      <ListSummary
        stats={[
          { label: 'Total', value: 6, tone: 'accent' },
          { label: 'Enabled', value: 5, tone: 'ok' },
          { label: 'free', value: 2 },
        ]}
      />
    )
    const root = screen.getByTestId('list-summary')
    expect(within(root).getByText('Total')).toBeInTheDocument()
    expect(within(root).getByText('6')).toBeInTheDocument()
    expect(within(root).getByText('Enabled')).toBeInTheDocument()
    expect(within(root).getByText('5')).toBeInTheDocument()
    expect(within(root).getByText('free')).toBeInTheDocument()
    expect(within(root).getByText('2')).toBeInTheDocument()
  })

  it('renders an aria-hidden tone dot only when a tone is given', () => {
    const { container } = render(
      <ListSummary
        stats={[
          { label: 'with', value: 1, tone: 'ok' },
          { label: 'without', value: 0 },
        ]}
      />
    )
    // exactly one tone dot (the toned stat); the untoned stat has none.
    const dots = container.querySelectorAll('span[aria-hidden="true"]')
    expect(dots).toHaveLength(1)
  })

  it('uses a description list for semantics (dt/dd pairs)', () => {
    const { container } = render(<ListSummary stats={[{ label: 'Total', value: 3 }]} />)
    expect(container.querySelector('dl')).not.toBeNull()
    expect(container.querySelector('dt')).not.toBeNull()
    expect(container.querySelector('dd')).not.toBeNull()
  })
})
