import { describe, expect, it } from 'vitest'

import { dmKey } from './dm-key'

describe('dmKey', () => {
  it('멤버 순서와 무관하게 같은 키(쌍 dedupe)', () => {
    expect(dmKey(['alice', 'bob'])).toBe(dmKey(['bob', 'alice']))
  })

  it('서로 다른 쌍은 다른 키', () => {
    expect(dmKey(['alice', 'bob'])).not.toBe(dmKey(['alice', 'carol']))
  })

  it('중복 멤버는 합쳐짐(자기 자신과의 DM 허용)', () => {
    expect(dmKey(['alice', 'alice'])).toBe(dmKey(['alice']))
  })

  it('구분자가 포함된 멤버 id 도 충돌하지 않게 이스케이프', () => {
    // 'a|b' + 'c'  vs  'a' + 'b|c' — 순진하게 join 하면 같은 문자열이 될 수 있다.
    expect(dmKey(['a|b', 'c'])).not.toBe(dmKey(['a', 'b|c']))
  })

  it('3명 이상은 DM 이 아님(throw)', () => {
    expect(() => dmKey(['a', 'b', 'c'])).toThrow()
  })
})
