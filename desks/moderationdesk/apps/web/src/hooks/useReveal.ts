import { useEffect, useRef } from 'react'

/**
 * 스크롤 리빌 — 컨테이너 안의 `[data-reveal]` 요소를 뷰포트 진입 시 `.is-in` 으로 드러낸다.
 *
 * 설계 원칙(접근성·안정성):
 *  - **기본은 보임**: 마크업에 `.reveal` 클래스를 두지 않고, JS 가 모션이 허용될 때만 동적으로 단다.
 *    따라서 JS 미실행·SSR·IntersectionObserver 미지원·prefers-reduced-motion 에서는 콘텐츠가
 *    그대로 보이고 레이아웃 점프(CLS)가 없다.
 *  - 한 번 드러나면 다시 숨기지 않는다(관찰 해제).
 *
 * 사용:
 *   const ref = useReveal<HTMLDivElement>()
 *   <section ref={ref}> <div data-reveal> … </div> </section>
 */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return

    // 모션 비허용 / IO 미지원 → 즉시 노출(숨김 클래스조차 달지 않음).
    if (prefersReduced || typeof IntersectionObserver === 'undefined') return

    // 모션 허용 → 먼저 숨김 클래스를 달고(여기서야 비로소 .reveal 적용) 진입을 관찰.
    targets.forEach((el) => el.classList.add('reveal'))

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    )

    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return ref
}
