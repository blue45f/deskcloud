# DeskCloud Admin Operations

이 문서는 운영 콘솔의 어드민 토큰 계정 모델과 권한 범위를 정리합니다. 실제 토큰 원문은 Git에
커밋하지 않고 로컬 전용 `.local/admin-accounts.md`와 운영 `.env`에만 보관합니다.

## Token Model

`@desk/platform` API는 `X-Admin-Token` 헤더로 어드민 API 접근을 제한합니다.

- Legacy 단일 토큰: `ADMIN_TOKEN`
- 운영자별 다중 토큰: `ADMIN_ACCOUNTS`
- Docker 배포 스택의 실제 변수: `DESKPLATFORM_ADMIN_ACCOUNTS`

`ADMIN_ACCOUNTS` 형식:

```text
id|label|role|scope+scope|token;id|label|role|scope|token
```

## Roles

| Role       | 용도                     | 기본 사용처                         |
| ---------- | ------------------------ | ----------------------------------- |
| `owner`    | 전체 운영 책임자         | 배포, 장애 대응, 토큰 회전          |
| `operator` | 일상 운영 담당           | 문의 처리, 워크스페이스 상태 확인   |
| `support`  | 고객 지원/문의 응대 담당 | 문의 조회 및 상태 처리              |
| `auditor`  | 감사/읽기 전용 확인 담당 | 문의/운영 상태 읽기, 변경 작업 금지 |

## Scopes

| Scope             | 설명                                |
| ----------------- | ----------------------------------- |
| `admin:*`         | 모든 어드민 작업 허용               |
| `inquiries:read`  | 문의 목록/요약 조회                 |
| `inquiries:write` | 문의 상태 변경                      |
| `workspace:read`  | workspace Desk manifest/parity 확인 |
| `tenant:read`     | 테넌트 설정 조회                    |
| `tenant:write`    | 테넌트 설정/도메인 allowlist 변경   |
| `billing:read`    | 플랜/구독/사용량 조회               |
| `billing:write`   | 플랜 변경, 결제 provider 관리 작업  |

문의 관리 API는 `inquiries:read`를 요구하고, 상태 변경은 `inquiries:read`와 `inquiries:write`를 모두
요구합니다. `admin:*`는 모든 scope를 포함합니다.

## Local Secret Record

실제 발행 계정은 아래 로컬 문서에 정리합니다.

```text
.local/admin-accounts.md
```

이 경로는 `.gitignore`에 포함되어 GitHub로 올라가지 않습니다. 운영 토큰을 재발행하면 같은 파일에
발행일, 역할, scope, 검증 결과, 회전 사유를 남깁니다.

## Verification

운영 검증 시 토큰 원문은 출력하지 않고 상태만 확인합니다.

```bash
pnpm run verify:dashboard
```

권장 API 확인은 실제 운영 토큰을 `.local/admin-accounts.md`에서 읽어 아래처럼 수행한다.

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://desk-platform.vercel.app/api/v1/apps/termsdesk/inquiries/admin
curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://desk-platform.vercel.app/api/v1/apps/seo-gateway/inquiries/admin

# 상태 변경은 아래 형태. :id는 admin 조회 응답에서 추출
curl -X PATCH \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}' \
  https://desk-platform.vercel.app/api/v1/apps/termsdesk/inquiries/admin/$INQUIRY_ID/status
```
