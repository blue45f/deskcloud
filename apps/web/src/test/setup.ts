import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 각 테스트 후 DOM 정리(누수·교차오염 방지).
afterEach(() => {
  cleanup()
})

// jsdom 은 matchMedia 가 없다 — reduced-motion 질의(CountUp/useReveal 등)가
// 조용히 false(모션 허용)로 떨어지도록 폴리필. addEventListener 도 no-op 으로 채운다.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

// jsdom 은 IntersectionObserver 가 없다 — 리빌/카운트업 훅이 관찰자 미지원 분기로
// 안전하게 즉시 노출되도록, 콜백을 호출하지 않는 no-op 스텁을 제공한다.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root: Element | null = null
    readonly rootMargin: string = ''
    readonly scrollMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver
}
