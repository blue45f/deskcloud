import { useEffect, useRef, useState } from 'react'

import type { RefObject } from 'react'

/** 모션을 끄거나 IO 가 없으면 리빌을 쓰지 않는다(콘텐츠는 처음부터 그대로 보임). */
function motionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof IntersectionObserver === 'undefined') return false
  return !(
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export type RevealState = 'static' | 'armed' | 'revealed'

/**
 * 스크롤 진입 리빌 — "이미 보이는 콘텐츠를 강화"하는 안전한 패턴.
 *
 * 핵심: 콘텐츠 가시성을 클래스 전환에 **걸지 않는다**. 기본은 항상 보임(`static`).
 * 모션이 켜졌고, 마운트 시점에 요소가 **뷰포트 아래**에 있을 때만 `armed`(숨김)로 전환한 뒤
 * 스크롤로 들어오면 `revealed`(등장)로 바꾼다. 따라서:
 *  - JS/IO 미동작·prefers-reduced-motion → 계속 `static`(빈 화면 없음).
 *  - 첫 페인트에 이미 보이는 요소 → `armed` 자체를 건너뜀(깜빡임 없음).
 *  - 헤드리스/숨겨진 탭에서 옵저버가 안 불려도 콘텐츠는 보인다.
 *
 * 사용: 요소에 `data-reveal`, `className={revealClass(state)}` 부여.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefObject<T | null>
  state: RevealState
} {
  const ref = useRef<T>(null)
  const [state, setState] = useState<RevealState>('static')

  useEffect(() => {
    const node = ref.current
    if (!node || !motionEnabled()) return

    // 이미 뷰포트 안(또는 위)이면 애니메이션 없이 그대로 둔다.
    const rect = node.getBoundingClientRect()
    const belowFold = rect.top > window.innerHeight * 0.92
    if (!belowFold) return

    // 아래에 있는 요소만 숨겨서 등장 연출을 무장(arm)한다.
    setState('armed')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState('revealed')
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, state }
}

/** RevealState → 클래스. `armed`/`revealed` 만 클래스를 부여하고 `static` 은 무클래스. */
export function revealClass(state: RevealState): string | undefined {
  if (state === 'armed') return 'fd-reveal-armed'
  if (state === 'revealed') return 'fd-reveal-armed fd-revealed'
  return undefined
}
