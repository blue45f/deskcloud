import { describe, expect, it } from 'vitest'

import {
  applyAiScore,
  matchRules,
  strongerVerdict,
  type MatchableRule,
} from './match-rules'

const rule = (over: Partial<MatchableRule> & Pick<MatchableRule, 'id' | 'pattern'>): MatchableRule => ({
  kind: 'substring',
  action: 'block',
  enabled: true,
  ...over,
})

describe('matchRules — kinds', () => {
  it('substring 은 부분 포함이면 매칭(대소문자 무시)', () => {
    const rules = [rule({ id: 'r1', pattern: 'spam', kind: 'substring' })]
    const r = matchRules('This is SPAM, beware', rules)
    expect(r.verdict).toBe('block')
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0]!.id).toBe('r1')
  })

  it('substring 은 포함되지 않으면 allow', () => {
    const rules = [rule({ id: 'r1', pattern: 'spam', kind: 'substring' })]
    expect(matchRules('a clean message', rules).verdict).toBe('allow')
  })

  it('exact 는 텍스트 전체가 trim·소문자 기준 동일할 때만 매칭', () => {
    const rules = [rule({ id: 'r1', pattern: 'banned', kind: 'exact' })]
    expect(matchRules('  BANNED  ', rules).verdict).toBe('block') // trim + 소문자
    expect(matchRules('this is banned text', rules).verdict).toBe('allow') // 부분이라 미매칭
  })

  it('regex 는 정규식(i,u)으로 test', () => {
    const rules = [rule({ id: 'r1', pattern: '\\bf+u+c+k+\\b', kind: 'regex' })]
    expect(matchRules('what the fuuuck', rules).verdict).toBe('block')
    expect(matchRules('duck typing', rules).verdict).toBe('allow')
  })

  it('잘못된 regex 패턴은 throw 하지 않고 매칭 실패(allow)로 안전 처리', () => {
    const rules = [rule({ id: 'r1', pattern: '[unclosed(', kind: 'regex' })]
    expect(() => matchRules('anything', rules)).not.toThrow()
    expect(matchRules('anything', rules).verdict).toBe('allow')
  })

  it('빈 패턴 규칙은 매칭하지 않음', () => {
    const rules = [rule({ id: 'r1', pattern: '', kind: 'substring' })]
    expect(matchRules('whatever', rules).verdict).toBe('allow')
  })
})

describe('matchRules — verdict 우선순위', () => {
  it('비활성(enabled:false) 규칙은 무시', () => {
    const rules = [rule({ id: 'r1', pattern: 'spam', enabled: false })]
    const r = matchRules('spam spam', rules)
    expect(r.verdict).toBe('allow')
    expect(r.matched).toHaveLength(0)
  })

  it('여러 매칭 중 가장 강한 verdict 채택(block > flag > allow)', () => {
    const rules = [
      rule({ id: 'r1', pattern: 'meh', action: 'flag' }),
      rule({ id: 'r2', pattern: 'bad', action: 'block' }),
    ]
    const r = matchRules('meh and bad', rules)
    expect(r.verdict).toBe('block')
    expect(r.matched.map((m) => m.id).sort()).toEqual(['r1', 'r2'])
  })

  it('review 액션은 flag 로 매핑', () => {
    const rules = [rule({ id: 'r1', pattern: 'borderline', action: 'review' })]
    expect(matchRules('borderline content', rules).verdict).toBe('flag')
  })

  it('flag 만 매칭되면 flag, block 없음', () => {
    const rules = [rule({ id: 'r1', pattern: 'iffy', action: 'flag' })]
    expect(matchRules('this is iffy', rules).verdict).toBe('flag')
  })
})

describe('strongerVerdict', () => {
  it('block > flag > allow', () => {
    expect(strongerVerdict('allow', 'flag')).toBe('flag')
    expect(strongerVerdict('flag', 'block')).toBe('block')
    expect(strongerVerdict('block', 'allow')).toBe('block')
    expect(strongerVerdict('allow', 'allow')).toBe('allow')
  })
})

describe('applyAiScore — AI 보조 합성', () => {
  it('aiScore 미존재면 규칙 verdict 그대로', () => {
    expect(applyAiScore('allow', undefined)).toBe('allow')
    expect(applyAiScore('block', undefined)).toBe('block')
  })

  it('임계값 이상이면 최소 flag 로 격상', () => {
    expect(applyAiScore('allow', 0.9)).toBe('flag')
    expect(applyAiScore('allow', 0.5)).toBe('flag') // 경계(>=)
  })

  it('임계값 미만이면 격상하지 않음', () => {
    expect(applyAiScore('allow', 0.49)).toBe('allow')
    expect(applyAiScore('allow', 0.1)).toBe('allow')
  })

  it('AI 는 block 을 만들지 않는다(규칙 block 은 유지, AI 로 새 block 없음)', () => {
    expect(applyAiScore('block', 0.99)).toBe('block') // 유지
    expect(applyAiScore('allow', 0.99)).toBe('flag') // block 아님
  })

  it('사용자 지정 임계값 적용', () => {
    expect(applyAiScore('allow', 0.7, 0.8)).toBe('allow')
    expect(applyAiScore('allow', 0.85, 0.8)).toBe('flag')
  })
})
