/**
 * @mediadesk/sdk — MediaDesk 브라우저 클라이언트.
 *
 *   import { createMediaDeskClient } from '@mediadesk/sdk'
 *   const md = createMediaDeskClient({ publishableKey: 'pk_…', endpoint: 'https://media.example.com' })
 *   const { url } = await md.upload(file, { folder: 'avatars', onProgress: p => … })
 *   const thumb = md.buildUrl(asset.key, { w: 240, h: 240, format: 'webp', q: 70 })
 *
 * 의존성 0 · fetch/XHR 기반 · SSR 안전(브라우저 API는 사용 시점에만 참조).
 */
export {
  createMediaDeskClient,
  buildUrlFrom,
  transformQuery,
  MediaDeskError,
  type MediaDeskClient,
  type MediaDeskClientOptions,
} from './client'

export type {
  MediaAsset,
  UploadResult,
  UploadOptions,
  AssetListResult,
  TransformOptions,
  TransformFormat,
} from './types'
