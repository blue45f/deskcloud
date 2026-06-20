/**
 * @communitydesk/widget/vanilla — 프레임워크 무관 로더.
 *
 * 비-React 사이트가 <script> 한 줄로 게시판 위젯을 띄울 수 있게 한다:
 *
 *   <script src=".../community-widget.js"></script>
 *   <script>
 *     CommunityDesk.init({
 *       target: '#community',
 *       boardSlug: 'free',
 *       publishableKey: 'pk_...',
 *       endpoint: 'https://community.example.com',
 *       memberId: 'u_42', memberName: '준호',   // 있으면 작성/반응 가능
 *     })
 *   </script>
 *
 * 또는 명령형으로:
 *   const handle = CommunityDesk.mount({ target, boardSlug, publishableKey, endpoint })
 *   handle.unmount()
 *
 * 내부적으로 React 트리를 컨테이너에 마운트한다. ESM/CJS 빌드에서는 react/react-dom 이
 * external(peer)이고, IIFE 빌드(vite.iife.config.ts)에서는 react/react-dom 이 인라인된다.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  CommunityBoard,
  CommunityFeed,
  type CommunityBoardProps,
  type CommunityFeedProps,
} from './react'

export interface MountBoardOptions extends CommunityBoardProps {
  /** 마운트 대상. CSS 셀렉터·엘리먼트. 생략 시 document.body 에 컨테이너를 새로 만든다. */
  target?: string | HTMLElement
}

export interface MountFeedOptions extends CommunityFeedProps {
  target?: string | HTMLElement
}

export interface WidgetHandle {
  /** 위젯을 제거하고 컨테이너를 정리한다. */
  unmount: () => void
  /** 마운트된 컨테이너 엘리먼트. */
  container: HTMLElement
}

function resolveContainer(target: string | HTMLElement | undefined): HTMLElement {
  if (target instanceof HTMLElement) return target
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (found) return found
  }
  const host = document.createElement('div')
  host.setAttribute('data-communitydesk-widget', '')
  document.body.appendChild(host)
  return host
}

function noopHandle(): WidgetHandle {
  return { unmount: () => undefined, container: null as unknown as HTMLElement }
}

function mountRoot(
  target: string | HTMLElement | undefined,
  element: ReturnType<typeof createElement>
): WidgetHandle {
  if (typeof document === 'undefined') return noopHandle()
  const container = resolveContainer(target)
  const root: Root = createRoot(container)
  root.render(element)
  return {
    container,
    unmount: () => {
      root.unmount()
      if (container.hasAttribute('data-communitydesk-widget') && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}

/** <CommunityBoard> 를 명령형으로 마운트(권장 진입점). */
export function mount(options: MountBoardOptions): WidgetHandle {
  const { target, ...props } = options
  return mountRoot(target, createElement(CommunityBoard, props))
}

/** <CommunityFeed>(compact) 를 명령형으로 마운트. */
export function mountFeed(options: MountFeedOptions): WidgetHandle {
  const { target, ...props } = options
  return mountRoot(target, createElement(CommunityFeed, props))
}

/** init — IIFE/스크립트 임베드용 진입점. mount 의 얇은 별칭. */
export function init(options: MountBoardOptions): WidgetHandle {
  return mount(options)
}

/** IIFE 빌드가 window.CommunityDesk 로 노출하는 네임스페이스 형태. */
export const CommunityDesk = { mount, mountFeed, init }
