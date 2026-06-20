/**
 * @notifydesk/widget/vanilla — 프레임워크 무관 로더.
 *
 * 비-React 사이트가 <script> 한 줄로 알림 벨을 띄울 수 있게 한다:
 *
 *   <div id="notify-bell"></div>
 *   <script src=".../notify-widget.js"></script>
 *   <script>
 *     NotifyDesk.init({
 *       target: '#notify-bell',
 *       recipientId: 'user_42',
 *       publishableKey: 'pk_…',
 *       endpoint: 'https://notify.example.com',
 *     })
 *   </script>
 *
 * 또는 명령형으로:
 *   const handle = NotifyDesk.mount({ recipientId, publishableKey, endpoint })
 *   handle.unmount()
 *
 * 내부적으로 React 트리를 분리된 컨테이너에 마운트한다. ESM/CJS 빌드에서는 react/react-dom
 * 이 external(peer)이고, IIFE 빌드(vite.iife.config.ts)에서는 react/react-dom 이 인라인된다.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { NotificationBell, type NotificationBellProps } from './react'

export interface MountOptions extends NotificationBellProps {
  /** 마운트 대상. CSS 셀렉터·엘리먼트. 생략 시 document.body 에 컨테이너를 새로 만든다. */
  target?: string | HTMLElement
}

export interface WidgetHandle {
  /** 위젯을 제거하고 컨테이너를 정리한다. */
  unmount: () => void
  /** 마운트된 컨테이너 엘리먼트. */
  container: HTMLElement
}

function resolveContainer(target: MountOptions['target']): HTMLElement {
  if (target instanceof HTMLElement) return target
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (found) return found
  }
  const host = document.createElement('div')
  host.setAttribute('data-notifydesk-widget', '')
  document.body.appendChild(host)
  return host
}

/**
 * 명령형 마운트. SSR/비브라우저 환경에서는 no-op 핸들을 반환한다.
 */
export function mount(options: MountOptions): WidgetHandle {
  if (typeof document === 'undefined') {
    return { unmount: () => undefined, container: null as unknown as HTMLElement }
  }
  const container = resolveContainer(options.target)
  const root: Root = createRoot(container)
  const { target: _target, ...widgetProps } = options
  root.render(createElement(NotificationBell, widgetProps))

  return {
    container,
    unmount: () => {
      root.unmount()
      if (container.hasAttribute('data-notifydesk-widget') && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}

/**
 * init — IIFE/스크립트 임베드용 진입점. mount 의 얇은 별칭.
 * window.NotifyDesk.init({ recipientId, publishableKey, endpoint }) 형태로 호출된다.
 */
export function init(options: MountOptions): WidgetHandle {
  return mount(options)
}

/** IIFE 빌드가 window.NotifyDesk 로 노출하는 네임스페이스 형태. */
export const NotifyDesk = { mount, init }
