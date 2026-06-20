/**
 * 임베드/SDK 스니펫 생성기 — 랜딩·임베드 탭·온보딩이 공유한다.
 * endpoint 는 위젯/SDK 가 붙을 MediaDesk API 베이스 URL.
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  folder?: string
}

const PK_PLACEHOLDER = 'pk_여기에_publishable_키'

function safePk(pk: string): string {
  return pk && pk.startsWith('pk_') ? pk : PK_PLACEHOLDER
}

/** React 앱: 패키지 설치 후 업로더/갤러리 컴포넌트. */
export function reactSnippet({ publishableKey, endpoint, folder }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const pk = safePk(publishableKey)
  const folderProp = folder ? `\n        folder="${folder}"` : ''
  return `import { MediaUploader, MediaGallery } from '@mediadesk/widget'

export function MediaPanel() {
  return (
    <>
      <MediaUploader
        publishableKey="${pk}"
        endpoint="${base}"${folderProp}
        onUploaded={(asset) => console.log('업로드됨:', asset.url)}
      />
      <MediaGallery
        publishableKey="${pk}"
        endpoint="${base}"${folderProp}
      />
    </>
  )
}`
}

/** 비-React 사이트: IIFE 스크립트 + mount 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, folder }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const pk = safePk(publishableKey)
  const folderLine = folder ? `, folder: '${folder}'` : ''
  return `<!-- MediaDesk 업로더 + 갤러리 -->
<div id="md-uploader"></div>
<div id="md-gallery"></div>
<script src="${base}/media-widget.js"></script>
<script>
  MediaDesk.init({
    uploader: { target: '#md-uploader', props: { publishableKey: '${pk}', endpoint: '${base}'${folderLine} } },
    gallery:  { target: '#md-gallery',  props: { publishableKey: '${pk}', endpoint: '${base}'${folderLine} } },
  })
</script>`
}

/** 브라우저 SDK 직접 사용(업로드 + 변환 URL). */
export function sdkSnippet({ publishableKey, endpoint }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const pk = safePk(publishableKey)
  return `import { createMediaDeskClient } from '@mediadesk/sdk'

const md = createMediaDeskClient({
  publishableKey: '${pk}',
  endpoint: '${base}',
})

// 업로드
const asset = await md.upload(file, { folder: 'avatars', onProgress: (p) => console.log(p) })

// 변환 URL(리사이즈·포맷·품질)
const thumb = md.buildUrl(asset.key, { w: 240, h: 240, format: 'webp', q: 70 })`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @mediadesk/widget
# 또는: pnpm add @mediadesk/widget`
}

/** 변환 URL 빌더 — 자산 url 에 쿼리를 덧붙인다(미리보기·복사용). */
export interface TransformParams {
  w?: number
  h?: number
  format?: string
  q?: number
}

export function buildTransformUrl(url: string, t: TransformParams): string {
  const params = new URLSearchParams()
  if (t.w) params.set('w', String(t.w))
  if (t.h) params.set('h', String(t.h))
  if (t.format) params.set('format', t.format)
  if (t.q) params.set('q', String(t.q))
  const q = params.toString()
  if (!q) return url
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`
}
