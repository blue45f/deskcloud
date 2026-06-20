# @mediadesk/sdk

MediaDesk 브라우저 SDK — publishable 키(`pk_`)로 파일을 업로드하고, 변환 파라미터가 붙은 공개
자산 URL을 만든다. **의존성 0**, fetch/XHR 기반, SSR 안전(브라우저 API는 사용 시점에만 참조).

## 설치

```ts
import { createMediaDeskClient } from '@mediadesk/sdk'

const md = createMediaDeskClient({
  publishableKey: 'pk_xxx',
  endpoint: 'https://media.example.com',
})
```

## 업로드

```ts
const asset = await md.upload(file, {
  folder: 'avatars',
  onProgress: (fraction) => console.log(Math.round(fraction * 100), '%'),
})
console.log(asset.url) // 즉시 사용 가능한 공개 URL
```

`upload()` 는 진행률이 필요하면 XHR 로 보고하고, XHR 가 없는 환경(SSR/테스트)에서는 fetch 로
폴백한다. `AbortSignal` 로 취소할 수 있다.

## 변환 URL 빌더

```ts
const thumb = md.buildUrl(asset.key, { w: 240, h: 240, format: 'webp', q: 70 })
```

- `w` / `h` — 1–4000 px (벗어나면 클램프)
- `format` — `jpeg` | `png` | `webp` | `avif`
- `q` — 1–100

서버에 `sharp` 가 설치돼 있으면 온더플라이 변환(+파생 캐시), 없으면 원본을 서빙한다. 어느 쪽이든
URL 표면은 동일하다.

## 자산 목록

```ts
const { items, total } = await md.listAssets({ folder: 'avatars', limit: 60 })
```

## 보안

- **secret 키(`sk_`)는 절대 SDK에 넣지 마세요.** 브라우저 노출 금지. 자산 삭제/관리는 서버 SDK·
  어드민(또는 `ADMIN_TOKEN`) 몫입니다.
- publishable 키는 `Origin` 허용목록(테넌트별 CORS)과 함께 동작합니다.
