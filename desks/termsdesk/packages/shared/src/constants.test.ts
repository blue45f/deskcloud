import { describe, expect, it } from 'vitest'

import { can } from './constants'

describe('RBAC can()', () => {
  it('publisher 는 게시 가능, editor 는 불가', () => {
    expect(can('publisher', 'version.publish')).toBe(true)
    expect(can('editor', 'version.publish')).toBe(false)
  })

  it('viewer 는 읽기 가능, 쓰기 불가', () => {
    expect(can('viewer', 'policy.read')).toBe(true)
    expect(can('viewer', 'policy.write')).toBe(false)
  })

  it('API 키 관리는 owner/admin 만', () => {
    expect(can('owner', 'apikey.manage')).toBe(true)
    expect(can('admin', 'apikey.manage')).toBe(true)
    expect(can('editor', 'apikey.manage')).toBe(false)
  })
})
