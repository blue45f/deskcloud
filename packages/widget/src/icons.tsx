/** 인라인 SVG 아이콘 — 외부 아이콘 패키지 의존 없이 위젯에 임베드. 모두 currentColor. */
import type { ReactElement } from 'react'

export function StarIcon({ filled }: { filled: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="m12 3 2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83L6.62 19.6l1.03-6L3.3 9.4l6-.9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 부분 채움 별(평균 표시용). fraction 0..1 만큼 좌측을 채운다. */
export function StarHalfIcon({ fraction, gradId }: { fraction: number; gradId: string }): ReactElement {
  const clamped = Math.max(0, Math.min(1, fraction))
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset={`${clamped * 100}%`} stopColor="currentColor" />
          <stop offset={`${clamped * 100}%`} stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="m12 3 2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83L6.62 19.6l1.03-6L3.3 9.4l6-.9L12 3Z"
        fill={`url(#${gradId})`}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AlertIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8v5m0 3.5h.01M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function QuoteIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.6 5.4C6.5 6.8 4.5 9.7 4.5 13v5.1h6V13H7.7c0-2.1 1-3.6 3-4.5l-1.1-3.1Zm9 0c-3.1 1.4-5.1 4.3-5.1 7.6v5.1h6V13h-2.8c0-2.1 1-3.6 3-4.5l-1.1-3.1Z" />
    </svg>
  )
}
