/**
 * @mediadesk/widget — 임베드 미디어 위젯.
 *
 * - React 소비자: `import { MediaUploader, MediaGallery } from '@mediadesk/widget'`
 * - 바닐라(비-React) 사이트: `@mediadesk/widget/vanilla` 또는 IIFE 빌드(window.MediaDesk)
 *
 * SDK 를 직접 쓰고 싶으면 `@mediadesk/sdk` 를 사용하세요.
 */
export {
  MediaUploader,
  type MediaUploaderProps,
} from './MediaUploader'

export {
  MediaGallery,
  type MediaGalleryProps,
  type MediaGalleryHandle,
} from './MediaGallery'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export {
  mountUploader,
  mountGallery,
  init,
  createClient,
  type WidgetHandle,
  type GalleryHandle,
  type InitOptions,
  type InitHandle,
} from './vanilla'

// SDK 타입 재노출(소비자 편의).
export type {
  MediaAsset,
  UploadResult,
  TransformOptions,
  TransformFormat,
} from '@mediadesk/sdk'
