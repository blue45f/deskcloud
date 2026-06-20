import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DialogHost } from '../../components/DialogHost'
import { useDialogStore } from '../../lib/dialog'
import { useStore } from '../../lib/store'
import { Sites } from '../../pages/Sites'
import { renderWithRouter, resetStore } from '../test-utils'

import type { Site } from '../../lib/types'

const originalFetch = globalThis.fetch

const SITES: Site[] = [
  {
    id: 'docs',
    name: 'Docs',
    origin: 'https://docs.example.com',
    routes: [{ pattern: '^/$', ttlMs: 3600000 }],
    enabled: true,
  },
  {
    id: 'blog',
    name: 'Blog',
    origin: 'https://blog.example.com',
    routes: [],
    enabled: false,
  },
]

beforeEach(() => {
  resetStore()
  useDialogStore.setState({ request: null })
  useStore.setState({ authed: true, adminEnabled: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('Sites page (CMS)', () => {
  it('lists sites with origin/routes count and enabled pill', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<Sites />)
    await waitFor(() => expect(screen.getByText('docs')).toBeInTheDocument())
    expect(screen.getByText('Blog')).toBeInTheDocument()
    expect(screen.getAllByText('ON').length).toBeGreaterThan(0)
    expect(screen.getAllByText('OFF').length).toBeGreaterThan(0)
  })

  it('shows an at-a-glance summary with total / enabled / routes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<Sites />)
    const summary = await screen.findByTestId('list-summary')
    // total 2, enabled 1, routes 1 (docs has 1, blog has 0)
    expect(within(summary).getByText('총')).toBeInTheDocument()
    expect(within(summary).getByText('라우트')).toBeInTheDocument()
    expect(within(summary).getByText('2')).toBeInTheDocument()
  })

  it('filters the list by id / name / origin', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const user = userEvent.setup()
    renderWithRouter(<Sites />)
    await waitFor(() => expect(screen.getByText('docs')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText('ID / 이름 / origin 필터...'), 'blog')
    expect(screen.getByText('Blog')).toBeInTheDocument()
    expect(screen.queryByText('Docs')).not.toBeInTheDocument()
  })

  it('shows a filter-empty message when nothing matches', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const user = userEvent.setup()
    renderWithRouter(<Sites />)
    await waitFor(() => expect(screen.getByText('docs')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText('ID / 이름 / origin 필터...'), 'nope-zzz')
    expect(screen.getByText('필터와 일치하는 사이트가 없습니다.')).toBeInTheDocument()
  })

  it('empty state offers a create-first CTA that opens the form', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const user = userEvent.setup()
    renderWithRouter(<Sites />)
    const cta = await screen.findByRole('button', { name: '첫 사이트 추가' })
    await user.click(cta)
    expect(await screen.findByTestId('site-form')).toBeInTheDocument()
  })

  it('opens add modal with empty form', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<Sites />)
    await waitFor(() => screen.getByText(/사이트가 없습니다/))
    fireEvent.click(screen.getByText('+ 새 사이트'))
    expect(screen.getByTestId('site-form')).toBeInTheDocument()
  })

  it('POSTs to /admin/api/sites on save', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sites: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, site: { id: 'new' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    const user = userEvent.setup()

    renderWithRouter(<Sites />)
    await waitFor(() => screen.getByText('+ 새 사이트'))
    await user.click(screen.getByText('+ 새 사이트'))

    const form = screen.getByTestId('site-form') as HTMLFormElement
    const inputs = form.querySelectorAll('input')
    await user.type(inputs[0]!, 'shop')
    await user.type(inputs[1]!, 'Shop')
    await user.type(inputs[2]!, 'https://shop.example.com')

    fireEvent.submit(form)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string)
    expect(body.id).toBe('shop')
    expect(body.origin).toBe('https://shop.example.com')
  })

  it('delete opens the in-app confirm dialog; cancel issues no DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    renderWithRouter(
      <>
        <Sites />
        <DialogHost />
      </>
    )
    await waitFor(() => expect(screen.getByText('docs')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('삭제')[0]!)
    const dialog = await screen.findByTestId('app-dialog')
    expect(screen.getByText('사이트를 삭제할까요?')).toBeInTheDocument()
    expect(within(dialog).getByTestId('dialog-confirm').className).toContain('btn-danger')
    fireEvent.click(within(dialog).getByText('취소'))
    await waitFor(() => expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument())
    const deleteCalls = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'DELETE'
    )
    expect(deleteCalls).toHaveLength(0)
  })

  it('invalidate opens the in-app prompt dialog and POSTs the entered URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: SITES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    renderWithRouter(
      <>
        <Sites />
        <DialogHost />
      </>
    )
    await waitFor(() => expect(screen.getByText('docs')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('URL 무효화')[0]!)
    const dialog = await screen.findByTestId('app-dialog')
    fireEvent.change(within(dialog).getByTestId('dialog-prompt-input'), {
      target: { value: 'https://docs.example.com/page' },
    })
    fireEvent.click(within(dialog).getByTestId('dialog-confirm'))
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => String(c[0]).includes('/cache/invalidate'))
      expect(post).toBeDefined()
      const body = JSON.parse(((post?.[1] as RequestInit).body as string) ?? '{}')
      expect(body.url).toBe('https://docs.example.com/page')
    })
  })
})
