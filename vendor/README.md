# vendor/ — 벤더 단일파일

npm publish 가 막힌 환경에서 각 Desk가 **복사해 쓰는** 자급자족 파일들입니다.
워크스페이스 의존(`@desk/*`) 없이 단독으로 동작하도록 의도적으로 중복을 허용했습니다.

| 파일 | 용도 | 의존 |
| --- | --- | --- |
| `plan-limits.ts` | DESK_PLANS 맵 + `checkLimit()`(soft/hard cap) + `shouldShowBadge()` — `tenant.plan` 한도 강제 | zero-dep |
| `PoweredByDeskCloud.tsx` | 'Powered by DeskCloud' 배지(Free 노출, 유료 제거) | React 만 |

> 값이 바뀌면 `packages/billing/src/limits.ts`(DESK_PLANS·기능 플래그)·`enforce-limit.ts`(checkLimit)
> 와 함께 갱신하세요(단일 소스 드리프트 금지).
> 단일 소스를 쓸 수 있는 Desk(같은 모노레포)는 `@desk/billing` / `@desk/shared` import 를 권장합니다.
> (참고: `@desk/core` 의 UsageMeter 는 별도의 코어 메트릭 키 `api_calls·events·storage_mb·seats` 를
> 쓰며, 이는 `packages/shared/src/plans.ts` 의 PLAN_LIMITS 가 단일 소스입니다.)
