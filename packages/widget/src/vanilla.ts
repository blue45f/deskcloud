/**
 * @reviewdesk/widget/vanilla — 프레임워크 무관 로더.
 *
 * 비-React 사이트가 <script> 한 줄로 위젯을 띄울 수 있게 한다. 4개 위젯을 각각
 * 컨테이너에 마운트한다:
 *
 *   <div id="rd-stars" data-subject-id="pro-plan"></div>
 *   <script src=".../reviewdesk-widget.js"></script>
 *   <script>
 *     ReviewDesk.init({
 *       publishableKey: 'pk_live_...',
 *       endpoint: 'https://reviews.example.com',
 *     })
 *   </script>
 *
 * init 은 [data-reviewdesk] 또는 알려진 id(rd-stars/rd-list/rd-form/rd-wall)를 스캔해
 * data-* 속성으로 위젯 종류·subjectId 등을 읽어 마운트한다. 명령형 mount 도 제공:
 *
 *   const handle = ReviewDesk.stars('#rd-stars', { publishableKey, endpoint, subjectId })
 *   handle.unmount()
 *
 * ESM/CJS 빌드에서는 react/react-dom 이 external(peer), IIFE 빌드에서는 인라인된다.
 */
import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  ReviewForm,
  ReviewList,
  ReviewStars,
  TestimonialWall,
  type CommonWidgetProps,
  type ReviewFormProps,
  type ReviewListProps,
  type ReviewStarsProps,
  type TestimonialWallProps,
} from './react'

export interface WidgetHandle {
  /** 위젯을 제거하고 (자체 생성한) 컨테이너를 정리한다. */
  unmount: () => void
  /** 마운트된 컨테이너 엘리먼트. */
  container: HTMLElement
}

type Target = string | HTMLElement

function resolveContainer(target: Target | undefined, marker: string): HTMLElement {
  if (target instanceof HTMLElement) return target
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (found) return found
  }
  const host = document.createElement('div')
  host.setAttribute(marker, '')
  document.body.appendChild(host)
  return host
}

function noopHandle(): WidgetHandle {
  return { unmount: () => undefined, container: null as unknown as HTMLElement }
}

function render<P extends object>(
  Component: ComponentType<P>,
  target: Target | undefined,
  props: P
): WidgetHandle {
  if (typeof document === 'undefined') return noopHandle()
  const container = resolveContainer(target, 'data-reviewdesk-mounted')
  const root: Root = createRoot(container)
  root.render(createElement(Component, props))
  return {
    container,
    unmount: () => {
      root.unmount()
      if (container.hasAttribute('data-reviewdesk-mounted') && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}

/* --------------------------- 명령형 마운트 (개별) --------------------------- */

export function stars(target: Target, props: ReviewStarsProps): WidgetHandle {
  return render(ReviewStars, target, props)
}
export function list(target: Target, props: ReviewListProps): WidgetHandle {
  return render(ReviewList, target, props)
}
export function form(target: Target, props: ReviewFormProps): WidgetHandle {
  return render(ReviewForm, target, props)
}
export function wall(target: Target, props: TestimonialWallProps): WidgetHandle {
  return render(TestimonialWall, target, props)
}

/* ------------------------------ 자동 스캔 init ------------------------------ */

export interface InitOptions extends CommonWidgetProps {
  /**
   * 스캔할 셀렉터. 기본 '[data-reviewdesk]'. 각 엘리먼트의 data-* 로 위젯을 결정:
   *   data-reviewdesk="stars|list|form|wall"  (필수 — 위젯 종류)
   *   data-subject-id="..."                   (stars/list/form 필수)
   *   data-subject-label / data-limit / data-accent / data-title / data-collect-email / data-href
   */
  selector?: string
}

function dataNum(el: HTMLElement, key: string): number | undefined {
  const v = el.dataset[key]
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function dataBool(el: HTMLElement, key: string): boolean | undefined {
  const v = el.dataset[key]
  if (v === undefined) return undefined
  return v === '' || v === 'true' || v === '1'
}

/**
 * init — 페이지의 [data-reviewdesk] 플레이스홀더를 스캔해 위젯을 마운트한다.
 * 마운트된 핸들 목록을 반환한다(전체 해제는 unmountAll).
 */
export function init(options: InitOptions): WidgetHandle[] {
  if (typeof document === 'undefined') return []
  const { selector = '[data-reviewdesk]', publishableKey, endpoint } = options
  const common = {
    publishableKey,
    endpoint,
    accent: options.accent,
    accentInk: options.accentInk,
    fetch: options.fetch,
    client: options.client,
  }
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  const handles: WidgetHandle[] = []

  for (const el of els) {
    if (el.hasAttribute('data-reviewdesk-mounted')) continue
    const kind = el.dataset.reviewdesk
    const accent = el.dataset.accent ?? common.accent
    const subjectId = el.dataset.subjectId ?? ''

    if (kind === 'stars') {
      handles.push(
        render(ReviewStars, el, {
          ...common,
          accent,
          subjectId,
          hideCount: dataBool(el, 'hideCount'),
          href: el.dataset.href,
        } as ReviewStarsProps)
      )
    } else if (kind === 'list') {
      handles.push(
        render(ReviewList, el, {
          ...common,
          accent,
          subjectId,
          limit: dataNum(el, 'limit'),
          hideDistribution: dataBool(el, 'hideDistribution'),
          title: el.dataset.title,
        } as ReviewListProps)
      )
    } else if (kind === 'form') {
      handles.push(
        render(ReviewForm, el, {
          ...common,
          accent,
          subjectId,
          subjectLabel: el.dataset.subjectLabel,
          title: el.dataset.title,
          subtitle: el.dataset.subtitle,
          collectEmail: dataBool(el, 'collectEmail'),
        } as ReviewFormProps)
      )
    } else if (kind === 'wall') {
      handles.push(
        render(TestimonialWall, el, {
          ...common,
          accent,
          limit: dataNum(el, 'limit'),
          title: el.dataset.title,
        } as TestimonialWallProps)
      )
    }
  }
  return handles
}

/** IIFE 빌드가 window.ReviewDesk 로 노출하는 네임스페이스. */
export const ReviewDesk = { init, stars, list, form, wall }
