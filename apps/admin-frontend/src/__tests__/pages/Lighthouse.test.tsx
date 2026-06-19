import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStore } from '../../lib/store'
import { Lighthouse } from '../../pages/Lighthouse'
import { renderWithRouter, resetStore } from '../test-utils'

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
  useStore.setState({ authed: true, adminEnabled: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('Lighthouse page', () => {
  it('runs measurement and shows scores', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          url: 'https://x.com/',
          scores: { performance: 95, accessibility: 80, seo: 100, bestPractices: 70 },
          cached: true,
          durationMs: 6800,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const user = userEvent.setup()
    renderWithRouter(<Lighthouse />)
    await user.type(screen.getByPlaceholderText('https://www.example.com/'), 'https://x.com/')
    await user.click(screen.getByText('측정 실행'))
    await waitFor(() => expect(screen.getByText('95')).toBeInTheDocument())
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText('캐시된 결과')).toBeInTheDocument()
  })

  it('shares the scorecard via clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          url: 'https://x.com/',
          scores: { performance: 95, accessibility: 80, seo: 100, bestPractices: 70 },
          cached: false,
          durationMs: 6800,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const user = userEvent.setup()
    // setup() 이 navigator.clipboard 를 자체 스텁으로 덮으므로, 그 다음에 우리 모킹을 건다.
    // 테스트 env 엔 navigator.share 가 없어 shareOrCopy 가 클립보드 폴백을 탄다.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    renderWithRouter(<Lighthouse />)
    await user.type(screen.getByPlaceholderText('https://www.example.com/'), 'https://x.com/')
    await user.click(screen.getByText('측정 실행'))
    await waitFor(() => expect(screen.getByText('95')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /점수 공유/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('https://x.com/')
    expect(writeText.mock.calls[0][0]).toContain('Performance 95')
  })
})
