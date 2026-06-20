import { describe, expect, it } from 'vitest'

import { buildPrefMap, resolveChannels } from './preferences'

describe('resolveChannels (선호 게이팅)', () => {
  it('선호 레코드가 없으면 모든 요청 채널을 허용(opt-out 기본)', () => {
    const map = buildPrefMap([])
    const r = resolveChannels(['in_app', 'email', 'web_push'], map, 'order')
    expect(r.allowed).toEqual(['in_app', 'email', 'web_push'])
    expect(r.suppressed).toEqual([])
  })

  it('in_app 은 요청에 없어도 항상 포함되고 맨 앞에 온다', () => {
    const map = buildPrefMap([])
    const r = resolveChannels(['email'], map, 'order')
    expect(r.allowed[0]).toBe('in_app')
    expect(r.allowed).toContain('email')
  })

  it('enabled=false 인 (type,channel) 은 억제한다', () => {
    const map = buildPrefMap([{ type: 'order', channel: 'email', enabled: false }])
    const r = resolveChannels(['in_app', 'email', 'web_push'], map, 'order')
    expect(r.allowed).toEqual(['in_app', 'web_push'])
    expect(r.suppressed).toEqual(['email'])
  })

  it('in_app 은 선호로 끌 수 없다(false 여도 통과)', () => {
    const map = buildPrefMap([{ type: 'order', channel: 'in_app', enabled: false }])
    const r = resolveChannels(['in_app', 'email'], map, 'order')
    expect(r.allowed).toContain('in_app')
    expect(r.suppressed).not.toContain('in_app')
  })

  it('선호는 type 별로 격리된다', () => {
    const map = buildPrefMap([{ type: 'marketing', channel: 'email', enabled: false }])
    // order 타입은 영향 없음
    const r = resolveChannels(['in_app', 'email'], map, 'order')
    expect(r.allowed).toContain('email')
    // marketing 타입은 억제
    const r2 = resolveChannels(['in_app', 'email'], map, 'marketing')
    expect(r2.suppressed).toContain('email')
  })

  it('요청 채널 중복을 제거한다', () => {
    const map = buildPrefMap([])
    const r = resolveChannels(['email', 'email', 'in_app'], map, 'order')
    expect(r.allowed).toEqual(['in_app', 'email'])
  })

  it('enabled=true 는 명시적으로 허용', () => {
    const map = buildPrefMap([{ type: 'order', channel: 'web_push', enabled: true }])
    const r = resolveChannels(['web_push'], map, 'order')
    expect(r.allowed).toContain('web_push')
    expect(r.suppressed).toEqual([])
  })
})
