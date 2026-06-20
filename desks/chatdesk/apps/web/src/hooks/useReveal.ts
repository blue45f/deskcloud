import { useEffect, useRef } from 'react'

/**
 * 스크롤 리빌 — 뷰포트에 들어오면 한 번 페이드/업 한다.
 *
 * 설계 원칙(brand.md): 리빌은 "이미 보이는 기본"을 강화한다.
 *   - 마크업은 항상 보이는 상태로 렌더된다(`data-reveal` 속성 없음).
 *   - JS 가 마운트되고 모션이 허용되고 IntersectionObserver 가 있을 때만
 *     `data-reveal=""`(이전 상태=숨김)를 켜고, 교차 시 `data-reveal="shown"` 으로 전환한다.
 *   - reduced-motion 이거나 IO 미지원이면 아무 속성도 안 켜므로 콘텐츠가 즉시 보인다
 *     → SSR/no-JS/헤드리스에서 blank 나 CLS 가 발생하지 않는다.
 *
 * @param delayMs 단계적 stagger 용 지연(ms). CSS `--reveal-delay` 로 주입.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delayMs = 0) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') return

    // 이미 화면 안이면(상단 섹션) 깜빡임 없이 곧장 노출되도록 다음 프레임에 켠다.
    if (delayMs > 0) el.style.setProperty('--reveal-delay', `${delayMs}ms`)
    el.setAttribute('data-reveal', '')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute('data-reveal', 'shown')
            observer.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    )
    observer.observe(el)

    return () => observer.disconnect()
  }, [delayMs])

  return ref
}
