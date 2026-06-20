# AuthDesk

**드롭인 로그인/인증 모듈**(auth-as-a-service). DeskCloud SaaS 패밀리의 형제 앱으로,
SurveyDesk·TermsDesk와 같은 멀티테넌트(`pk_`/`sk_`) 생태계 안에서 동작합니다. 각 테넌트는
자기만의 **최종 사용자(end-user) 풀**을 갖고, 형제 앱은 임베드 `<AuthForm>` 위젯/SDK 로
사용자 가입·로그인을 위탁합니다. 운영자는 사용자 수·가입·로그인 통계를 봅니다.

> AuthDesk는 **end-user 인증**(email+password+JWT)만 담당합니다. 각 테넌트(`pk_`/`sk_` 키 보유)가
> 자신의 사용자 풀을 소유합니다. 테넌트 키와 end-user 인증을 혼동하지 마세요.

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11
- **apps/api** — NestJS 11 + Drizzle ORM · nestjs-zod 검증 · helmet · throttler · argon2 · JWT(HS256)
- **packages/shared** — Zod 스키마 · 도메인 타입 · 키/플랜/사용량 상수 (api·web·sdk 공유)
- **packages/widget** — 임베드 `<AuthForm>` React 컴포넌트 + 작은 SDK + 바닐라 IIFE 로더
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 도메인 (멀티테넌트 — 테넌트별 end-user 풀)

- **EndUser**: `{ tenantId, email(테넌트별 유니크), passwordHash(argon2), name, verified, createdAt }`.
- **Session**: `{ token(JWT), userId, expiresAt }`. JWT 는 HS256, 테넌트별 비밀(pepper+tenantId 파생)로 서명.

## API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 테넌트 가입(키 발급) | 공개 |
| POST | `/api/auth/register` | end-user 가입 → `{ user, token }` | `pk_` + CORS |
| POST | `/api/auth/login` | end-user 로그인 → `{ user, token }` | `pk_` + CORS |
| GET | `/api/auth/me` | 내 정보 | end-user JWT(Bearer) |
| POST | `/api/auth/logout` | 세션 폐기 | end-user JWT(Bearer) |
| GET | `/api/auth/users` | 사용자 목록(페이지네이션) | `sk_` |
| DELETE | `/api/auth/users/:id` | 사용자 삭제 | `sk_` |
| GET | `/api/auth/stats` | 사용자 수·가입·로그인 통계 | `sk_` |

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @authdesk/shared 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 4110)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 테넌트(`pk_demo…`/`sk_demo…`)와 샘플 end-user 를
시드하고, 발급된 키를 부팅 로그로 안내합니다(통계 화면이 바로 채워집니다).

```bash
# (부팅 로그에서 pk_…/sk_… 를 복사한 뒤)
PK=pk_xxx; SK=sk_xxx

# end-user 가입(publishable 키 + Origin)
curl -X POST http://localhost:4110/api/auth/register \
  -H 'content-type: application/json' \
  -H "x-authdesk-key: $PK" -H 'origin: http://localhost:5310' \
  -d '{"email":"a@example.com","password":"hunter2!pw","name":"Aria"}'

# end-user 로그인
curl -X POST http://localhost:4110/api/auth/login \
  -H 'content-type: application/json' \
  -H "x-authdesk-key: $PK" -H 'origin: http://localhost:5310' \
  -d '{"email":"a@example.com","password":"hunter2!pw"}'

# 어드민 통계(secret 키)
curl http://localhost:4110/api/auth/stats -H "authorization: Bearer $SK"
```

## 보안

- 비밀번호는 **argon2id** 로만 저장합니다. secret 키는 SHA-256(키+pepper) 해시로만 저장합니다.
- 비밀번호·토큰·키 평문을 **절대 로그에 남기지 않습니다**.
- auth 라우트(register/login)는 throttler 로 추가 rate-limit 합니다.
- OAuth/소셜 로그인은 **향후 확장**입니다 — 코어는 email+password+JWT.

## 검증

```bash
pnpm run verify   # lint + typecheck + test + build
```
