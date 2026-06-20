# @mediadesk/widget

MediaDesk 임베드 미디어 위젯 — publishable 키로 동작하는 `<MediaUploader>` (드래그앤드롭·미리보기
·진행률·에러·용량/MIME 가드)와 `<MediaGallery>` (반응형 변환 썸네일 그리드). React 컴포넌트 +
바닐라 IIFE 로더(`window.MediaDesk`). 의존성은 `react`(peer)와 `@mediadesk/sdk` 뿐, 외부 CSS
프레임워크 0.

## React

```tsx
import { MediaUploader, MediaGallery } from '@mediadesk/widget'

;<MediaUploader
  publishableKey="pk_xxx"
  endpoint="https://media.example.com"
  folder="avatars"
  onUploaded={(asset) => console.log(asset.url)}
/>

;<MediaGallery publishableKey="pk_xxx" endpoint="https://media.example.com" folder="avatars" />
```

업로드 후 갤러리를 새로고침하려면 `MediaGallery` 의 ref(`refresh()`)를 잡고 `onUploaded` 에서
호출하세요.

## 바닐라(비-React) `<script>`

```html
<div id="uploader"></div>
<div id="gallery"></div>
<script src="https://media.example.com/media-widget.js"></script>
<script>
  MediaDesk.init({
    uploader: { target: '#uploader', props: { publishableKey: 'pk_xxx', endpoint: 'https://media.example.com', folder: 'avatars' } },
    gallery:  { target: '#gallery',  props: { publishableKey: 'pk_xxx', endpoint: 'https://media.example.com', folder: 'avatars' } },
  })
</script>
```

`init` 은 업로드 성공 시 갤러리를 자동으로 새로고침한다. 개별 마운트는 `MediaDesk.mountUploader` /
`MediaDesk.mountGallery` 를 쓰면 된다(각각 `unmount()` 핸들 반환).

## 접근성/디자인

- `:focus-visible` 키보드 링, `prefers-reduced-motion` 존중, 본문 대비 ≥ 4.5:1
- 드롭존은 `role="button"` + 키보드(Enter/Space), 진행률은 `role="progressbar"`, 목록은 `aria-live`
- 그라디언트 텍스트/글래스모피즘/사이드-스트라이프 보더 없음, 외부 CSS 프레임워크 0, `.md-*` 스코프 CSS

## 빌드

```bash
pnpm --filter @mediadesk/widget run build   # tsup(ESM/CJS/d.ts) + vite IIFE(dist/media-widget.js)
pnpm --filter @mediadesk/widget run dev:demo # 로컬 데모(:5293) — 로컬 API(:4191) 필요
```

## 벤더링(복붙) 버전

npm 발행이 막힌 동안에는 `apps-vendor/MediaWidgets.tsx` (react만 의존, 워크스페이스 deps 0)를 형제
앱에 복사해 동일한 `MediaUploader`/`MediaGallery` 를 쓸 수 있습니다.
