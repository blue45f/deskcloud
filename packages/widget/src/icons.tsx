/** 인라인 SVG 아이콘 — 외부 아이콘 패키지 의존 없이 위젯에 임베드. 모두 currentColor. */
import type { ReactElement } from 'react'

/** 빈 슬롯 플레이스홀더 아이콘(이미지 자리). */
export function ImageIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m4 17 4.5-4.5L13 17l3-3 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
