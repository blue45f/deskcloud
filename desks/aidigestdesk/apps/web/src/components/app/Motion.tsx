import { useEffect, useRef, useState } from 'react'

import type { CSSProperties, ElementType, ReactNode } from 'react'

import { useReveal } from '@/hooks/useReveal'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

type RevealProps = {
  children: ReactNode
  /** 렌더 태그(기본 div). 시맨틱을 유지하려면 'section' 등으로 바꾼다. */
  as?: ElementType
  /** 페이드만(소프트) vs 살짝 올라오는 기본 진입. */
  variant?: 'up' | 'soft'
  /** 스태거용 진입 지연(ms). 형제 목록에만 쓴다. */
  delay?: number
  className?: string
  id?: string
}

/**
 * 스크롤 진입 시 한 번 안착하는 래퍼. 기본은 "보임"이라 CLS·빈 출하가 없다.
 * prefers-reduced-motion / IO 미지원이면 그대로 즉시 보인다.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  className,
  id,
}: RevealProps) {
  const { ref, revealed } = useReveal<HTMLElement>()
  const base = variant === 'soft' ? 'reveal-soft' : 'reveal'
  return (
    <Tag
      ref={ref}
      id={id}
      className={`${base}${revealed ? ' is-revealed' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? ({ '--reveal-delay': delay } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/**
 * 진입 시 0→value 로 한 번 카운트업하는 숫자.
 * - prefers-reduced-motion / 비숫자 표시값이면 즉시 최종값을 보여준다.
 * - 진입 후 1회만 실행하며 rAF 기반(스크롤 리스너 없음).
 */
export function CountUp({
  value,
  durationMs = 900,
  className,
  suffix = '',
}: {
  value: number
  durationMs?: number
  className?: string
  suffix?: string
}) {
  const { ref, revealed } = useReveal<HTMLSpanElement>({ threshold: 0 })
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const startedRef = useRef(false)

  useEffect(() => {
    if (!revealed || startedRef.current) return
    startedRef.current = true
    // reduced-motion이면 useState 초기값이 이미 최종값이므로 setState 불필요(캐스케이드 렌더 방지).
    if (prefersReducedMotion()) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      setDisplay(Math.round(easeOutExpo(progress) * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [revealed, value, durationMs])

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('ko-KR')}
      {suffix}
    </span>
  )
}
