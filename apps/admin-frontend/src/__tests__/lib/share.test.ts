import { afterEach, describe, expect, it, vi } from 'vitest'

import { shareOrCopy } from '../../lib/share'

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function setNav(prop: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, prop, { configurable: true, value })
}

function restore(prop: 'share' | 'clipboard', desc: PropertyDescriptor | undefined) {
  if (desc) Object.defineProperty(navigator, prop, desc)
  else Object.defineProperty(navigator, prop, { configurable: true, value: undefined })
}

afterEach(() => {
  restore('share', originalShare)
  restore('clipboard', originalClipboard)
  vi.restoreAllMocks()
})

describe('shareOrCopy', () => {
  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNav('share', share)
    setNav('clipboard', undefined)
    const result = await shareOrCopy({ title: 'T', text: 'body', url: 'https://x/' })
    expect(result).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'body', url: 'https://x/' })
  })

  it('treats an aborted share sheet as dismissed', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('user cancelled', 'AbortError'))
    setNav('share', share)
    setNav('clipboard', undefined)
    const result = await shareOrCopy({ url: 'https://x/' })
    expect(result).toBe('dismissed')
  })

  it('falls back to clipboard when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setNav('share', undefined)
    setNav('clipboard', { writeText })
    const result = await shareOrCopy({ title: 'T', url: 'https://x/' })
    expect(result).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('T — https://x/')
  })
})
