import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStore } from '../../lib/store'
import { AuditLog } from '../../pages/AuditLog'
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

describe('AuditLog page', () => {
  it('shows empty state when no events', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, events: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<AuditLog />)
    await waitFor(() =>
      expect(screen.getByText('기록된 감사 이벤트가 없습니다.')).toBeInTheDocument()
    )
  })

  it('renders event rows', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              ts: '2026-04-27T10:30:45.123Z',
              actor: 'admin',
              action: 'cache.clear',
              outcome: 'ok',
              hash: 'abcd1234ef5678abcdef',
            },
            {
              ts: '2026-04-27T10:31:00.000Z',
              actor: 'admin',
              action: 'visual.diff',
              target: 'https://x/y',
              outcome: 'error',
              hash: '99887766554433221100',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    renderWithRouter(<AuditLog />)
    await waitFor(() => expect(screen.getByText('cache.clear')).toBeInTheDocument())
    expect(screen.getByText('visual.diff')).toBeInTheDocument()
    expect(screen.getByText('https://x/y')).toBeInTheDocument()
    expect(screen.getByText('10:30:45')).toBeInTheDocument()
  })

  it('filters rows by text and by outcome', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              ts: '2026-04-27T10:30:45.123Z',
              actor: 'admin',
              action: 'cache.clear',
              outcome: 'ok',
              hash: 'abcd1234ef5678abcdef',
            },
            {
              ts: '2026-04-27T10:31:00.000Z',
              actor: 'system',
              action: 'visual.diff',
              target: 'https://x/y',
              outcome: 'error',
              hash: '99887766554433221100',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    renderWithRouter(<AuditLog />)
    await waitFor(() => expect(screen.getByText('cache.clear')).toBeInTheDocument())

    // text filter narrows to the matching actor
    fireEvent.change(screen.getByPlaceholderText('actor · action · target 검색'), {
      target: { value: 'system' },
    })
    expect(screen.queryByText('cache.clear')).not.toBeInTheDocument()
    expect(screen.getByText('visual.diff')).toBeInTheDocument()

    // clearing the filter and switching outcome to 성공 hides the error row
    fireEvent.change(screen.getByPlaceholderText('actor · action · target 검색'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: '성공' }))
    expect(screen.getByText('cache.clear')).toBeInTheDocument()
    expect(screen.queryByText('visual.diff')).not.toBeInTheDocument()
  })

  it('shows a filtered empty state when nothing matches', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              ts: '2026-04-27T10:30:45.123Z',
              actor: 'admin',
              action: 'cache.clear',
              outcome: 'ok',
              hash: 'abcd1234ef5678abcdef',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    renderWithRouter(<AuditLog />)
    await waitFor(() => expect(screen.getByText('cache.clear')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('actor · action · target 검색'), {
      target: { value: 'zzz-no-match' },
    })
    expect(screen.getByText('필터에 맞는 이벤트가 없습니다.')).toBeInTheDocument()
  })

  it('copies an event hash to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              ts: '2026-04-27T10:30:45.123Z',
              actor: 'admin',
              action: 'cache.clear',
              outcome: 'ok',
              hash: 'abcd1234ef5678abcdef',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    renderWithRouter(<AuditLog />)
    await waitFor(() => expect(screen.getByText('cache.clear')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /해시 복사: abcd1234ef5678abcdef/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abcd1234ef5678abcdef'))
  })

  it('verify button calls /audit/verify', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, events: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, verified: true, brokenAt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    renderWithRouter(<AuditLog />)
    // 초기 audit 로드가 끝나면 busy 가 풀려 verify 버튼이 활성화된다 — 그때 클릭.
    const verifyBtn = screen.getByText('체인 검증')
    await waitFor(() => expect(verifyBtn).not.toBeDisabled())
    fireEvent.click(verifyBtn)
    await waitFor(() => expect(screen.getAllByText('무결성 OK').length).toBeGreaterThan(0))
  })
})
