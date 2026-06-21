# STATUS — DeskCloud 현재 상태 (2026-06-21)

DeskCloud 생태계의 **현재 라이브/배포 상태**와 **풀스택 라이브까지 남은 단 한 단계**를 한 곳에 정리한
문서입니다. 상세는 각 문서를 참조: 배포 [DEPLOY.md](./DEPLOY.md) · 서비스 [SERVICES.md](./SERVICES.md) ·
빌링 [BUSINESS-MODEL.md](./BUSINESS-MODEL.md) · 생태계 [ECOSYSTEM.md](./ECOSYSTEM.md) ·
개발 [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 1. 지금 라이브

| 대상                                            | 상태                      | URL / 위치                           |
| ----------------------------------------------- | ------------------------- | ------------------------------------ |
| **DeskCloud 포털**(@desk/web)                   | 🟢 **LIVE** (Vercel prod) | https://desk-platform.vercel.app     |
| 포털 쇼케이스(랜딩·카탈로그·요금제·문서·디자인) | 🟢 동작                   | 전 라우트 200, 콘솔 에러 0           |
| 포털 콘솔(가입·로그인·대시보드)                 | 🟡 **비공개 프리뷰**      | 백엔드 연결 시 자동 활성화(아래 §3)  |
| 14개 API 서비스 + Caddy 게이트웨이              | ⚪ **배포 대기**          | 번들 검증 완료, 도커 호스트 필요(§3) |

포털 콘솔은 `CONSOLE_API_READY = Boolean(VITE_API_BASE_URL)` 게이트로, 백엔드 미연결 빌드에서는
깨진 폼 대신 "비공개 프리뷰" 안내를 보여줍니다. `VITE_API_BASE_URL` 만 설정해 재빌드하면 콘솔이
자동 활성화됩니다.

## 2. 완료된 기반 작업

- **14개 기능 Desk + 코어 + 포털 + 배포 번들** 구축(전부 blue45f private). 서비스 목록 [SERVICES.md](./SERVICES.md).
- **표준화 정렬**(2026-06-18): 전 형제 레포를 `@heejun/web-config-preset` 표준(eslint flat + RC +
  prettier + husky/commitlint + CI/coderabbit-gate)으로 정렬. fresh Desk 군은 eslint+prettier
  프리셋 신규 채택. 6개 보호 예외 준수. 전 레포 origin 동기화(unpushed 0).
- **#49 위젯**: SurveyDesk/Changelog/Notify/Search 등 벤더 위젯을 13개 통합앱 전부에 env-gated 적용
  (게이트 통과 커밋). 호스트 앱은 `VITE_*DESK_URL` 미설정 시 무영향.

## 3. 풀스택 라이브까지 — 남은 단 한 단계

**14개 API 서비스를 도커 호스트에서 기동**(설계상 유일한 외부 의존성):

```bash
# 도커 호스트(EC2/Fly/Railway 등)에서, deskcloud 모노레포가 같은 부모 디렉터리에 있는 상태로
cd ~/WebstormProjects/deskcloud/deploy/stack
./gen-env.sh                      # ADMIN_TOKEN 등 시크릿 생성(openssl)
docker compose up -d --build      # 14개 API 서비스 + Caddy 게이트웨이 (PGlite 기본, 외부 DB 불필요)
```

기동 후 `https://<host>/<desk>/health` 가 200 이면 정상(로컬 검증: 14/14 health 200). 상세·풋프린트·
Neon 승격은 [DEPLOY.md](./DEPLOY.md).

### 기동 후 env 연결

| 위치                    | 변수                                             | 값(예)                                                     |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| 포털(@desk/web, Vercel) | `VITE_API_BASE_URL`                              | `https://<host>` (게이트웨이 `/platform` 또는 전용 도메인) |
| 각 통합앱(13개)         | `VITE_SURVEYDESK_URL`                            | `https://<host>/survey`                                    |
|                         | `VITE_CHANGELOGDESK_URL`                         | `https://<host>/changelog`                                 |
|                         | `VITE_NOTIFYDESK_URL`                            | `https://<host>/notify`                                    |
|                         | `VITE_SEARCHDESK_URL`                            | `https://<host>/search`                                    |
|                         | `VITE_REVIEWDESK_URL` · `VITE_MEDIADESK_URL` · … | `https://<host>/<desk>`                                    |

각 앱 위젯은 해당 `VITE_*DESK_URL` 이 설정될 때만 렌더되므로, 원하는 Desk 만 점진적으로 켤 수
있습니다. 포털은 `VITE_API_BASE_URL` 재빌드 시 콘솔(가입·로그인·대시보드)이 즉시 활성화됩니다.

> 참고: realtime/chat Desk 는 WebSocket(IoAdapter) 이라 도커(상시 프로세스) 호스팅이 필수입니다
> — 서버리스(Vercel 함수)로는 동작하지 않으므로 설계상 도커 번들 경로를 따릅니다.
