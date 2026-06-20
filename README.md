# DeskCloud — unified monorepo

DeskCloud SaaS 패밀리를 하나의 pnpm 모노레포로 통합한 저장소입니다. 각 구성요소는 원본 레포의
**git 히스토리를 보존**한 채 `git subtree` 로 합쳐졌습니다.

## 구조

| 경로 | 출처 (origin) | 역할 |
| --- | --- | --- |
| `platform/` | [desk-platform](https://github.com/blue45f/desk-platform) | `@desk/platform` 멀티테넌트 + 빌링 코어 (`packages/{shared,core,billing}` · `apps/{api,web}` · `vendor/`) |
| `desks/seo-gateway/` | [spa-seo-gateway](https://github.com/blue45f/spa-seo-gateway) | 다이내믹 렌더링 SEO 게이트웨이 (이미 saas 멀티테넌트 모드 보유) |
| `desks/remote-devtools/` | [remote-devtools](https://github.com/blue45f/remote-devtools) | CDP 기반 원격 디버깅 플랫폼 (백엔드·클라이언트·SDK·DevTools UI·Figma 플러그인) |

## 통합 목표 (방향)

1. **아키텍처 표준화** — 전 구성요소를 `@desk/*` 코어/계약으로 정렬, Fastify·TypeORM 발산 화해
2. **단일 요금/빌링** — 각자 요금제 폐기, 공유 플랜 + Desk별 PlanLimit·미터 오버리지 (최대한 저렴하게)
3. **단일 어드민/Ops 콘솔** — 표준 어드민 폐기, 공용 오퍼레이터 셸 + Desk별 도메인 패널
4. **디자인 패밀리** — 공유 DNA(OKLCH 토큰·셸·내비·배지) + Desk별 액센트/캐릭터 (균질화 아님)

> 현 단계: **저장소 물리 통합 완료**. 워크스페이스 완전 통합(install)·코드 와이어링은 아키텍처
> 플랜을 청사진으로 후속 진행.

## 개발

```bash
pnpm install   # (워크스페이스 통합 진행 중 — 아래 "현황" 참고)
```

원본 레포는 그대로 유지되며, 이 모노레포는 추가본입니다(되돌리기 안전).
