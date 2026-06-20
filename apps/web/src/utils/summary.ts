import type {
  ChoiceSummary,
  NpsSummary,
  QuestionSummary,
  RatingSummary,
  SurveySummary,
  TextSummary,
} from '@surveydesk/shared'

/** 타입별 질문 집계를 좁혀 꺼내는 헬퍼들. */
export const ratingQuestions = (s: SurveySummary): RatingSummary[] =>
  s.questions.filter((q): q is RatingSummary => q.type === 'rating')

export const npsQuestions = (s: SurveySummary): NpsSummary[] =>
  s.questions.filter((q): q is NpsSummary => q.type === 'nps')

export const choiceQuestions = (s: SurveySummary): ChoiceSummary[] =>
  s.questions.filter(
    (q): q is ChoiceSummary => q.type === 'single_choice' || q.type === 'multi_choice'
  )

export const textQuestions = (s: SurveySummary): TextSummary[] =>
  s.questions.filter((q): q is TextSummary => q.type === 'text')

/** 대표 평균 별점 — 첫 rating 질문(없으면 null). */
export function headlineRating(s: SurveySummary): RatingSummary | null {
  return ratingQuestions(s)[0] ?? null
}

/** 대표 NPS — 첫 nps 질문(없으면 null). */
export function headlineNps(s: SurveySummary): NpsSummary | null {
  return npsQuestions(s)[0] ?? null
}

/** NPS 점수 색 톤(추천 양수=success, 음수=danger). */
export function npsTone(score: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (score == null) return 'neutral'
  if (score >= 30) return 'success'
  if (score >= 0) return 'warning'
  return 'danger'
}

/** 별점 분포를 5→1 순서의 MiniBar 행으로. */
export function ratingRows(r: RatingSummary): { label: string; count: number }[] {
  return [5, 4, 3, 2, 1].map((star) => ({
    label: `${'★'.repeat(star)}${'☆'.repeat(5 - star)}`,
    count: r.distribution[String(star)] ?? 0,
  }))
}

/** 질문 요약에서 자유서술 응답이 하나라도 있는지. */
export function hasAnyText(items: TextSummary[]): boolean {
  return items.some((t) => t.recent.length > 0)
}

/** NPS 점수를 `+33`/`-5`/`—` 형태의 사람이 읽는 문자열로. */
export function formatNpsScore(score: number | null | undefined): string {
  if (score == null) return '—'
  return score > 0 ? `+${score}` : String(score)
}

/**
 * 집계 한눈 요약을 한 줄(공유/복사용) 텍스트로. 예:
 * `[demo] 응답 128 · 평균 별점 4.32/5 · NPS +41`.
 * 해당 지표가 없으면 그 항목은 생략한다.
 */
export function summaryShareText(appId: string, s: SurveySummary): string {
  const parts = [`응답 ${s.responseCount}`]
  const rating = headlineRating(s)
  if (rating?.average != null) parts.push(`평균 별점 ${rating.average.toFixed(2)}/5`)
  const nps = headlineNps(s)
  if (nps?.score != null) parts.push(`NPS ${formatNpsScore(nps.score)}`)
  return `[${appId}] ${parts.join(' · ')}`
}

/** 질문 타입별 사람이 읽는 이름. */
export function questionTypeLabel(q: QuestionSummary): string {
  switch (q.type) {
    case 'rating':
      return '별점'
    case 'nps':
      return 'NPS'
    case 'single_choice':
      return '단일 선택'
    case 'multi_choice':
      return '복수 선택'
    case 'text':
      return '자유서술'
    default:
      return ''
  }
}
