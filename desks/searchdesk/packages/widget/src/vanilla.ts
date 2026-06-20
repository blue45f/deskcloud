/**
 * @searchdesk/widget/vanilla — 프레임워크 무관 로더.
 *
 * 비-React 사이트가 <script> 한 줄로 ⌘K 팔레트(또는 인라인 박스)를 띄울 수 있게 한다:
 *
 *   <script src=".../search-widget.js"></script>
 *   <script>
 *     SearchDesk.init({ publishableKey: 'pk_…', endpoint: 'https://search.example.com' })
 *   </script>
 *
 * 또는 명령형으로:
 *   const handle = SearchDesk.mountPalette({ publishableKey, endpoint })
 *   const box = SearchDesk.mountBox({ publishableKey, endpoint, target: '#search' })
 *   handle.unmount()
 *
 * 내부적으로 React 트리를 분리된 컨테이너에 마운트한다. ESM/CJS 빌드에서는 react/react-dom
 * 이 external(peer)이고, IIFE 빌드(vite.iife.config.ts)에서는 react/react-dom 이 인라인된다.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { SearchBox, type SearchBoxProps } from './SearchBox'
import { SearchPalette, type SearchPaletteProps } from './SearchPalette'

export interface MountPaletteOptions extends Omit<SearchPaletteProps, 'open' | 'onClose'> {
  /** 마운트 대상. 생략 시 document.body 에 컨테이너를 새로 만든다(전역 핫키로 열림). */
  target?: string | HTMLElement
}

export interface MountBoxOptions extends SearchBoxProps {
  /** 마운트 대상(필수에 가깝다 — 인라인 박스라 자리 잡을 위치 지정). 생략 시 body 끝에. */
  target?: string | HTMLElement
}

export interface WidgetHandle {
  /** 위젯을 제거하고(자동 생성한) 컨테이너를 정리한다. */
  unmount: () => void
  /** 마운트된 컨테이너 엘리먼트. */
  container: HTMLElement
}

const MARKER = 'data-searchdesk-widget'

function resolveContainer(target: string | HTMLElement | undefined): HTMLElement {
  if (target instanceof HTMLElement) return target
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (found) return found
  }
  const host = document.createElement('div')
  host.setAttribute(MARKER, '')
  document.body.appendChild(host)
  return host
}

function mountElement(container: HTMLElement, element: ReturnType<typeof createElement>): WidgetHandle {
  const root: Root = createRoot(container)
  root.render(element)
  return {
    container,
    unmount: () => {
      root.unmount()
      if (container.hasAttribute(MARKER) && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}

const noopHandle = (): WidgetHandle => ({
  unmount: () => undefined,
  container: null as unknown as HTMLElement,
})

/** ⌘K 팔레트를 마운트한다(전역 핫키로 열림). SSR/비브라우저는 no-op. */
export function mountPalette(options: MountPaletteOptions): WidgetHandle {
  if (typeof document === 'undefined') return noopHandle()
  const { target, ...props } = options
  return mountElement(resolveContainer(target), createElement(SearchPalette, props))
}

/** 인라인 검색 박스를 target 에 마운트한다. SSR/비브라우저는 no-op. */
export function mountBox(options: MountBoxOptions): WidgetHandle {
  if (typeof document === 'undefined') return noopHandle()
  const { target, ...props } = options
  return mountElement(resolveContainer(target), createElement(SearchBox, props))
}

/**
 * init — IIFE/스크립트 임베드용 기본 진입점. mountPalette 의 얇은 별칭.
 * window.SearchDesk.init({ publishableKey, endpoint }) 형태로 호출된다.
 */
export function init(options: MountPaletteOptions): WidgetHandle {
  return mountPalette(options)
}

/** IIFE 빌드가 window.SearchDesk 로 노출하는 네임스페이스 형태. */
export const SearchDesk = { mountPalette, mountBox, init }
