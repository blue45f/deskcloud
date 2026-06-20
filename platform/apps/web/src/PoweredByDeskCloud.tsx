/**
 * 'Powered by DeskCloud' 배지 — vendor/PoweredByDeskCloud.tsx 의 동기화 복사본(zero-dep).
 * Free 플랜 Desk 의 공개 위젯/페이지 하단에 노출. 유료(removeBranding)는 hidden 으로 숨김.
 */
import type { CSSProperties, ReactElement } from 'react'

export interface PoweredByDeskCloudProps {
  hidden?: boolean
  href?: string
  theme?: 'light' | 'dark'
  style?: CSSProperties
}

const PALETTE = {
  light: { fg: 'var(--color-text)', bg: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', border: 'var(--color-border)' },
  dark: {
    fg: 'var(--color-text)',
    bg: 'color-mix(in srgb, var(--color-surface-2) 88%, transparent)',
    border: 'var(--color-border-strong)',
  },
} as const

export function PoweredByDeskCloud({
  hidden = false,
  href = 'https://deskcloud.dev',
  theme = 'light',
  style,
}: PoweredByDeskCloudProps): ReactElement | null {
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
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-info))',
        }}
      />
      Powered by <strong style={{ fontWeight: 700 }}>DeskCloud</strong>
    </a>
  )
}
