import { RATING_MAX, RATING_MIN } from './constants'

/** 집계 입력 — 리뷰 1건에서 집계에 필요한 최소 정보(별점만). */
export interface AggregateInputReview {
  rating: number
}

/** subject(또는 테넌트 전체) 별점 집계 결과. */
export interface ReviewAggregate {
  /** 집계 대상 리뷰 수(유효 별점만 카운트). */
  count: number
  /** 평균 별점(소수 둘째 자리 반올림). 표본 0이면 null. */
  avgRating: number | null
  /** 별점별 응답 수 { '1': n, ... '5': n }. */
  distribution: Record<string, number>
  /**
   * NPS 스타일 만족도 점수 — 추천(4–5)% − 비추천(1–2)%, 범위 −100..100.
   * 5점 척도를 추천/중립/비추천으로 매핑한 보조 지표. 표본 0이면 null.
   */
  satisfaction: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const isValidRating = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX

/** 빈 분포 { '1':0 .. '5':0 }. */
function emptyDistribution(): Record<string, number> {
  const d: Record<string, number> = {}
  for (let s = RATING_MIN; s <= RATING_MAX; s += 1) d[String(s)] = 0
  return d
}

/**
 * 리뷰 집합의 별점 집계(순수 함수). 범위 밖/비정수 별점은 무시한다.
 *
 * - count: 유효 별점 수
 * - avgRating: 평균(소수 둘째 자리)
 * - distribution: 별 1–5 분포
 * - satisfaction: 추천(4,5)% − 비추천(1,2)% (NPS 스타일, 5점 척도 매핑)
 *
 * api(공개 집계·배지)·web(대시보드)·widget(요약 표시)·테스트가 공유한다.
 */
export function aggregateReviews(reviews: readonly AggregateInputReview[]): ReviewAggregate {
  const distribution = emptyDistribution()
  let sum = 0
  let count = 0
  let promoters = 0
  let detractors = 0

  for (const r of reviews) {
    const v = r.rating
    if (!isValidRating(v)) continue
    distribution[String(v)] = (distribution[String(v)] ?? 0) + 1
    sum += v
    count += 1
    if (v >= 4) promoters += 1
    else if (v <= 2) detractors += 1
  }

  return {
    count,
    avgRating: count > 0 ? round2(sum / count) : null,
    distribution,
    satisfaction:
      count > 0 ? Math.round((promoters / count) * 100 - (detractors / count) * 100) : null,
  }
}
