import { summarize, type SurveyQuestion } from '@surveydesk/shared'
import { describe, expect, it } from 'vitest'

import {
  choiceQuestions,
  formatNpsScore,
  headlineNps,
  headlineRating,
  npsTone,
  ratingRows,
  summaryShareText,
  textQuestions,
} from './summary'

const QUESTIONS: SurveyQuestion[] = [
  { id: 'r', type: 'rating', label: '만족도', required: true },
  { id: 'n', type: 'nps', label: '추천', required: true },
  {
    id: 'c',
    type: 'single_choice',
    label: '용도',
    required: false,
    options: [
      { value: 'a', label: '개인' },
      { value: 'b', label: '팀' },
    ],
  },
  { id: 't', type: 'text', label: '한마디', required: false },
]

const summary = summarize('demo', 1, QUESTIONS, [
  { answers: { r: 5, n: 10, c: 'a', t: '좋아요' }, createdAt: '2026-06-10T00:00:00.000Z' },
  { answers: { r: 4, n: 9, c: 'b' }, createdAt: '2026-06-11T00:00:00.000Z' },
  { answers: { r: 3, n: 4, c: 'a', t: '아쉬워요' }, createdAt: '2026-06-12T00:00:00.000Z' },
])

describe('summary 타입별 추출 헬퍼', () => {
  it('headlineRating 은 첫 rating 질문을 반환한다', () => {
    expect(headlineRating(summary)?.questionId).toBe('r')
    expect(headlineRating(summary)?.average).toBe(4)
  })

  it('headlineNps 는 첫 nps 질문을 반환한다', () => {
    const nps = headlineNps(summary)
    expect(nps?.questionId).toBe('n')
    // 추천 2(9,10), 비추천 1(4) → round(66.67 - 33.33) = 33
    expect(nps?.score).toBe(33)
  })

  it('choiceQuestions·textQuestions 가 타입을 좁힌다', () => {
    expect(choiceQuestions(summary).map((q) => q.questionId)).toEqual(['c'])
    expect(textQuestions(summary).map((q) => q.questionId)).toEqual(['t'])
    expect(textQuestions(summary)[0]?.recent).toHaveLength(2)
  })

  it('ratingRows 는 5→1 순서의 5행을 만든다', () => {
    const rows = ratingRows(headlineRating(summary)!)
    expect(rows).toHaveLength(5)
    expect(rows[0]?.count).toBe(1) // 5점 1건
    expect(rows[1]?.count).toBe(1) // 4점 1건
    expect(rows[2]?.count).toBe(1) // 3점 1건
  })
})

describe('npsTone', () => {
  it('점수 구간별 톤을 반환한다', () => {
    expect(npsTone(null)).toBe('neutral')
    expect(npsTone(50)).toBe('success')
    expect(npsTone(10)).toBe('warning')
    expect(npsTone(-20)).toBe('danger')
  })
})

describe('formatNpsScore', () => {
  it('양수는 +, 음수는 그대로, null 은 대시', () => {
    expect(formatNpsScore(33)).toBe('+33')
    expect(formatNpsScore(-5)).toBe('-5')
    expect(formatNpsScore(0)).toBe('0')
    expect(formatNpsScore(null)).toBe('—')
  })
})

describe('summaryShareText', () => {
  it('appId 와 핵심 지표를 한 줄로 요약한다', () => {
    const text = summaryShareText('demo', summary)
    expect(text).toContain('[demo]')
    expect(text).toContain(`응답 ${summary.responseCount}`)
    expect(text).toContain('평균 별점 4.00/5')
    expect(text).toContain('NPS +33')
  })

  it('지표가 없으면 해당 항목을 생략한다', () => {
    const empty = { ...summary, questions: [] }
    const text = summaryShareText('x', empty)
    expect(text).toContain('응답')
    expect(text).not.toContain('별점')
    expect(text).not.toContain('NPS')
  })
})
