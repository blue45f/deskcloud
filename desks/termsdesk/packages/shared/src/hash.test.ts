import { describe, expect, it } from 'vitest'

import { canonicalizeBody, computeContentHash, shortHash } from './hash'

describe('content hash (게시 불변식)', () => {
  it('CRLF/CR 을 LF 로 정규화', () => {
    expect(canonicalizeBody('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('결정적이며 64자리 16진수', async () => {
    const a = await computeContentHash('약관 본문')
    const b = await computeContentHash('약관 본문')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('본문이 바뀌면 해시가 바뀐다', async () => {
    expect(await computeContentHash('v1')).not.toBe(await computeContentHash('v2'))
  })

  it('줄바꿈 형식 차이만으로는 해시가 바뀌지 않는다', async () => {
    expect(await computeContentHash('a\r\nb')).toBe(await computeContentHash('a\nb'))
  })

  it('shortHash 는 앞 12자', () => {
    expect(shortHash('0123456789abcdef')).toBe('0123456789ab')
  })
})
