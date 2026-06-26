# @heejun/platform-bridge

웹 ↔ 토스인앱(AppsInToss/Granite) **공통 플랫폼 능력 추상화**. 같은 서비스를 웹과 토스 미니앱으로 동시에 낼 때, 두 버전의 **코드 차이를 최소화**하기 위한 헤드리스 레이어다.

> 원칙: **"화면이 무엇을 보여줄지(what)는 공유하고, 어떻게 그리는지(how)와 네이티브 호출만 갈라진다."**
> 전체 표준: `heejun/docs/TOSS-MINIAPP-PLAYBOOK.md`

## 무엇을 추상화하나

공유·햅틱·클립보드·외부링크·익명식별키·딥링크 — 웹엔 없고 토스엔 있는(또는 구현이 다른) 네이티브 능력을 단일 `PlatformBridge` 인터페이스로 묶는다. 공유 코드는 `usePlatform()`만 호출하고 `if (isToss)` 분기를 하지 않는다.

## 설치

```sh
pnpm add @heejun/platform-bridge
# 토스 앱은 추가로(optional peer):
pnpm add @apps-in-toss/web-framework
```

`react`는 peer. `@apps-in-toss/web-framework`는 **optional peer** — `@heejun/platform-bridge/toss`를 import할 때만 필요하므로 웹 전용 앱은 설치하지 않아도 된다.

## 사용

### 웹 앱 (apps/web)

```tsx
import { PlatformContext, webPlatformBridge } from "@heejun/platform-bridge";
<PlatformContext.Provider value={webPlatformBridge}>
  <App />
</PlatformContext.Provider>;
```

### 토스 앱 (apps/toss)

```tsx
import { PlatformContext } from '@heejun/platform-bridge'
import { createTossPlatformBridge } from '@heejun/platform-bridge/toss'

// 앱별 차이(음소거 연동·공유 문구)만 옵션으로 주입, 나머지는 표준.
const bridge = createTossPlatformBridge({ hapticEnabled: () => !isSoundMuted() })

<PlatformContext.Provider value={bridge}>
  <App />
</PlatformContext.Provider>
```

### 공유 코드 (packages/client 뷰모델 등)

```ts
import { usePlatform } from "@heejun/platform-bridge";

function useUpdateDetailModel(id: string) {
  const platform = usePlatform();
  const onShare = () =>
    platform.share({ title: "[AI다이제스트]", text: update.title });
  return { onShare };
}
```

## API

`PlatformBridge`: `env` · `isInToss` · `share(input)` · `haptic(type?)` · `copyText(text)` · `openExternal(url)` · `getStableUserKey()` · `getEntryRoute()`.

- `share` 반환: `'shared' | 'copied' | 'dismissed' | 'unsupported'` (네이티브 → 웹 공유 → 클립보드 폴백)
- `webPlatformBridge`: 웹 표준 구현(토스 의존 없음)
- `createTossPlatformBridge(options?)`: 토스 구현(토스 밖에서는 웹 폴백)
- `copyTextToClipboard(text)`: 단독 사용 가능한 클립보드 유틸

## 빌드

tsup ESM+CJS+dts. `react`/`react-dom`/`@apps-in-toss/web-framework`는 external.
