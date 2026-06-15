import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from '../../components/EmptyState'

describe('EmptyState', () => {
  it('renders the title and hint', () => {
    render(<EmptyState title="아직 추적된 호스트가 없습니다" hint="요청이 라우팅되면 표시됩니다" />)
    expect(screen.getByText('아직 추적된 호스트가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('요청이 라우팅되면 표시됩니다')).toBeInTheDocument()
  })

  it('renders without a hint', () => {
    render(<EmptyState title="비어 있음" />)
    expect(screen.getByText('비어 있음')).toBeInTheDocument()
  })

  it('renders a decorative, aria-hidden default mark', () => {
    const { container } = render(<EmptyState title="x" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards data-testid', () => {
    render(<EmptyState title="x" data-testid="empty-foo" />)
    expect(screen.getByTestId('empty-foo')).toBeInTheDocument()
  })

  it('renders an optional action affordance', () => {
    render(<EmptyState title="x" action={<button type="button">첫 항목 추가</button>} />)
    expect(screen.getByRole('button', { name: '첫 항목 추가' })).toBeInTheDocument()
  })

  it('omits the action wrapper when no action is given', () => {
    const { container } = render(<EmptyState title="x" />)
    expect(container.querySelector('button')).toBeNull()
  })
})
