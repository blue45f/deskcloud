import { describe, expect, it } from 'vitest'

import { PresenceService } from './presence.service'

const T = 'tenant-a'
const C = 'conv-1'

describe('PresenceService', () => {
  it('멤버 add/remove — 멤버 단위 dedupe(멀티탭은 한 번만 join/leave)', () => {
    const p = new PresenceService()
    expect(p.add(T, C, 'alice', 's1')).toBe(true) // 새 멤버
    expect(p.add(T, C, 'alice', 's2')).toBe(false) // 같은 멤버, 추가 탭
    expect(p.count(T, C)).toBe(1)
    expect(p.members(T, C)).toEqual(['alice'])

    // 탭 하나 닫아도 멤버는 남음
    expect(p.remove(T, C, 'alice', 's1')).toBe(false)
    expect(p.count(T, C)).toBe(1)
    // 마지막 탭 닫으면 멤버 leave
    expect(p.remove(T, C, 'alice', 's2')).toBe(true)
    expect(p.count(T, C)).toBe(0)
  })

  it('여러 멤버 동시 온라인', () => {
    const p = new PresenceService()
    p.add(T, C, 'alice', 's1')
    p.add(T, C, 'bob', 's2')
    expect(p.count(T, C)).toBe(2)
    expect(new Set(p.members(T, C))).toEqual(new Set(['alice', 'bob']))
  })

  it('removeSocket — 연결 종료 시 그 소켓이 참여한 모든 대화에서 제거', () => {
    const p = new PresenceService()
    p.add(T, C, 'alice', 's1')
    p.add(T, 'conv-2', 'alice', 's1')
    const left = p.removeSocket('s1')
    expect(left).toHaveLength(2)
    expect(p.count(T, C)).toBe(0)
    expect(p.count(T, 'conv-2')).toBe(0)
  })

  it('테넌트 격리 — 다른 테넌트의 같은 대화 id 는 별개', () => {
    const p = new PresenceService()
    p.add('t1', C, 'alice', 's1')
    p.add('t2', C, 'bob', 's2')
    expect(p.count('t1', C)).toBe(1)
    expect(p.count('t2', C)).toBe(1)
    expect(p.members('t1', C)).toEqual(['alice'])
  })
})
