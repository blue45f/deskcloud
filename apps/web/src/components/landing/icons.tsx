import type { ReactElement } from 'react'

/** 랜딩 기능 카드용 인라인 아이콘(의존성 0, currentColor 상속). 1.6px 스트로크. */

interface IconProps {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** 임베드/한 줄 코드. */
export function EmbedIcon({ className }: IconProps): ReactElement {
  return (
    <svg {...base} className={className}>
      <path d="m8 9-3 3 3 3" />
      <path d="m16 9 3 3-3 3" />
      <rect x="3" y="4" width="18" height="16" rx="3" />
    </svg>
  )
}

/** 멀티테넌트 사용자 풀. */
export function TenantsIcon({ className }: IconProps): ReactElement {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.5" />
      <path d="M18.5 19a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  )
}

/** 안전한 비밀번호·세션(자물쇠). */
export function ShieldIcon({ className }: IconProps): ReactElement {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  )
}

/** 어드민 통계(차트). */
export function ChartIcon({ className }: IconProps): ReactElement {
  return (
    <svg {...base} className={className}>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M8 15l3.5-4 3 2.5L20 7" />
    </svg>
  )
}
