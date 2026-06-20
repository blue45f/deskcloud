import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText, shareOrCopy } from './shareOrCopy'

// jsdom 없이(node 환경) navigator 를 vi.stubGlobal 로 교체해 분기별 결과를 검증한다.
// navigator 는 getter-only 글로벌이라 직접 대입 대신 stubGlobal 을 써야 한다.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('navigator.clipboard.writeText 가 있으면 그걸로 복사하고 true 를 반환한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('pk_demo')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('pk_demo')
  })

  it('clipboard 도 document 도 없으면 false 를 반환한다(throw 없음)', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', undefined)
    await expect(copyText('x')).resolves.toBe(false)
  })
})

describe('shareOrCopy', () => {
  it('navigator 가 없으면(SSR) unsupported 를 반환한다', async () => {
    vi.stubGlobal('navigator', undefined)
    await expect(shareOrCopy({ url: 'https://addesk.example' })).resolves.toBe('unsupported')
  })

  it('navigator.share 성공 시 shared 를 반환한다', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    await expect(shareOrCopy({ title: 'AdDesk', url: 'https://addesk.example' })).resolves.toBe(
      'shared'
    )
    expect(share).toHaveBeenCalled()
  })

  it('사용자가 공유 시트를 닫으면(AbortError) dismissed 를 반환한다', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    vi.stubGlobal('navigator', { share })
    await expect(shareOrCopy({ url: 'https://addesk.example' })).resolves.toBe('dismissed')
  })

  it('share 미지원이면 클립보드로 폴백해 copied 를 반환한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(shareOrCopy({ url: 'https://addesk.example' })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalled()
  })
})
