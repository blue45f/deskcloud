import { describe, expect, it, vi } from 'vitest'

import { createFileDeskClient, FileDeskError } from './client'

import type { UploadResultDto } from '@filedesk/shared'

const RESULT: UploadResultDto = {
  id: 'f1',
  key: 'abc123',
  url: 'https://api.example.com/api/files/abc123',
  filename: 'hello.txt',
  contentType: 'text/plain',
  sizeBytes: 11,
  visibility: 'public',
}

const PK = 'pk_0123456789abcdef0123456789abcdef'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response): typeof fetch {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(impl(String(input), init))
  ) as unknown as typeof fetch
}

function calls(fn: typeof fetch): Array<[string, RequestInit | undefined]> {
  const m = fn as unknown as { mock: { calls: Array<[unknown, unknown]> } }
  return m.mock.calls.map(([u, i]) => [String(u), i as RequestInit | undefined])
}

// node 환경에는 XMLHttpRequest 가 없어 클라이언트가 fetch 폴백을 쓴다(테스트엔 이상적).
describe('createFileDeskClient.upload (fetch 폴백 경로)', () => {
  it('POST /api/files 로 multipart FormData 를 publishable 헤더와 함께 보낸다', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT, 201))
    const client = createFileDeskClient({
      publishableKey: PK,
      endpoint: 'https://api.example.com/',
      fetch,
    })
    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
    const out = await client.upload(file, { visibility: 'public' })
    expect(out).toEqual(RESULT)

    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://api.example.com/api/files')
    expect(opts?.method).toBe('POST')
    const headers = opts?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${PK}`)
    expect(headers['x-filedesk-widget']).toBeDefined()
    expect(opts?.body).toBeInstanceOf(FormData)
    const form = opts?.body as FormData
    expect(form.get('visibility')).toBe('public')
    expect(form.get('file')).toBeInstanceOf(File)
  })

  it('endpoint 끝 슬래시를 정규화한다', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT))
    const client = createFileDeskClient({ publishableKey: PK, endpoint: 'https://x//', fetch })
    await client.upload(new File(['a'], 'a.txt', { type: 'text/plain' }))
    expect(calls(fetch)[0]![0]).toBe('https://x/api/files')
  })

  it('onProgress 는 완료 시 1 로 호출된다(fetch 폴백)', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT))
    const client = createFileDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    const onProgress = vi.fn()
    await client.upload(new File(['a'], 'a.txt', { type: 'text/plain' }), { onProgress })
    expect(onProgress).toHaveBeenCalledWith(1)
  })

  it('Blob + filename 옵션으로 업로드할 수 있다', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT))
    const client = createFileDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await client.upload(new Blob(['xyz'], { type: 'text/plain' }), { filename: 'blob.txt' })
    const form = calls(fetch)[0]![1]?.body as FormData
    const sent = form.get('file')
    expect(sent).toBeInstanceOf(Blob)
  })

  it('에러 응답은 FileDeskError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'forbidden' }, 403))
    const client = createFileDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await expect(
      client.upload(new File(['a'], 'a.txt', { type: 'text/plain' }))
    ).rejects.toMatchObject({ name: 'FileDeskError', status: 403, message: 'forbidden' })
  })

  it('배열 message(nestjs-zod 스타일)를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: ['size-too-large', 'bad'] }, 413))
    const client = createFileDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await expect(
      client.upload(new File(['a'], 'a.txt', { type: 'text/plain' }))
    ).rejects.toThrow('size-too-large, bad')
  })

  it('FileDeskError 는 Error 인스턴스다', () => {
    expect(new FileDeskError('m', 1)).toBeInstanceOf(Error)
  })
})
