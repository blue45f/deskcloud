# AIDigestDesk

GPT, Claude, Gemini, Grok, Manus 등 주요 상용 AI/LLM 업데이트·벤치마크·기능 비교·사용법·강좌/도서 정보를 한국어로 큐레이션하는 포털입니다.

## 구조

- `apps/web` — React 19 + Vite 8 기반 포털 UI
- `packages/content` — 모델/벤치마크/리소스/출처 데이터, 편집실 운영 데이터, 검색·감사 순수 유틸

## 개발

```bash
pnpm install
pnpm run dev
```

기본 웹 포트는 `5297`입니다.

## 검증

```bash
pnpm run verify
```

`verify`는 타입체크, 테스트, 프로덕션 빌드를 순서대로 실행합니다.

## 배포

운영 배포는 Vercel production으로 수행합니다.

- 운영 URL: `https://aidigestdesk.vercel.app/`
- Vercel 프로젝트: `blue45fs-projects/aidigestdesk`
- 설정 파일: `vercel.json`
- 빌드 경로: `apps/web/dist`
- 빌드 명령: `pnpm run build`
- 설치 명령: `pnpm install --frozen-lockfile`

로컬 CLI 배포:

```bash
npx vercel deploy --prod --yes
```

GitHub Pages는 보조 정적 배포 경로로 유지합니다.

- 워크플로: `.github/workflows/deploy-pages.yml`
- 트리거: `main` 브랜치 push 또는 GitHub Actions 수동 실행
- URL: `https://blue45f.github.io/aidigestdesk/`
- Pages base path: `/aidigestdesk/`

로컬에서 Pages 경로를 검증할 때는 아래처럼 base path를 지정해 빌드합니다.

```bash
VITE_BASE_PATH=/aidigestdesk/ pnpm run verify
```

## 공식 소스 스냅샷

```bash
pnpm run snapshot:sources
```

이벤트 스케줄 정합성 검증(중복, TECA 교차검증, 날짜/상태 규칙)은 아래로 실행할 수 있습니다.

```bash
pnpm run verify:events
```

공식 문서와 벤치마크 출처를 가져와 이전 스냅샷과 본문 해시를 비교하고 `packages/content/data/source-snapshots.json`에 저장합니다. 네트워크 실패는 레코드의 `failed` 상태로 남기며 기존 콘텐츠 데이터는 변경하지 않습니다.

느린 소스만 재시도할 때는 환경변수로 타임아웃과 sourceId를 좁힐 수 있습니다.

```bash
SOURCE_SNAPSHOT_TIMEOUT_MS=60000 SOURCE_SNAPSHOT_IDS=manus-home pnpm run snapshot:sources
```

여러 소스는 쉼표로 구분합니다.

## 데이터 기준

초기 콘텐츠는 2026-06-17 기준으로 공식 문서와 공개 벤치마크를 확인해 작성했습니다. 각 항목은 앱 내부의 `소스` 섹션과 `packages/content/src/catalog.ts`에 원문 URL을 함께 보관합니다.

## 운영 워크플로

앱의 `편집실` 섹션은 포털을 계속 최신 상태로 유지하기 위한 운영 표면입니다.

- 소스 모니터링 큐: 공식 문서·벤치마크·한국어 강좌 소스를 우선순위와 확인 주기로 관리
- 업데이트 후보 파이프라인: 수집 → 검토 → 한국어 요약 → 게시 준비 → 게시 단계 추적
- 콘텐츠 품질 게이트: 출처 참조 무결성, ID 중복, 제공사 커버리지, 자동화 후보, 한국어 학습 자료 여부 검사
- 다음 기능 제안: 공식 소스 스냅샷 크롤러, 한국어 편집 워크벤치, 모델 비용 계산기 등 확장 후보
- 로컬 편집 워크벤치: 업데이트 후보 단계와 편집 메모를 브라우저 localStorage에 저장
- 모델 비용 계산기: 입력/출력 토큰과 월 실행 횟수 기준으로 주요 모델 예상 비용 비교
- 내보내기: 주간 뉴스레터 Markdown, 소스 모니터 CSV, 편집 파이프라인 JSON, 스냅샷 Runbook 다운로드/복사
- 직군별 플레이북: 개발자, PM, 마케터, 리서처별 추천 모델, 업무 흐름, 한국어 프롬프트, 검증 체크리스트 제공
