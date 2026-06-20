/**
 * @mediadesk/widget/vanilla — 프레임워크 무관 로더.
 *
 * 비-React 사이트가 <script> 한 줄로 업로더/갤러리를 띄울 수 있게 한다:
 *
 *   <script src=".../media-widget.js"></script>
 *   <script>
 *     MediaDesk.mountUploader('#uploader', {
 *       publishableKey: 'pk_…', endpoint: 'https://media.example.com', folder: 'avatars',
 *       onUploaded: (a) => console.log(a.url),
 *     })
 *     MediaDesk.mountGallery('#gallery', { publishableKey: 'pk_…', endpoint: '…', folder: 'avatars' })
 *   </script>
 *
 * 내부적으로 React 트리를 분리된 컨테이너에 마운트한다. ESM/CJS 빌드에서는 react/react-dom 이
 * external(peer)이고, IIFE 빌드(vite.iife.config.ts)에서는 react/react-dom·sdk 가 인라인된다.
 */
import { createMediaDeskClient, type MediaDeskClient } from '@mediadesk/sdk'
import { createElement, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MediaGallery, type MediaGalleryHandle, type MediaGalleryProps } from './MediaGallery'
import { MediaUploader, type MediaUploaderProps } from './MediaUploader'

export interface WidgetHandle {
  /** 위젯을 제거하고 (자동 생성한) 컨테이너를 정리한다. */
  unmount: () => void
  /** 마운트된 컨테이너 엘리먼트. */
  container: HTMLElement
}

export interface GalleryHandle extends WidgetHandle {
  /** 갤러리 목록을 다시 불러온다(업로드 후 등). */
  refresh: () => void
}

function resolveContainer(target: string | HTMLElement | undefined): HTMLElement {
  if (target instanceof HTMLElement) return target
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (found) return found
  }
  const host = document.createElement('div')
  host.setAttribute('data-mediadesk-widget', '')
  document.body.appendChild(host)
  return host
}

function teardown(root: Root, container: HTMLElement): void {
  root.unmount()
  if (container.hasAttribute('data-mediadesk-widget') && container.parentNode) {
    container.parentNode.removeChild(container)
  }
}

const NOOP_HANDLE: WidgetHandle = {
  unmount: () => undefined,
  container: null as unknown as HTMLElement,
}

/** 업로더를 명령형으로 마운트. SSR/비브라우저에서는 no-op. */
export function mountUploader(
  target: string | HTMLElement,
  props: MediaUploaderProps
): WidgetHandle {
  if (typeof document === 'undefined') return NOOP_HANDLE
  const container = resolveContainer(target)
  const root = createRoot(container)
  root.render(createElement(MediaUploader, props))
  return { container, unmount: () => teardown(root, container) }
}

/** 갤러리를 명령형으로 마운트(refresh 지원). SSR/비브라우저에서는 no-op. */
export function mountGallery(
  target: string | HTMLElement,
  props: MediaGalleryProps
): GalleryHandle {
  if (typeof document === 'undefined') {
    return { ...NOOP_HANDLE, refresh: () => undefined }
  }
  const container = resolveContainer(target)
  const root = createRoot(container)
  const handleRef = createRef<MediaGalleryHandle>()
  root.render(createElement(MediaGallery, { ...props, ref: handleRef }))
  return {
    container,
    unmount: () => teardown(root, container),
    refresh: () => handleRef.current?.refresh(),
  }
}

/**
 * init — 업로더와 (선택) 갤러리를 한 번에 띄우고, 업로드 성공 시 갤러리를 자동 새로고침한다.
 * window.MediaDesk.init({ uploader: {...}, gallery: {...} }) 형태.
 */
export interface InitOptions {
  uploader?: { target: string | HTMLElement; props: MediaUploaderProps }
  gallery?: { target: string | HTMLElement; props: MediaGalleryProps }
}

export interface InitHandle {
  uploader?: WidgetHandle
  gallery?: GalleryHandle
  unmount: () => void
}

export function init(options: InitOptions): InitHandle {
  if (typeof document === 'undefined') {
    return { unmount: () => undefined }
  }
  const gallery = options.gallery
    ? mountGallery(options.gallery.target, options.gallery.props)
    : undefined

  const uploader = options.uploader
    ? mountUploader(options.uploader.target, {
        ...options.uploader.props,
        // 업로드되면 사용자가 준 콜백 호출 후 갤러리 자동 새로고침
        onUploaded: (asset) => {
          options.uploader?.props.onUploaded?.(asset)
          gallery?.refresh()
        },
      })
    : undefined

  return {
    uploader,
    gallery,
    unmount: () => {
      uploader?.unmount()
      gallery?.unmount()
    },
  }
}

/** SDK 클라이언트를 바닐라에서도 만들 수 있게 재노출. */
export function createClient(options: {
  publishableKey: string
  endpoint: string
}): MediaDeskClient {
  return createMediaDeskClient(options)
}

/** IIFE 빌드가 window.MediaDesk 로 노출하는 네임스페이스 형태. */
export const MediaDesk = { mountUploader, mountGallery, init, createClient }
