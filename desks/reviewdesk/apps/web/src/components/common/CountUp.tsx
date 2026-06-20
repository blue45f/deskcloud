import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 뷰포트에 들어오면 0 → value 로 부드럽게 카운트업하는 숫자.
 * reduced-motion 또는 관찰자 미지원이면 즉시 최종값을 보여 준다(접근성·CLS 안전).
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  durationMs = 1100,
  className,
}: {
  value: number
  decimals?: number
  suffix?: string
  durationMs?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion 동기화(외부 미디어쿼리)
      setDisplay(value)
      return
    }

    let raf = 0
    let started = false
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started) continue
          started = true
          observer.unobserve(entry.target)
          const start = performance.now()
          const tick = (now: number): void => {
            const t = Math.min(1, (now - start) / durationMs)
            // ease-out cubic — 빠르게 시작해 부드럽게 안착.
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplay(value * eased)
            if (t < 1) raf = requestAnimationFrame(tick)
            else setDisplay(value)
          }
          raf = requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, durationMs])

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
