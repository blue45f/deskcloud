/**
 * 'Powered by DeskCloud' 배지 — 벤더 단일파일(zero-dep React 컴포넌트, copy-paste).
 *
 * Free 플랜 Desk의 공개 위젯/페이지 하단에 노출되는 마케팅 배지. 유료 플랜
 * (PLAN_LIMITS[plan].removableBadge === true)은 `hidden` 으로 숨길 수 있다.
 * 외부 의존 없음 — React 만 있으면 어떤 Desk에서도 그대로 쓸 수 있다.
 *
 * 사용:
 *   import { PoweredByDeskCloud } from './PoweredByDeskCloud'
 *   <PoweredByDeskCloud hidden={PLAN_LIMITS[tenant.plan].removableBadge} />
 */
import type { CSSProperties } from 'react'

export interface PoweredByDeskCloudProps {
  /** true 면 렌더링하지 않음(유료 플랜에서 배지 제거). */
  hidden?: boolean
  /** 클릭 시 이동할 URL. */
  href?: string
  /** 'light' | 'dark' — 배경에 맞춰 색 반전. */
  theme?: 'light' | 'dark'
  /** 추가 스타일(위치 조정 등). */
  style?: CSSProperties
}

const PALETTE = {
  light: { fg: '#475569', bg: 'rgba(255,255,255,0.9)', border: '#e2e8f0' },
  dark: { fg: '#cbd5e1', bg: 'rgba(15,23,42,0.85)', border: '#334155' },
} as const

export function PoweredByDeskCloud({
  hidden = false,
  href = 'https://deskcloud.dev',
  theme = 'light',
  style,
}: PoweredByDeskCloudProps): JSX.Element | null {
  if (hidden) return null
  const c = PALETTE[theme]
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by DeskCloud"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 500,
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 9999,
        textDecoration: 'none',
        backdropFilter: 'blur(4px)',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 2,
          background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
        }}
      />
      Powered by <strong style={{ fontWeight: 700 }}>DeskCloud</strong>
    </a>
  )
}

export default PoweredByDeskCloud
