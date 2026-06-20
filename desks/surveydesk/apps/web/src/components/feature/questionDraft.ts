import { type QuestionType, type SurveyQuestion } from '@surveydesk/shared'

/** 에디터 내부 표현 — required 기본값을 명시화하고 options 를 항상 배열로. */
export interface DraftQuestion {
  id: string
  type: QuestionType
  label: string
  required: boolean
  variant?: 'short' | 'long'
  options: { value: string; label: string }[]
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  rating: '별점 (1–5)',
  nps: 'NPS (0–10)',
  single_choice: '단일 선택',
  multi_choice: '복수 선택',
  text: '자유서술',
}

export const isChoice = (t: QuestionType): boolean => t === 'single_choice' || t === 'multi_choice'

export function emptyQuestion(idSeed: number): DraftQuestion {
  return {
    id: `q_${idSeed}`,
    type: 'rating',
    label: '',
    required: false,
    options: [],
  }
}

/** SurveyQuestion → DraftQuestion. */
export function toDraft(q: SurveyQuestion): DraftQuestion {
  return {
    id: q.id,
    type: q.type,
    label: q.label,
    required: q.required ?? false,
    variant: q.type === 'text' ? (q.variant ?? 'short') : undefined,
    options: q.options ? q.options.map((o) => ({ ...o })) : [],
  }
}

/** DraftQuestion → SurveyQuestion(서버 입력 형태). */
export function fromDraft(d: DraftQuestion): SurveyQuestion {
  const base: SurveyQuestion = {
    id: d.id.trim(),
    type: d.type,
    label: d.label.trim(),
    required: d.required,
  }
  if (isChoice(d.type))
    base.options = d.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
  if (d.type === 'text') base.variant = d.variant ?? 'short'
  return base
}
