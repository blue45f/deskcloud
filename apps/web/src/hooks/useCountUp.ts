import { useEffect, useRef, useState } from 'react'

/**
 * 모션을 끌지(또는 애니메이션이 무의미한지) 판정 — reduced-motion 선호 또는 IO 미지원.
 * 이때는 카운트업 없이 처음부터 target 을 보여준다(정답을 가리지 않음).
 */
function prefersNoCountUp(): boolean {
  if (typeof window === 'undefined') return true
  if (typeof IntersectionObserver === 'undefined') return true
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * 숫자가 0 → target 으로 부드럽게 올라가는 카운트업. 요소가 처음 보일 때 1회 재생한다.
 * reduced-motion / IO 미지원이면 즉시 target 으로 고정한다(애니메이션 없이 정답을 보여줌).
 *
 * @returns [value, ref] — value 를 렌더하고 ref 를 측정 대상 요소에 붙인다.
 */
export function useCountUp(
  target: number,
  durationMs = 1200
): [number, React.RefObject<HTMLSpanElement | null>] {
  const ref = useRef<HTMLSpanElement>(null)
  // 모션을 안 쓰는 환경에서는 처음부터 target 으로 시작 → effect 안에서 동기 setState 불필요.
  const [value, setValue] = useState(() => (prefersNoCountUp() ? target : 0))

  useEffect(() => {
    const el = ref.current
    if (!el || prefersNoCountUp()) return

    let raf = 0
    let start = 0
    const ease = (t: number): number => 1 - Math.pow(1 - t, 3) // ease-out-cubic

    const tick = (now: number): void => {
      if (!start) start = now
      const progress = Math.min((now - start) / durationMs, 1)
      setValue(Math.round(ease(progress) * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          raf = requestAnimationFrame(tick)
          obs.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    obs.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [target, durationMs])

  return [value, ref]
}
