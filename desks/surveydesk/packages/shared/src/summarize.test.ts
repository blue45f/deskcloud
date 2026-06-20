import { describe, expect, it } from 'vitest'

import { summarize, type SummaryInputResponse } from './summarize'

import type { SurveyQuestion } from './schemas'

const questions: SurveyQuestion[] = [
  { id: 'q_rating', type: 'rating', label: '만족도', required: true },
  { id: 'q_nps', type: 'nps', label: '추천 의향', required: true },
  {
    id: 'q_pick',
    type: 'single_choice',
    label: '주 사용 기능',
    required: false,
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ],
  },
  {
    id: 'q_tags',
    type: 'multi_choice',
    label: '좋았던 점',
    required: false,
    options: [
      { value: 'fast', label: '빠름' },
      { value: 'ui', label: 'UI' },
    ],
  },
  { id: 'q_text', type: 'text', label: '한마디', required: false, variant: 'long' },
]

function resp(answers: Record<string, unknown>, createdAt: string): SummaryInputResponse {
  return { answers, createdAt }
}

describe('summarize', () => {
  it('빈 응답이면 0/null 로 안전 집계', () => {
    const s = summarize('demo', 1, questions, [])
    expect(s.responseCount).toBe(0)
    const rating = s.questions.find((q) => q.questionId === 'q_rating')!
    expect(rating.type).toBe('rating')
    if (rating.type === 'rating') {
      expect(rating.count).toBe(0)
      expect(rating.average).toBeNull()
      expect(rating.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
    }
    const nps = s.questions.find((q) => q.questionId === 'q_nps')!
    if (nps.type === 'nps') expect(nps.score).toBeNull()
  })

  it('평균 별점과 분포를 정확히 집계', () => {
    const responses = [
      resp({ q_rating: 5 }, '2026-01-01T00:00:00Z'),
      resp({ q_rating: 4 }, '2026-01-02T00:00:00Z'),
      resp({ q_rating: 3 }, '2026-01-03T00:00:00Z'),
      resp({ q_rating: 5 }, '2026-01-04T00:00:00Z'),
    ]
    const s = summarize('demo', 1, questions, responses)
    const rating = s.questions.find((q) => q.questionId === 'q_rating')!
    if (rating.type === 'rating') {
      expect(rating.count).toBe(4)
      expect(rating.average).toBe(4.25) // (5+4+3+5)/4
      expect(rating.distribution).toEqual({ '1': 0, '2': 0, '3': 1, '4': 1, '5': 2 })
    }
  })

  it('잘못된 별점 값(범위 밖·비정수)은 평균에서 제외', () => {
    const responses = [
      resp({ q_rating: 5 }, '2026-01-01T00:00:00Z'),
      resp({ q_rating: 0 }, '2026-01-02T00:00:00Z'), // 범위 밖
      resp({ q_rating: 4.5 }, '2026-01-03T00:00:00Z'), // 비정수
      resp({ q_rating: 'x' }, '2026-01-04T00:00:00Z'), // 비숫자
      resp({ q_rating: 3 }, '2026-01-05T00:00:00Z'),
    ]
    const s = summarize('demo', 1, questions, responses)
    const rating = s.questions.find((q) => q.questionId === 'q_rating')!
    if (rating.type === 'rating') {
      expect(rating.count).toBe(2) // 5, 3 만 유효
      expect(rating.average).toBe(4) // (5+3)/2
    }
  })

  it('NPS = 추천% − 비추천% (round)', () => {
    // 10명: 추천(9–10) 6명, 중립(7–8) 2명, 비추천(0–6) 2명
    // NPS = 60% − 20% = 40
    const scores = [10, 10, 9, 9, 9, 9, 8, 7, 6, 3]
    const responses = scores.map((n, i) =>
      resp({ q_nps: n }, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
    )
    const s = summarize('demo', 1, questions, responses)
    const nps = s.questions.find((q) => q.questionId === 'q_nps')!
    if (nps.type === 'nps') {
      expect(nps.count).toBe(10)
      expect(nps.promoters).toBe(6)
      expect(nps.passives).toBe(2)
      expect(nps.detractors).toBe(2)
      expect(nps.score).toBe(40)
      expect(nps.average).toBe(8) // (10+10+9+9+9+9+8+7+6+3)/10 = 80/10
    }
  })

  it('NPS 경계: 6=비추천, 7=중립, 9=추천', () => {
    const responses = [
      resp({ q_nps: 6 }, '2026-01-01T00:00:00Z'),
      resp({ q_nps: 7 }, '2026-01-02T00:00:00Z'),
      resp({ q_nps: 8 }, '2026-01-03T00:00:00Z'),
      resp({ q_nps: 9 }, '2026-01-04T00:00:00Z'),
    ]
    const s = summarize('demo', 1, questions, responses)
    const nps = s.questions.find((q) => q.questionId === 'q_nps')!
    if (nps.type === 'nps') {
      expect(nps.detractors).toBe(1) // 6
      expect(nps.passives).toBe(2) // 7,8
      expect(nps.promoters).toBe(1) // 9
      expect(nps.score).toBe(0) // 25% − 25%
    }
  })

  it('single/multi choice 득표를 정의된 보기 순서로 집계', () => {
    const responses = [
      resp({ q_pick: 'a', q_tags: ['fast', 'ui'] }, '2026-01-01T00:00:00Z'),
      resp({ q_pick: 'a', q_tags: ['fast'] }, '2026-01-02T00:00:00Z'),
      resp({ q_pick: 'b', q_tags: [] }, '2026-01-03T00:00:00Z'),
      resp({ q_pick: 'zzz' }, '2026-01-04T00:00:00Z'), // 정의 밖 → 무시
    ]
    const s = summarize('demo', 1, questions, responses)
    const pick = s.questions.find((q) => q.questionId === 'q_pick')!
    if (pick.type === 'single_choice') {
      expect(pick.count).toBe(3) // a,a,b 만 유효 — zzz 는 정의 밖이라 제외
      expect(pick.tallies).toEqual([
        { value: 'a', label: 'A', count: 2 },
        { value: 'b', label: 'B', count: 1 },
        { value: 'c', label: 'C', count: 0 },
      ])
    }
    const tags = s.questions.find((q) => q.questionId === 'q_tags')!
    if (tags.type === 'multi_choice') {
      expect(tags.tallies).toEqual([
        { value: 'fast', label: '빠름', count: 2 },
        { value: 'ui', label: 'UI', count: 1 },
      ])
    }
  })

  it('text 최근 자유서술을 최신순으로, limit 만큼만', () => {
    const responses = [
      resp({ q_text: '오래된' }, '2026-01-01T00:00:00Z'),
      resp({ q_text: '중간' }, '2026-01-05T00:00:00Z'),
      resp({ q_text: '   ' }, '2026-01-06T00:00:00Z'), // 공백 → 제외
      resp({ q_text: '최신' }, '2026-01-10T00:00:00Z'),
    ]
    const s = summarize('demo', 1, questions, responses, { recentTextLimit: 2 })
    const text = s.questions.find((q) => q.questionId === 'q_text')!
    if (text.type === 'text') {
      expect(text.count).toBe(3) // 공백 제외
      expect(text.recent.map((r) => r.value)).toEqual(['최신', '중간'])
    }
  })
})
