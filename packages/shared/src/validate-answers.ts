import { NPS_MAX, NPS_MIN, RATING_MAX, RATING_MIN, TEXT_MAX } from './constants'

import type { SurveyQuestion } from './schemas'

export interface AnswerError {
  questionId: string
  message: string
}

export interface ValidateAnswersResult {
  ok: boolean
  errors: AnswerError[]
  /** 검증·정규화를 통과한 answers(알 수 없는 질문 키는 제거). */
  value: Record<string, unknown>
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function isEmpty(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

/**
 * 제출된 answers 를 활성 설문의 질문 정의 기준으로 검증·정규화한다.
 * - 필수 질문 누락 검사
 * - 타입별 범위/형태 검사(rating 1–5·nps 0–10·choice 는 정의된 value 만·text 길이)
 * - 정의에 없는 질문 키는 결과 value 에서 제거(무시)
 *
 * 순수 함수 — api(검증)·web(즉시 피드백)·테스트에서 공유한다.
 */
export function validateAnswers(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): ValidateAnswersResult {
  const errors: AnswerError[] = []
  const value: Record<string, unknown> = {}

  for (const q of questions) {
    const raw = answers[q.id]
    const provided = !isEmpty(raw)

    if (!provided) {
      if (q.required) errors.push({ questionId: q.id, message: '필수 항목입니다' })
      continue
    }

    switch (q.type) {
      case 'rating': {
        if (!isInt(raw) || raw < RATING_MIN || raw > RATING_MAX) {
          errors.push({ questionId: q.id, message: `별점은 ${RATING_MIN}–${RATING_MAX} 정수여야 합니다` })
        } else {
          value[q.id] = raw
        }
        break
      }
      case 'nps': {
        if (!isInt(raw) || raw < NPS_MIN || raw > NPS_MAX) {
          errors.push({ questionId: q.id, message: `NPS는 ${NPS_MIN}–${NPS_MAX} 정수여야 합니다` })
        } else {
          value[q.id] = raw
        }
        break
      }
      case 'single_choice': {
        const allowed = new Set((q.options ?? []).map((o) => o.value))
        if (typeof raw !== 'string' || !allowed.has(raw)) {
          errors.push({ questionId: q.id, message: '정의된 보기 중 하나여야 합니다' })
        } else {
          value[q.id] = raw
        }
        break
      }
      case 'multi_choice': {
        const allowed = new Set((q.options ?? []).map((o) => o.value))
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !allowed.has(v))) {
          errors.push({ questionId: q.id, message: '정의된 보기들 중에서만 선택할 수 있습니다' })
        } else {
          // 중복 제거(정규화)
          value[q.id] = [...new Set(raw as string[])]
        }
        break
      }
      case 'text': {
        const max = TEXT_MAX[q.variant ?? 'short']
        if (typeof raw !== 'string') {
          errors.push({ questionId: q.id, message: '문자열이어야 합니다' })
        } else if (raw.length > max) {
          errors.push({ questionId: q.id, message: `${max}자 이내로 입력해 주세요` })
        } else {
          value[q.id] = raw.trim()
        }
        break
      }
      default: {
        // 도달 불가(타입 안전) — 알 수 없는 타입은 무시.
        break
      }
    }
  }

  return { ok: errors.length === 0, errors, value }
}
