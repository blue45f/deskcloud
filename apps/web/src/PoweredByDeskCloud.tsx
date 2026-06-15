/**
 * 'Powered by DeskCloud' 배지 — vendor/PoweredByDeskCloud.tsx 의 동기화 복사본(zero-dep).
 * Free 플랜 Desk 의 공개 위젯/페이지 하단에 노출. 유료(removeBranding)는 hidden 으로 숨김.
 */
import type { CSSProperties } from 'react'

export interface PoweredByDeskCloudProps {
  hidden?: boolean
  href?: string
  theme?: 'light' | 'dark'
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
}: PoweredByDeskCloudProps): React.JSX.Element | null {
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
