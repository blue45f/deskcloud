/**
 * 단일 질문 렌더러 — 타입별로 접근성 있는 입력을 그린다.
 *  - rating: radiogroup(별점, 화살표 이동)
 *  - nps: 0–10 토글 버튼 그룹(aria-pressed)
 *  - single_choice: radio
 *  - multi_choice: checkbox
 *  - text: input / textarea(variant)
 *
 * 상태 비저장(controlled) — 값/변경 핸들러는 폼이 소유. 검증 에러는 errorId 로 연결.
 */
import { NPS_MAX, NPS_MIN, RATING_MAX, RATING_MIN, TEXT_MAX } from '@surveydesk/shared'
import { useId, type ReactElement } from 'react'

import { StarIcon } from './icons'

import type { AnswerValue, SurveyQuestion } from '@surveydesk/shared'

export interface QuestionFieldProps {
  question: SurveyQuestion
  value: AnswerValue | undefined
  error?: string
  onChange: (value: AnswerValue | undefined) => void
}

export function QuestionField({
  question,
  value,
  error,
  onChange,
}: QuestionFieldProps): ReactElement {
  const labelId = useId()
  const errorId = useId()
  const describedBy = error ? errorId : undefined

  return (
    <div className="sd-q" role="group" aria-labelledby={labelId}>
      <span className="sd-q-label" id={labelId}>
        {question.label}
        {question.required ? (
          <span className="sd-req" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>

      <FieldBody
        question={question}
        value={value}
        onChange={onChange}
        labelId={labelId}
        describedBy={describedBy}
      />

      {error ? (
        <p className="sd-q-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface BodyProps extends QuestionFieldProps {
  labelId: string
  describedBy: string | undefined
}

function FieldBody({ question, value, onChange, labelId, describedBy }: BodyProps): ReactElement {
  switch (question.type) {
    case 'rating':
      return <RatingField value={value} onChange={onChange} labelId={labelId} />
    case 'nps':
      return (
        <NpsField value={value} onChange={onChange} labelId={labelId} describedBy={describedBy} />
      )
    case 'single_choice':
      return <SingleChoiceField question={question} value={value} onChange={onChange} />
    case 'multi_choice':
      return <MultiChoiceField question={question} value={value} onChange={onChange} />
    case 'text':
      return (
        <TextField
          question={question}
          value={value}
          onChange={onChange}
          describedBy={describedBy}
        />
      )
    default:
      return <></>
  }
}

/* -------------------------------- rating -------------------------------- */

function RatingField({
  value,
  onChange,
  labelId,
}: {
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  labelId: string
}): ReactElement {
  const current = typeof value === 'number' ? value : 0
  const stars = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i)

  const move = (delta: number) => {
    const next = Math.min(RATING_MAX, Math.max(RATING_MIN, (current || RATING_MIN) + delta))
    onChange(next)
  }

  return (
    <div
      className="sd-stars"
      role="radiogroup"
      aria-labelledby={labelId}
      // 옵션(별 버튼)들이 roving tabIndex 로 포커스를 갖는다. 그룹은 키 이벤트를
      // 위임받아 화살표 이동을 처리하므로 tabIndex={-1} 로 포커스 가능하게 표시한다.
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {stars.map((n) => {
        const on = n <= current
        return (
          <button
            key={n}
            type="button"
            className={`sd-star${on ? ' sd-on' : ''}`}
            role="radio"
            aria-checked={current === n}
            aria-label={`${n}점`}
            tabIndex={current === n || (current === 0 && n === RATING_MIN) ? 0 : -1}
            onClick={() => onChange(current === n ? undefined : n)}
          >
            <StarIcon filled={on} />
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------- nps ---------------------------------- */

function NpsField({
  value,
  onChange,
  labelId,
  describedBy,
}: {
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  labelId: string
  describedBy: string | undefined
}): ReactElement {
  const current = typeof value === 'number' ? value : null
  const scale = Array.from({ length: NPS_MAX - NPS_MIN + 1 }, (_, i) => NPS_MIN + i)
  return (
    <div>
      <div className="sd-nps" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
        {scale.map((n) => (
          <button
            key={n}
            type="button"
            className="sd-nps-btn"
            aria-pressed={current === n}
            aria-label={`${n}점`}
            onClick={() => onChange(current === n ? undefined : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="sd-nps-legend" aria-hidden="true">
        <span>전혀 아니다</span>
        <span>매우 그렇다</span>
      </div>
    </div>
  )
}

/* ----------------------------- single choice ---------------------------- */

function SingleChoiceField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
}): ReactElement {
  const name = useId()
  const current = typeof value === 'string' ? value : null
  return (
    <div className="sd-choices" role="radiogroup">
      {(question.options ?? []).map((opt) => {
        const checked = current === opt.value
        return (
          <label key={opt.value} className={`sd-choice${checked ? ' sd-checked' : ''}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}

/* ------------------------------ multi choice ---------------------------- */

function MultiChoiceField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
}): ReactElement {
  const selected = Array.isArray(value) ? (value as string[]) : []
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]
    onChange(next.length > 0 ? next : undefined)
  }
  return (
    <div className="sd-choices" role="group">
      {(question.options ?? []).map((opt) => {
        const checked = selected.includes(opt.value)
        return (
          <label key={opt.value} className={`sd-choice${checked ? ' sd-checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} />
            <span>{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}

/* --------------------------------- text --------------------------------- */

function TextField({
  question,
  value,
  onChange,
  describedBy,
}: {
  question: SurveyQuestion
  value: AnswerValue | undefined
  onChange: (v: AnswerValue | undefined) => void
  describedBy: string | undefined
}): ReactElement {
  const variant = question.variant ?? 'short'
  const max = TEXT_MAX[variant]
  const text = typeof value === 'string' ? value : ''
  const set = (v: string) => onChange(v.length > 0 ? v : undefined)

  if (variant === 'long') {
    return (
      <div>
        <textarea
          className="sd-textarea"
          value={text}
          maxLength={max}
          aria-describedby={describedBy}
          placeholder="자유롭게 적어 주세요"
          onChange={(e) => set(e.target.value)}
        />
        <div className="sd-count" aria-hidden="true">
          {text.length}/{max}
        </div>
      </div>
    )
  }
  return (
    <input
      className="sd-input"
      type="text"
      value={text}
      maxLength={max}
      aria-describedby={describedBy}
      placeholder="한 줄로 적어 주세요"
      onChange={(e) => set(e.target.value)}
    />
  )
}
