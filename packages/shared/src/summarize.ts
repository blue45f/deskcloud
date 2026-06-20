import {
  NPS_DETRACTOR_MAX,
  NPS_PROMOTER_MIN,
  RATING_MAX,
  RATING_MIN,
} from './constants'

import type { SurveyQuestion } from './schemas'

/** 집계 입력 — 응답 1건(answers 맵 + 생성 시각). */
export interface SummaryInputResponse {
  answers: Record<string, unknown>
  createdAt: string | Date
}

/** rating 질문 집계: 평균·분포(별 1–5)·표본 수. */
export interface RatingSummary {
  questionId: string
  label: string
  type: 'rating'
  count: number
  /** 평균(소수 둘째 자리 반올림). 표본 0이면 null. */
  average: number | null
  /** 별점별 응답 수 { '1': n, ... '5': n }. */
  distribution: Record<string, number>
}

/** nps 질문 집계: NPS 점수(추천%−비추천%)·구성·평균. */
export interface NpsSummary {
  questionId: string
  label: string
  type: 'nps'
  count: number
  promoters: number
  passives: number
  detractors: number
  /** NPS = round(promoters% − detractors%), 범위 −100..100. 표본 0이면 null. */
  score: number | null
  /** 0–10 평균(소수 둘째 자리). 표본 0이면 null. */
  average: number | null
}

/** choice 질문 집계: 보기별 득표(정의된 보기 순서 유지). */
export interface ChoiceSummary {
  questionId: string
  label: string
  type: 'single_choice' | 'multi_choice'
  count: number
  tallies: { value: string; label: string; count: number }[]
}

/** text 질문 집계: 응답 수 + 최근 자유서술(최신순, 상한 limit). */
export interface TextSummary {
  questionId: string
  label: string
  type: 'text'
  count: number
  recent: { value: string; createdAt: string }[]
}

export type QuestionSummary = RatingSummary | NpsSummary | ChoiceSummary | TextSummary

export interface SurveySummary {
  appId: string
  surveyVersion: number
  /** 집계 대상(이 버전) 응답 총수. */
  responseCount: number
  questions: QuestionSummary[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toIso(d: string | Date): string {
  return typeof d === 'string' ? d : d.toISOString()
}

export interface SummarizeOptions {
  /** text 질문당 보여줄 최근 자유서술 개수(기본 10). */
  recentTextLimit?: number
}

/**
 * 응답 집합을 활성 설문의 질문 정의 기준으로 집계한다(순수 함수).
 *
 * - rating: 평균 + 별점 분포
 * - nps: 추천/중립/비추천 분류 후 NPS = round(추천% − 비추천%)
 * - single/multi_choice: 정의된 보기 순서대로 득표
 * - text: 응답 수 + 최근 자유서술(최신순)
 *
 * api(요약 엔드포인트)·web(대시보드)·테스트가 공유한다.
 */
export function summarize(
  appId: string,
  surveyVersion: number,
  questions: SurveyQuestion[],
  responses: SummaryInputResponse[],
  opts: SummarizeOptions = {}
): SurveySummary {
  const recentTextLimit = opts.recentTextLimit ?? 10

  const summaries: QuestionSummary[] = questions.map((q) => {
    switch (q.type) {
      case 'rating': {
        const distribution: Record<string, number> = {}
        for (let s = RATING_MIN; s <= RATING_MAX; s += 1) distribution[String(s)] = 0
        let sum = 0
        let count = 0
        for (const r of responses) {
          const v = r.answers[q.id]
          if (typeof v === 'number' && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX) {
            distribution[String(v)] = (distribution[String(v)] ?? 0) + 1
            sum += v
            count += 1
          }
        }
        return {
          questionId: q.id,
          label: q.label,
          type: 'rating',
          count,
          average: count > 0 ? round2(sum / count) : null,
          distribution,
        }
      }
      case 'nps': {
        let promoters = 0
        let passives = 0
        let detractors = 0
        let sum = 0
        let count = 0
        for (const r of responses) {
          const v = r.answers[q.id]
          if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10) {
            if (v <= NPS_DETRACTOR_MAX) detractors += 1
            else if (v >= NPS_PROMOTER_MIN) promoters += 1
            else passives += 1
            sum += v
            count += 1
          }
        }
        const score =
          count > 0 ? Math.round((promoters / count) * 100 - (detractors / count) * 100) : null
        return {
          questionId: q.id,
          label: q.label,
          type: 'nps',
          count,
          promoters,
          passives,
          detractors,
          score,
          average: count > 0 ? round2(sum / count) : null,
        }
      }
      case 'single_choice':
      case 'multi_choice': {
        const counts = new Map<string, number>()
        for (const o of q.options ?? []) counts.set(o.value, 0)
        let count = 0
        for (const r of responses) {
          const v = r.answers[q.id]
          const picks: string[] =
            q.type === 'single_choice'
              ? typeof v === 'string'
                ? [v]
                : []
              : Array.isArray(v)
                ? v.filter((x): x is string => typeof x === 'string')
                : []
          const valid = picks.filter((p) => counts.has(p))
          if (valid.length === 0) continue
          count += 1
          for (const p of valid) counts.set(p, (counts.get(p) ?? 0) + 1)
        }
        return {
          questionId: q.id,
          label: q.label,
          type: q.type,
          count,
          tallies: (q.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
            count: counts.get(o.value) ?? 0,
          })),
        }
      }
      case 'text': {
        const withText: { value: string; createdAt: string }[] = []
        for (const r of responses) {
          const v = r.answers[q.id]
          if (typeof v === 'string' && v.trim().length > 0) {
            withText.push({ value: v, createdAt: toIso(r.createdAt) })
          }
        }
        withText.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        return {
          questionId: q.id,
          label: q.label,
          type: 'text',
          count: withText.length,
          recent: withText.slice(0, recentTextLimit),
        }
      }
      default: {
        // 도달 불가 — 타입 안전.
        return {
          questionId: q.id,
          label: q.label,
          type: 'text',
          count: 0,
          recent: [],
        }
      }
    }
  })

  return {
    appId,
    surveyVersion,
    responseCount: responses.length,
    questions: summaries,
  }
}
