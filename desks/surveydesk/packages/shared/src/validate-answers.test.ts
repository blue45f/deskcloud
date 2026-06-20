import { describe, expect, it } from 'vitest'

import { validateAnswers } from './validate-answers'

import type { SurveyQuestion } from './schemas'

const questions: SurveyQuestion[] = [
  { id: 'q_rating', type: 'rating', label: '만족도', required: true },
  { id: 'q_nps', type: 'nps', label: '추천 의향', required: false },
  {
    id: 'q_pick',
    type: 'single_choice',
    label: '플랜',
    required: true,
    options: [
      { value: 'free', label: '무료' },
      { value: 'pro', label: '프로' },
    ],
  },
  {
    id: 'q_tags',
    type: 'multi_choice',
    label: '관심',
    required: false,
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
  },
  { id: 'q_text', type: 'text', label: '메모', required: false, variant: 'short' },
]

describe('validateAnswers', () => {
  it('유효한 응답을 통과시키고 정규화', () => {
    const r = validateAnswers(questions, {
      q_rating: 4,
      q_nps: 9,
      q_pick: 'pro',
      q_tags: ['a', 'a', 'b'], // 중복 → 정규화
      q_text: '  좋아요  ',
    })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.value.q_rating).toBe(4)
    expect(r.value.q_tags).toEqual(['a', 'b'])
    expect(r.value.q_text).toBe('좋아요') // trim
  })

  it('필수 질문 누락을 에러로 보고', () => {
    const r = validateAnswers(questions, { q_nps: 8 })
    expect(r.ok).toBe(false)
    const ids = r.errors.map((e) => e.questionId)
    expect(ids).toContain('q_rating')
    expect(ids).toContain('q_pick')
    expect(ids).not.toContain('q_nps') // 선택 + 제공됨
  })

  it('rating 범위 밖·비정수를 거부', () => {
    expect(validateAnswers(questions, { q_rating: 0, q_pick: 'free' }).ok).toBe(false)
    expect(validateAnswers(questions, { q_rating: 6, q_pick: 'free' }).ok).toBe(false)
    expect(validateAnswers(questions, { q_rating: 3.5, q_pick: 'free' }).ok).toBe(false)
    expect(validateAnswers(questions, { q_rating: 3, q_pick: 'free' }).ok).toBe(true)
  })

  it('nps 범위 밖을 거부', () => {
    expect(validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_nps: 11 }).ok).toBe(false)
    expect(validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_nps: -1 }).ok).toBe(false)
    expect(validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_nps: 0 }).ok).toBe(true)
  })

  it('정의되지 않은 보기를 거부', () => {
    const single = validateAnswers(questions, { q_rating: 3, q_pick: 'enterprise' })
    expect(single.ok).toBe(false)
    const multi = validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_tags: ['a', 'z'] })
    expect(multi.ok).toBe(false)
  })

  it('정의에 없는 질문 키는 결과에서 제거', () => {
    const r = validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_unknown: 'x' })
    expect(r.ok).toBe(true)
    expect(r.value).not.toHaveProperty('q_unknown')
  })

  it('text 최대 길이를 초과하면 거부', () => {
    const long = 'x'.repeat(281) // short 한도 280
    const r = validateAnswers(questions, { q_rating: 3, q_pick: 'free', q_text: long })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.questionId === 'q_text')).toBe(true)
  })
})
