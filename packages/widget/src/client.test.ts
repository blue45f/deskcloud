import { describe, expect, it, vi } from 'vitest'

import {
  createModerationDeskClient,
  ModerationDeskError,
  type ModerationDeskClient,
} from './client'

import type { ModerateResultDto, ReportReceiptDto } from '@moderationdesk/shared'

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(body === null ? '' : JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { fn, calls }
}

function client(fetchImpl: typeof fetch): ModerationDeskClient {
  return createModerationDeskClient({
    publishableKey: 'pk_test_123',
    endpoint: 'https://md.example.com/',
    fetch: fetchImpl,
  })
}

describe('createModerationDeskClient', () => {
  it('publishableKey 없으면 즉시 throw', () => {
    expect(() =>
      // @ts-expect-error — 의도적으로 publishableKey 누락
      createModerationDeskClient({ endpoint: 'https://x', fetch: fakeFetch(200, {}).fn })
    ).toThrow(ModerationDeskError)
  })

  it('submitReport: x-pk 헤더 + /api/reports 로 POST', async () => {
    const receipt: ReportReceiptDto = {
      id: 'rep_1',
      status: 'open',
      createdAt: '2026-06-15T00:00:00Z',
    }
    const { fn, calls } = fakeFetch(201, receipt)
    const out = await client(fn).submitReport({
      subjectType: 'comment',
      subjectId: 'c_1',
      reason: '스팸/광고',
    })

    expect(out).toEqual(receipt)
    const call = calls[0]!
    expect(call.url).toBe('https://md.example.com/api/reports')
    expect(call.init.method).toBe('POST')
    const headers = call.init.headers as Record<string, string>
    expect(headers['x-pk']).toBe('pk_test_123')
    const sent = JSON.parse(String(call.init.body)) as Record<string, unknown>
    expect(sent.subjectType).toBe('comment')
    expect(sent.reason).toBe('스팸/광고')
  })

  it('check: x-pk 헤더 + /api/moderate 로 POST', async () => {
    const result: ModerateResultDto = { verdict: 'flag', matchedRules: [], aiScore: 0.6, logId: 'l' }
    const { fn, calls } = fakeFetch(200, result)
    const out = await client(fn).check('작성 중 댓글', { meta: { source: 'composer' } })

    expect(out).toEqual(result)
    expect(calls[0]!.url).toBe('https://md.example.com/api/moderate')
    const sent = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
    expect(sent.text).toBe('작성 중 댓글')
    expect(sent.meta).toEqual({ source: 'composer' })
  })

  it('비-2xx 는 서버 message 를 ModerationDeskError 로 보존', async () => {
    const { fn } = fakeFetch(403, { message: "Origin '...' 이 허용목록에 없습니다" })
    await expect(
      client(fn).submitReport({ subjectType: 'x', subjectId: 'y', reason: 'z' })
    ).rejects.toMatchObject({ name: 'ModerationDeskError', status: 403 })
  })
})
