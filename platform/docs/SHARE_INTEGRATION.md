# 공유(Share) 공통 모듈 가이드

형제 앱의 제각각인 "공유하기/링크 복사"를 단일 모듈로 통합한다. 네이티브 공유 시트(Web Share
API)가 있으면 그걸 쓰고, 없거나 사용자가 취소하면 클립보드 복사로 폴백한다. 프레임워크/디자인
의존성이 없어 그대로 벤더링한다(inquiry·firebaseAuth와 동일 전략).

## 모듈 (각 앱 `src/lib/share/`)

- `shareOrCopy.ts` — 순수 함수 `shareOrCopy({ title?, text?, url? }): Promise<ShareResult>`.
  - `'shared'` 네이티브 공유 완료 / `'copied'` 클립보드 복사 / `'dismissed'` 사용자 취소 /
    `'unsupported'` 둘 다 불가. SSR·비브라우저에서 throw하지 않음.
  - 폴백 순서: `navigator.share` → `navigator.clipboard.writeText` → 레거시 `execCommand`.
- `ShareButton.tsx` — portable 버튼. `className`/`children`/`copiedLabel`/`onShared`로 앱 디자인에
  맞춤. 복사 폴백 시 1.6초간 "링크 복사됨" 라벨 + `aria-live` 안내.
- `index.ts` — 배럴.

## 사용

```tsx
import { shareOrCopy, ShareButton } from '@/lib/share'

// 명령형
const result = await shareOrCopy({ title: '제목', text: '설명', url: location.href })

// 선언형(앱 토큰 클래스 주입)
<ShareButton className="btn" title="제목" url={pageUrl} onShared={(r) => toast(r === 'copied' ? '복사됨' : '')} />
```

## 롤아웃 원칙

- 기존 ad-hoc 공유/복사 로직을 이 모듈로 치환(동작 보존). `url` 생략 시 현재 페이지.
- 앱별 토스트/스타일은 `onShared`/`className`으로만 주입하고 모듈 내부는 손대지 않는다.
