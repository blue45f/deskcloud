import { describe, expect, it, vi } from 'vitest'

import {
  createModerationClient,
  ModerationError,
  PlanLimitError,
  type ModerationClient,
} from './client'

import type { ModerateResultDto, ReportListDto, RuleDto } from '@moderationdesk/shared'

/** 지정 status·본문으로 한 번 응답하는 가짜 fetch 와, 호출 기록을 캡처한다. */
function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(body === null ? '' : JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { fn, calls }
}

function client(fetchImpl: typeof fetch): ModerationClient {
  return createModerationClient({
    secretKey: 'sk_test_123',
    endpoint: 'https://md.example.com/',
    fetch: fetchImpl,
  })
}

describe('createModerationClient', () => {
  it('secretKey 없으면 즉시 throw', () => {
    expect(() =>
      // @ts-expect-error — 의도적으로 secretKey 누락
      createModerationClient({ endpoint: 'https://x', fetch: fakeFetch(200, {}).fn })
    ).toThrow(ModerationError)
  })

  it('moderate: x-sk 헤더 + /api/moderate 로 POST', async () => {
    const result: ModerateResultDto = { verdict: 'allow', matchedRules: [], logId: 'log_1' }
    const { fn, calls } = fakeFetch(200, result)
    const out = await client(fn).moderate('hello', { meta: { source: 'comments' } })

    expect(out).toEqual(result)
    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.url).toBe('https://md.example.com/api/moderate')
    expect(call.init.method).toBe('POST')
    const headers = call.init.headers as Record<string, string>
    expect(headers['x-sk']).toBe('sk_test_123')
    const sent = JSON.parse(String(call.init.body)) as Record<string, unknown>
    expect(sent.text).toBe('hello')
    expect(sent.meta).toEqual({ source: 'comments' })
  })

  it('moderate: useAi 미지정이면 본문에서 생략', async () => {
    const { fn, calls } = fakeFetch(200, { verdict: 'allow', matchedRules: [], logId: 'l' })
    await client(fn).moderate('hi')
    const sent = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
    expect('useAi' in sent).toBe(false)
  })

  it('check: verdict 를 allowed/blocked/flagged 로 매핑', async () => {
    const block: ModerateResultDto = {
      verdict: 'block',
      matchedRules: [{ id: 'r1', pattern: 'badword', kind: 'substring', action: 'block' }],
      logId: 'log_2',
    }
    const out = await client(fakeFetch(200, block).fn).check('contains badword')
    expect(out).toMatchObject({ allowed: false, blocked: true, flagged: true, verdict: 'block' })
    expect(out.result).toEqual(block)
  })

  it('check: flag 는 allowed(true)·flagged(true)·blocked(false)', async () => {
    const flag: ModerateResultDto = { verdict: 'flag', matchedRules: [], aiScore: 0.7, logId: 'l3' }
    const out = await client(fakeFetch(200, flag).fn).check('mildly toxic')
    expect(out).toMatchObject({ allowed: true, blocked: false, flagged: true, verdict: 'flag' })
  })

  it('402 는 PlanLimitError 로 던진다', async () => {
    const { fn } = fakeFetch(402, { message: '무료 플랜 한도 초과' })
    await expect(client(fn).moderate('x')).rejects.toBeInstanceOf(PlanLimitError)
  })

  it('비-2xx 는 서버 message 를 ModerationError 로 보존', async () => {
    const { fn } = fakeFetch(401, { message: '유효하지 않은 secret 키입니다' })
    await expect(client(fn).moderate('x')).rejects.toMatchObject({
      name: 'ModerationError',
      status: 401,
      message: '유효하지 않은 secret 키입니다',
    })
  })

  it('createRule 은 /api/admin/rules 로 POST', async () => {
    const rule: RuleDto = {
      id: 'r1',
      tenantId: 't1',
      pattern: 'spam',
      kind: 'substring',
      action: 'flag',
      label: null,
      enabled: true,
      createdAt: '2026-06-15T00:00:00Z',
    }
    const { fn, calls } = fakeFetch(200, rule)
    const out = await client(fn).createRule({
      pattern: 'spam',
      kind: 'substring',
      action: 'flag',
      enabled: true,
    })
    expect(out).toEqual(rule)
    expect(calls[0]!.url).toBe('https://md.example.com/api/admin/rules')
    expect(calls[0]!.init.method).toBe('POST')
  })

  it('listReports 는 쿼리 문자열을 직렬화(빈 값 생략)', async () => {
    const list: ReportListDto = { items: [], total: 0, offset: 0, limit: 20 }
    const { fn, calls } = fakeFetch(200, list)
    await client(fn).listReports({ status: 'open', subjectType: '', limit: 20 })
    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/api/admin/reports')
    expect(url.searchParams.get('status')).toBe('open')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.has('subjectType')).toBe(false)
  })

  it('deleteRule 은 DELETE + id 인코딩', async () => {
    // 204 는 undici Response 가 본문과 함께 거부하므로 200(빈 본문)으로 대체 — 검증 대상은 메서드/URL.
    const { fn, calls } = fakeFetch(200, null)
    await client(fn).deleteRule('a/b')
    expect(calls[0]!.init.method).toBe('DELETE')
    expect(calls[0]!.url).toBe('https://md.example.com/api/admin/rules/a%2Fb')
  })
})
