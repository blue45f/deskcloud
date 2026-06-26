# Platform Bridge 통합 가이드 (@heejun/platform-bridge)

> 같은 서비스를 **웹 + 토스인앱(AppsInToss)** 두 버전으로 낼 때, **코드 차이를 최소화**하기 위한 공통 패키지.
> 형제 레포(webtoon-index·aidigestdesk·picky·rotifolk 등) 공통. 아키텍처 표준은 `heejun/docs/TOSS-MINIAPP-PLAYBOOK.md`.

## 정본 위치

`deskcloud/packages/platform-bridge/` (이 모노레포). npm: **`@heejun/platform-bridge`**(public).
`@heejun/deskcloud`(packages/deskcloud-sdk)와 동일하게 deskcloud에서 발행·유지보수한다.

> 연혁: 원래 `desk-platform/packages/platform-bridge`에서 0.1.0을 발행했으나, **desk-platform 레포가 DeskCloud 통합 컷오버(2026-06-24)로 archive**되어 정본을 살아있는 deskcloud로 이전했다. 차기 버전(0.1.1+)은 여기서 발행한다.

## 왜 필요한가

웹과 토스의 본질적 차이는 둘뿐이다: ① 프레젠테이션(웹=Tailwind/Radix vs 토스=TDS), ② 네이티브 기능(공유·햅틱·클립보드·외부링크·익명식별키·딥링크). 이 패키지는 ②를 단일 `PlatformBridge` 인터페이스로 묶어, 공유 코드가 `if (isToss)` 분기 없이 `usePlatform()`만 호출하게 한다.

## 설치 (소비 레포)

```sh
pnpm --filter <app> add @heejun/platform-bridge
# 토스 앱만 추가(이미 있으면 생략): pnpm --filter <toss-app> add @apps-in-toss/web-framework
```

`react`=peer, `@apps-in-toss/web-framework`=**optional** peer(`/toss` import 시에만 필요). 신규 발행 직후 소비 레포가 `minimumReleaseAge`를 강제하면 `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 `@heejun/platform-bridge@<ver>` 추가.

## 적용 패턴

1. **웹 셸**: `<PlatformContext.Provider value={webPlatformBridge}>` 로 감싼다(웹은 추가 코드 0).
2. **토스 셸**: `createTossPlatformBridge({ hapticEnabled: () => !isMuted() })`(`@heejun/platform-bridge/toss`) 결과를 Provider로 주입. 앱별 차이(음소거 연동·공유 문구)만 옵션으로.
3. **공유 코드/뷰모델**: `const platform = usePlatform()` → `platform.share(...)` / `haptic()` / `openExternal()`.

레퍼런스 적용: aidigestdesk·picky·rotifolk·webtoon(전부 적용 완료).

## API

`PlatformBridge`: `env` · `isInToss` · `share(input)` · `haptic(type?)` · `copyText(text)` · `openExternal(url)` · `getStableUserKey()` · `getEntryRoute()`. `share` 반환 = `'shared'|'copied'|'dismissed'|'unsupported'`.

## 버전 관리 / 발행

```sh
cd packages/platform-bridge
# 코드 변경 후 version 올린 뒤
pnpm run build && npm publish --access public
```

인터페이스 변경(메서드 추가/시그니처 변경)은 minor 이상으로 올리고 이 문서 + `heejun/docs/TOSS-MINIAPP-PLAYBOOK.md §4` 동기화. 소비 레포는 `^0.1.0` 캐럿으로 자동 수신.
