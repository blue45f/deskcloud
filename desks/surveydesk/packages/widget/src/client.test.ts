import { describe, expect, it, vi } from 'vitest'

import {
  createSurveyDeskClient,
  NoActiveSurveyError,
  SurveyDeskError,
} from './client'

import type { ResponseReceiptDto, SurveyDto } from '@surveydesk/shared'

const SURVEY: SurveyDto = {
  appId: 'demo',
  version: 1,
  title: '데모',
  intro: null,
  questions: [{ id: 'q_rating', type: 'rating', label: '만족도', required: true }],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** fetch 시그니처(url, init)를 갖는 타입드 mock — mock.calls 가 [string|..., RequestInit?] 튜플이 된다. */
function mockFetch(impl: (url: string, init?: RequestInit) => Response): typeof fetch {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(impl(String(input), init))
  ) as unknown as typeof fetch
}

/** mock.calls 접근 헬퍼 — vitest Mock 으로 캐스팅해 인자 튜플 타입을 얻는다. */
function calls(fn: typeof fetch): Array<[string, RequestInit | undefined]> {
  const m = fn as unknown as { mock: { calls: Array<[unknown, unknown]> } }
  return m.mock.calls.map(([u, i]) => [String(u), i as RequestInit | undefined])
}

describe('createSurveyDeskClient', () => {
  it('GET /active 의 URL·헤더를 올바르게 구성한다', async () => {
    const fetch = mockFetch(() => jsonResponse(SURVEY))
    const client = createSurveyDeskClient({
      appId: 'demo',
      endpoint: 'https://api.example.com/',
      apiToken: 'tok',
      fetch,
    })
    const result = await client.getActiveSurvey()
    expect(result).toEqual(SURVEY)
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://api.example.com/api/surveys/demo/active')
    const headers = opts?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer tok')
    expect(headers['x-surveydesk-widget']).toBeDefined()
  })

  it('apiToken 미지정 시 Authorization 헤더를 보내지 않는다', async () => {
    const fetch = mockFetch(() => jsonResponse(SURVEY))
    const client = createSurveyDeskClient({ appId: 'demo', endpoint: 'https://x', fetch })
    await client.getActiveSurvey()
    const headers = calls(fetch)[0]![1]?.headers as Record<string, string>
    expect(headers.authorization).toBeUndefined()
  })

  it('404 는 NoActiveSurveyError 로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'not found' }, 404))
    const client = createSurveyDeskClient({ appId: 'gone', endpoint: 'https://x', fetch })
    await expect(client.getActiveSurvey()).rejects.toBeInstanceOf(NoActiveSurveyError)
  })

  it('기타 에러는 SurveyDeskError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'boom' }, 500))
    const client = createSurveyDeskClient({ appId: 'demo', endpoint: 'https://x', fetch })
    await expect(client.getActiveSurvey()).rejects.toMatchObject({
      name: 'SurveyDeskError',
      status: 500,
      message: 'boom',
    })
  })

  it('배열 message(nestjs-zod) 를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: ['a', 'b'] }, 400))
    const client = createSurveyDeskClient({ appId: 'demo', endpoint: 'https://x', fetch })
    await expect(client.getActiveSurvey()).rejects.toThrow('a, b')
  })

  it('POST /responses 는 body 를 직렬화하고 영수증을 반환한다', async () => {
    const receipt: ResponseReceiptDto = {
      id: 'r1',
      appId: 'demo',
      surveyVersion: 1,
      createdAt: '2026-01-02T00:00:00.000Z',
    }
    const fetch = mockFetch(() => jsonResponse(receipt, 201))
    const client = createSurveyDeskClient({ appId: 'demo', endpoint: 'https://x', fetch })
    const out = await client.submitResponse({ answers: { q_rating: 5 } })
    expect(out).toEqual(receipt)
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://x/api/surveys/demo/responses')
    expect(opts?.method).toBe('POST')
    expect(JSON.parse(opts?.body as string)).toEqual({ answers: { q_rating: 5 } })
  })

  it('appId 를 URL 인코딩한다', async () => {
    const fetch = mockFetch(() => jsonResponse(SURVEY))
    const client = createSurveyDeskClient({ appId: 'a b', endpoint: 'https://x', fetch })
    await client.getActiveSurvey()
    expect(calls(fetch)[0]![0]).toBe('https://x/api/surveys/a%20b/active')
  })

  it('NoActiveSurveyError·SurveyDeskError 는 Error 인스턴스다', () => {
    expect(new NoActiveSurveyError('x')).toBeInstanceOf(Error)
    expect(new SurveyDeskError('m', 1)).toBeInstanceOf(Error)
  })
})
