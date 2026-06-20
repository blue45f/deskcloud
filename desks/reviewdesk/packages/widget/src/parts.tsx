/**
 * 공유 표시(read-only) 조각들 — 별점 렌더·아바타·시간 포맷.
 * 입력(별점 picker)은 ReviewForm 이 자체적으로 roving radio 로 구현한다.
 */
import { RATING_MAX } from '@reviewdesk/shared'
import { useId, type ReactElement } from 'react'

import { StarHalfIcon, StarIcon } from './icons'

export type StarSize = 'sm' | 'md' | 'lg'

/**
 * 읽기 전용 별점 표시. 평균(소수)도 부분 채움으로 그린다.
 * 시각은 aria-hidden; 접근성 라벨은 부모가 텍스트로 제공(예: "5점 만점에 4.6점").
 */
export function Stars({
  value,
  size = 'md',
  label,
}: {
  value: number
  size?: StarSize
  /** 주면 role="img" + aria-label 로 단독 의미 전달. 미지정 시 aria-hidden(부모가 라벨 제공). */
  label?: string
}): ReactElement {
  const gradBase = useId()
  const full = Math.floor(value)
  const frac = value - full
  return (
    <span
      className={`rd-stars rd-${size}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: RATING_MAX }, (_, i) => {
        const idx = i + 1
        if (idx <= full) return <StarIcon key={idx} filled />
        if (idx === full + 1 && frac > 0.05) {
          return <StarHalfIcon key={idx} fraction={frac} gradId={`${gradBase}-${idx}`} />
        }
        return (
          <span key={idx} className="rd-star-empty">
            <StarIcon filled={false} />
          </span>
        )
      })}
    </span>
  )
}

/** 이름 머리글자 아바타(이미지 의존 없음). */
export function Avatar({ name }: { name: string }): ReactElement {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="rd-avatar" aria-hidden="true">
      {initial}
    </span>
  )
}

/** ISO 날짜를 'YYYY. M. D.' 로(로캘 무관·SSR 안전). 실패 시 원문. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
