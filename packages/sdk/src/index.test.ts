import { describe, expect, it, vi } from 'vitest'

import { createTermsDeskClient, TermsDeskError } from './index'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok, status, text: async () => JSON.stringify(body) }) as unknown as Response
  )
}

describe('createTermsDeskClient', () => {
  it('현재 버전 URL 에 subjectRef/locale + Bearer 인증', async () => {
    const fetch = mockFetch({ policySlug: 'terms', contentHash: 'abc' })
    const client = createTermsDeskClient({ baseUrl: 'https://x.test/', apiKey: 'tdk_k', fetch })
    await client.getCurrentPolicy({ policySlug: 'terms', subjectRef: 'u1', locale: 'ko' })

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://x.test/api/v1/policies/terms/current?locale=ko&subjectRef=u1')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tdk_k' })
  })

  it('동의 기록은 기본값(accepted/api)으로 POST', async () => {
    const fetch = mockFetch({ receiptId: 'r1' })
    const client = createTermsDeskClient({ baseUrl: 'https://x.test', apiKey: 'k', fetch })
    await client.recordConsent({ subjectRef: 'u1', policySlug: 'terms' })

    const init = fetch.mock.calls[0]![1]
    expect(JSON.parse(init!.body as string)).toMatchObject({
      subjectRef: 'u1',
      policySlug: 'terms',
      decision: 'accepted',
    })
  })

  it('!ok 응답이면 TermsDeskError', async () => {
    const fetch = mockFetch({ message: '권한 없음' }, false, 403)
    const client = createTermsDeskClient({ baseUrl: 'https://x.test', apiKey: 'k', fetch })
    await expect(client.getCurrentPolicy({ policySlug: 'x' })).rejects.toThrowError(TermsDeskError)
  })
})
