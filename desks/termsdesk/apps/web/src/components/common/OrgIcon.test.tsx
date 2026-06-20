// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { OrgIcon } from './OrgIcon'

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
const actGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
actGlobal.IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

function icon(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="org-icon"]')
  if (!el) throw new Error('org-icon 을 찾을 수 없습니다')
  return el
}

describe('OrgIcon', () => {
  it('renders the logo image when logoUrl is provided', () => {
    const { container } = render(
      <OrgIcon name="Rotifolk" logoUrl="https://rotifolk.example.com/icon.png" />
    )

    const img = icon(container).querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://rotifolk.example.com/icon.png')
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('falls back to the initial monogram when logoUrl is absent', () => {
    const { container } = render(<OrgIcon name="rotifolk" />)

    expect(icon(container).querySelector('img')).toBeNull()
    expect(icon(container).textContent).toBe('R')
  })

  it('falls back to the monogram when the image fails to load', () => {
    const { container } = render(
      <OrgIcon name="우리 회사" logoUrl="https://broken.example.com/x.png" />
    )

    const img = icon(container).querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)

    expect(icon(container).querySelector('img')).toBeNull()
    expect(icon(container).textContent).toBe('우')
  })

  it('retries the image when logoUrl changes after a failure', () => {
    const { container, rerender } = render(
      <OrgIcon name="Rotifolk" logoUrl="https://broken.example.com/x.png" />
    )
    fireEvent.error(icon(container).querySelector('img')!)
    expect(icon(container).querySelector('img')).toBeNull()

    rerender(<OrgIcon name="Rotifolk" logoUrl="https://rotifolk.example.com/icon.png" />)

    expect(icon(container).querySelector('img')?.getAttribute('src')).toBe(
      'https://rotifolk.example.com/icon.png'
    )
  })

  it('renders ? when the name is empty (마지막 안전망)', () => {
    const { container } = render(<OrgIcon name="  " />)

    expect(icon(container).textContent).toBe('?')
  })
})
