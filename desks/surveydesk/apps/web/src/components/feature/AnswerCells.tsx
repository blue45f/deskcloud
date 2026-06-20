import type { ResponseDto, SurveyQuestion } from '@surveydesk/shared'

/**
 * 응답 단건의 한 질문 답을 사람이 읽는 텍스트로. choice 는 옵션 label 로 치환,
 * rating 은 별, nps 는 숫자, text 는 그대로.
 */
export function formatAnswer(q: SurveyQuestion, raw: unknown): string {
  if (raw == null || raw === '') return '—'
  switch (q.type) {
    case 'rating':
      return typeof raw === 'number' ? `${'★'.repeat(raw)} (${raw})` : String(raw)
    case 'nps':
      return typeof raw === 'number' ? String(raw) : String(raw)
    case 'single_choice': {
      const opt = q.options?.find((o) => o.value === raw)
      return opt?.label ?? String(raw)
    }
    case 'multi_choice': {
      if (!Array.isArray(raw)) return String(raw)
      return raw
        .map((v) => q.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(', ')
    }
    case 'text':
      return String(raw)
    default:
      return String(raw)
  }
}

/** 응답 행의 요약 미리보기(질문 정의 순서대로 짧게). */
export function answerPreview(questions: SurveyQuestion[], answers: ResponseDto['answers']): string {
  const parts: string[] = []
  for (const q of questions) {
    const v = answers[q.id]
    if (v == null || v === '') continue
    const text = formatAnswer(q, v)
    parts.push(`${q.label}: ${text}`)
    if (parts.length >= 3) break
  }
  return parts.length > 0 ? parts.join(' · ') : '응답 없음'
}
