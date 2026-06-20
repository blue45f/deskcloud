import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_FILE_BYTES } from './constants'
import {
  formatBytes,
  isAllowedContentType,
  normalizeContentType,
  validateUpload,
} from './validate-upload'

describe('normalizeContentType', () => {
  it('파라미터를 제거하고 소문자로 정규화한다', () => {
    expect(normalizeContentType('TEXT/Plain; charset=utf-8')).toBe('text/plain')
    expect(normalizeContentType('  image/PNG  ')).toBe('image/png')
    expect(normalizeContentType(null)).toBe('')
    expect(normalizeContentType(undefined)).toBe('')
  })
})

describe('isAllowedContentType', () => {
  it('정확 매칭을 허용한다', () => {
    expect(isAllowedContentType('application/pdf')).toBe(true)
    expect(isAllowedContentType('application/json')).toBe(true)
  })

  it('image/* 슬래시-스타 패턴을 접두사 매칭한다', () => {
    expect(isAllowedContentType('image/png')).toBe(true)
    expect(isAllowedContentType('image/jpeg')).toBe(true)
    expect(isAllowedContentType('image/svg+xml')).toBe(true)
  })

  it('허용목록에 없는 형식은 거부한다', () => {
    expect(isAllowedContentType('application/x-msdownload')).toBe(false)
    expect(isAllowedContentType('video/mp4')).toBe(false)
    expect(isAllowedContentType('')).toBe(false)
    expect(isAllowedContentType(null)).toBe(false)
  })

  it('커스텀 허용목록을 받는다', () => {
    expect(isAllowedContentType('video/mp4', ['video/*'])).toBe(true)
    expect(isAllowedContentType('image/png', ['video/*'])).toBe(false)
  })
})

describe('validateUpload', () => {
  const ok = { filename: 'photo.png', contentType: 'image/png', sizeBytes: 1024 }

  it('정상 후보는 ok=true 와 정규화된 contentType 을 반환한다', () => {
    const r = validateUpload({ ...ok, contentType: 'image/PNG; charset=binary' })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.contentType).toBe('image/png')
  })

  it('빈 파일명을 거부한다', () => {
    const r = validateUpload({ ...ok, filename: '   ' })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('filename-required')
  })

  it('허용되지 않는 MIME 을 거부한다', () => {
    const r = validateUpload({ ...ok, contentType: 'application/x-msdownload' })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('content-type-not-allowed')
  })

  it('0바이트와 음수/비정수 크기를 거부한다', () => {
    expect(validateUpload({ ...ok, sizeBytes: 0 }).errors).toContain('size-zero')
    expect(validateUpload({ ...ok, sizeBytes: -1 }).errors).toContain('size-invalid')
    expect(validateUpload({ ...ok, sizeBytes: 1.5 }).errors).toContain('size-invalid')
  })

  it('최대 크기 초과를 거부한다(기본 5MB)', () => {
    const r = validateUpload({ ...ok, sizeBytes: DEFAULT_MAX_FILE_BYTES + 1 })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('size-too-large')
  })

  it('커스텀 maxBytes 한도를 적용한다', () => {
    const r = validateUpload({ ...ok, sizeBytes: 2048 }, { maxBytes: 1024 })
    expect(r.errors).toContain('size-too-large')
    expect(validateUpload({ ...ok, sizeBytes: 1024 }, { maxBytes: 1024 }).ok).toBe(true)
  })

  it('여러 위반을 한꺼번에 모은다', () => {
    const r = validateUpload({ filename: '', contentType: 'video/mp4', sizeBytes: 0 })
    expect(r.errors).toEqual(
      expect.arrayContaining(['filename-required', 'content-type-not-allowed', 'size-zero'])
    )
  })
})

describe('formatBytes', () => {
  it('사람이 읽는 단위로 표기한다', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatBytes(-5)).toBe('0 B')
  })
})
