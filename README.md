# SurveyDesk

멀티테넌트(`appId`) **설문·피드백 수집 SaaS**(또는 셀프호스팅). TermsDesk의 자매 프로젝트로,
같은 형제 앱 생태계 안에서 동작합니다. 형제 앱들이 임베드 위젯으로 별점·NPS·객관식·자유서술
응답을 보내면, SurveyDesk가 이를 저장하고 운영자에게 집계(응답 수·평균 별점·NPS·선택지 분포·
최근 자유서술)를 제공합니다.

> SurveyDesk는 설문 **수집·집계·게시**만 담당합니다. 각 앱(`appId`)이 자신의 설문 구성을 소유합니다.

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11
- **apps/api** — NestJS 11 + Drizzle ORM · nestjs-zod 검증 · helmet · throttler
- **packages/shared** — Zod 스키마 · 도메인 타입 · 집계 유틸 (api·web·sdk 공유)
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 도메인 (멀티테넌트 — `appId` 로 격리)

- **Survey**: 앱별 설문 구성 = `{ appId, title, intro, questions[], active, version }`.
  질문 타입: `rating`(별점 1–5) · `nps`(0–10) · `single_choice` · `multi_choice` ·
  `text`(short/long). 각 질문 = `{ id, type, label, required, options? }`.
- **SurveyResponse**: `{ id, appId, surveyVersion, answers(qid→value), respondent?(userId/email),
  meta{ pageUrl, userAgent, referrer }, createdAt }`.

## API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/surveys/:appId/active` | 위젯용 활성 설문 스키마 | 공개(CORS 개방) |
| POST | `/api/surveys/:appId/responses` | 응답 제출(활성 설문 기준 검증, throttled) | 공개 |
| GET | `/api/admin/surveys/:appId/responses` | 응답 목록(페이지네이션) | `X-Admin-Token` |
| GET | `/api/admin/surveys/:appId/summary` | 집계(수·평균 별점·NPS·선택지 분포·최근 자유서술) | `X-Admin-Token` |
| GET | `/api/admin/surveys/:appId` | 설문 목록(버전 이력) | `X-Admin-Token` |
| POST | `/api/admin/surveys/:appId` | 설문 생성(새 버전) | `X-Admin-Token` |
| PUT | `/api/admin/surveys/:appId/:version` | 설문 수정 | `X-Admin-Token` |
| POST | `/api/admin/surveys/:appId/:version/activate` | 설문 활성화 | `X-Admin-Token` |

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @surveydesk/shared 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 4090)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 설문(`demo`, `offhours`)과 샘플 응답을 시드하므로
집계 화면이 바로 채워집니다.

```bash
# 활성 설문 조회
curl http://localhost:4090/api/surveys/demo/active

# 응답 제출
curl -X POST http://localhost:4090/api/surveys/demo/responses \
  -H 'content-type: application/json' \
  -d '{"answers":{"q_rating":5,"q_nps":9,"q_text":"좋아요"},"meta":{"pageUrl":"https://demo.example/app"}}'

# 어드민 집계(토큰 필요 — .env 의 ADMIN_TOKEN 값 사용)
curl http://localhost:4090/api/admin/surveys/demo/summary \
  -H "x-admin-token: $ADMIN_TOKEN"
```

## 검증

```bash
pnpm run verify   # typecheck + test + build
```
