import type { ReactElement, SVGProps } from 'react'

/**
 * 랜딩 피처용 라인 아이콘 — 의존성 0, currentColor 상속.
 * 24x24 viewBox, stroke 1.7. 장식이므로 aria-hidden 으로 마운트한다.
 */
type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps): IconProps {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

export function IconUpload(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

export function IconKey(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="4.5" />
      <path d="m11 11 8 8" />
      <path d="m16 16 2-2" />
      <path d="m19 13 1.5 1.5" />
    </svg>
  )
}

export function IconShield(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconSwap(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </svg>
  )
}

export function IconCheck(props: IconProps): ReactElement {
  return (
    <svg {...base(props)} width={14} height={14}>
      <path d="m5 12 4.5 4.5L19 6" />
    </svg>
  )
}

export function IconCopy(props: IconProps): ReactElement {
  return (
    <svg {...base(props)} width={14} height={14}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </svg>
  )
}
