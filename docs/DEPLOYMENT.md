# DEPLOYMENT — TermsDesk

같은 코드베이스가 두 형태로 배포됩니다. `TERMSDESK_MODE`로 전환.

|              | self-hosted               | saas                           |
| ------------ | ------------------------- | ------------------------------ |
| 테넌트       | 싱글(기본 조직 자동 생성) | 멀티                           |
| DB           | 사내 PostgreSQL           | 관리형 PostgreSQL(Neon/Render) |
| 첫 부팅 시드 | 데모 데이터               | 없음(`pnpm db:seed`로 선택)    |
| 데이터 위치  | 자체 인프라               | 클라우드                       |

## 환경 변수 (apps/api)

| 변수                                       | 기본                                    | 설명                                    |
| ------------------------------------------ | --------------------------------------- | --------------------------------------- |
| `TERMSDESK_MODE`                           | `self-hosted`                           | `saas` \| `self-hosted`                 |
| `PORT`                                     | `4070`                                  | API 포트(Render는 자동 주입)            |
| `WEB_ORIGIN`                               | `http://localhost:5270`                 | CORS 대상                               |
| `DATABASE_URL`                             | (없음)                                  | 있으면 PostgreSQL, 없으면 PGlite 임베드 |
| `PGLITE_DIR`                               | `.data/pglite`                          | PGlite 폴백 데이터 디렉터리             |
| `JWT_SECRET`                               | dev-only                                | **운영 시 강한 무작위 값 필수**         |
| `COOKIE_SECURE`                            | `false`                                 | TLS(https) 종단 뒤에서 `true`           |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | admin@termsdesk.local / termsdesk-admin | self-hosted 최초 관리자                 |
| `PUBLIC_CACHE_TTL`                         | `60`                                    | 게시 응답 Cache-Control(초)             |

웹(`apps/web`, 빌드 타임): `VITE_API_BASE_URL`(비우면 동일 출처 `/api`).

## 사내 설치 (Docker Compose)

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build -d
# → http://localhost:8080   (web nginx → /api 프록시 → api:4070 → postgres)
```

- `postgres:16-alpine`(볼륨 `pgdata`) + `api`(멀티스테이지 `node:22-alpine`, 비루트) +
  `web`(빌드 → `nginx`, `/api`를 api로 프록시해 **단일 출처** → 세션 쿠키 정상).
- 단일 출처라 `COOKIE_SECURE=false`로 http에서도 로그인 동작. TLS 리버스 프록시
  뒤에 둘 경우 `COOKIE_SECURE=true`.

> **이미지 최적화(후속):** 현재 api 이미지는 워크스페이스 전체를 복사합니다. `pnpm deploy
--prod`로 api만 self-contained 추출하면 이미지가 작아집니다.

## SaaS (Render Blueprint)

[`render.yaml`](../render.yaml): `termsdesk-api`(Docker) + `termsdesk-web`(정적) +
`termsdesk-db`(관리형 Postgres).

1. Render에서 Blueprint로 repo 연결.
2. `termsdesk-web`의 `VITE_API_BASE_URL` = `termsdesk-api` URL.
3. `termsdesk-api`의 `WEB_ORIGIN` = `termsdesk-web` URL, `COOKIE_SECURE=true`.
4. `JWT_SECRET`은 `generateValue`로 자동 생성.

> 크로스 오리진(웹↔API 도메인 분리) 시 쿠키는 `SameSite=None; Secure`가 필요할 수 있습니다.
> 단일 도메인(웹이 `/api` 프록시) 구성이 가장 단순합니다.

## 운영 배포 — OCI Always-Free ARM (권장 self-hosted 운영)

[`deploy/oci/`](../deploy/oci/README.md): 단일 VM에서 **Caddy(자동 HTTPS) → web(nginx) → api →
postgres** 를 Docker Compose 로 운영(Caddy + cloud-init).

```bash
cd deploy/oci && cp .env.example .env   # DOMAIN/ACME_EMAIL/POSTGRES_PASSWORD/JWT_SECRET/관리자
docker compose up -d --build            # https://$DOMAIN
```

- `cloud-init.yaml` 으로 OCI Ampere A1 VM 부트스트랩(Docker + repo clone + 80/443 허용).
- 운영은 `TERMSDESK_SEED_DEMO=false`(데모 정책 미시드, 관리자만 보장), `COOKIE_SECURE=true`.
- OCI 콘솔의 Security List/NSG 에서 80·443 인바운드 허용 필수. 실제 VM 프로비저닝은 OCI
  계정·인증 필요(빌드/로컬 검증은 완료 상태).

## CI / 프론트 배포

- `.github/workflows/ci.yml`: PR/main push 에 **Verify 게이트**(format:check→lint→typecheck→
  test→build) + Postgres 서비스. Actions @v6, `pnpm/action-setup@v6`(버전은 packageManager 단일 소스).
- `.github/workflows/deploy-vercel.yml` + [`vercel.json`](../vercel.json): 웹 정적 빌드를 Vercel 에
  배포(`/api/*` 는 API 호스트로 rewrite → 동일 출처 쿠키). `VERCEL_TOKEN` 미설정 시 graceful skip.

## 헬스 체크

- `GET /health` · `/health/live` — liveness(DB 미접근)
- `GET /health/ready` — readiness(`SELECT 1`, 실패 시 503) → Render/k8s 트래픽 게이팅

## 마이그레이션

부팅 시 `src/db/migrations.ts`의 SQL을 `_migrations` 추적 테이블 기준으로 멱등 적용
(pg/PGlite 공통). 스키마 변경 시 새 migration을 배열에 append.
