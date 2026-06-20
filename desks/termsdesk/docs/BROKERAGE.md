# 약관 의뢰 중계 (Brokerage)

TermsDesk 의 **중계 레이어**. 약관 작성·검토·개정·번역이 필요한 의뢰자(회사)와 이를 수행할
전문가(검토자·작성자)를 잇고, 운영자(중계자)가 검수·중재합니다.

> **포지셔닝**: 플랫폼은 약관을 _직접 작성하지 않습니다_. 전문가를 **연결**하고, 진행을
> 관리하며, 완료된 산출물을 기존 **버전 관리(정책 버전)** 로 넘기는 "중계"만 담당합니다.
> 금액(견적·예산)은 메타데이터일 뿐 **실제 자금 이동은 없습니다**(결정만 기록).

## 행위자

| 행위자            | 정의                               | 권한 게이트                                     |
| ----------------- | ---------------------------------- | ----------------------------------------------- |
| 의뢰자(Requester) | 약관 작업이 필요한 조직의 멤버     | `request.read` / `request.manage` (역할 기반)   |
| 전문가(Provider)  | 작성·검토 서비스를 제공하는 사용자 | **활성 전문가 프로필**(opt-in) 보유 — 역할 무관 |
| 운영자(Broker)    | 플랫폼 중계·검수·중재              | 첫(가장 오래된) 조직 소속 + `member.manage`     |

크로스-조직 마켓플레이스다. 의뢰는 **조직**에 귀속되고, 제안·전문가 프로필은 **사용자**에
귀속된다(전문가는 자기 조직과 무관하게 다른 조직의 의뢰를 수행할 수 있다).

## 데이터 모델 (마이그레이션 `0007_brokerage` + `0011_disputes` + `0012_request_attachments`)

- `service_requests` — 의뢰(조직 귀속). 상태·예산·마감·배정 전문가.
  - `flagged`/`dispute_note` — 참여자 신고·이의제기와 운영자 분쟁 검토 메모.
- `request_proposals` — 제안/견적(사용자 귀속). 의뢰당 전문가 1개(unique).
- `request_messages` — 매칭 이후 스레드(의뢰자 ↔ 전문가 ↔ 운영자). `kind`: message / delivery / system.
- `request_attachments` — 참고자료·산출물 파일 메타데이터. 객체는 외부 S3/R2 호환 스토리지에 저장하고 API가 다운로드를 프록시한다.
- `provider_profiles` — 전문가 프로필(사용자당 1개). 검증 배지·전문분야·완료 누적.

스냅샷 원칙: `requester_user_id`/`provider_user_id` 등은 FK 없는 스냅샷(이름도 스냅샷)으로
사용자 삭제와 분리한다.

## 의뢰 상태 흐름

```
open ──(제안 수락)──▶ matched ──(전문가 시작)──▶ in_progress ──(산출물 제출)──▶ delivered ──(의뢰자 확인)──▶ completed
  │                      │                          │                              │
  │                      │                          ◀────────(검수 반려)───────────┘
  └──────────────────────┴──────────────────────────┴──────────────────────────────┴──▶ cancelled (의뢰자/운영자)
```

- **제안 수락**: 수락된 제안 외 나머지는 자동 `rejected`, 의뢰는 `matched` + 전문가 배정 + 시스템 메시지.
- **산출물 제출**: 배정 전문가가 `kind:'delivery'` 메시지(+선택 첨부) → `delivered`.
- **검수 반려**: 의뢰자가 재작업 사유를 남기면 `delivered → in_progress` 로 되돌아간다.
- **완료**: 의뢰자 확인 → `completed`, 전문가 `completed_count++`.
- **분쟁/이의제기**: 참여자·운영자가 의뢰 또는 메시지를 flag 처리하면 운영자 분쟁 큐에 노출된다.
- **운영자 결정**: 운영자는 분쟁을 해제하거나, 보증 중인 모의 에스크로를 정산(`released`)·환불(`refunded`)로 결정할 수 있다. 실제 자금 이동은 없다.
- 완료된 산출물은 기존 정책 버전 생성으로 이어질 수 있다(증거 인프라와의 연결점).

## 접근 제어

- 의뢰 상세(`GET /requests/:id`): 참여자(의뢰 조직 멤버 · 배정 전문가 · 제안 작성자) 또는 운영자만.
  그 외에는 **존재 여부를 누설하지 않도록 동일한 404**.
- 제안 가시성: 의뢰자/운영자는 전체, 전문가는 **본인 제안만**.
- 마켓플레이스: `visibility=public` & `status=open` 만 노출. 의뢰자 담당자명(`requesterName`)은 **null**(프라이버시).
- 전문가 디렉터리: 활성 프로필만, 공개 디렉터리에서는 `contact` 를 항상 null 로 숨긴다. 인증 디렉터리에서도 `contact` 는 본인·운영자에게만.
- 분쟁 메모(`disputeNote`)는 참여자·운영자에게만 노출된다. 비참여 guest/마켓 뷰에는 `flagged=false`, `disputeNote=null` 로 숨긴다.
- 첨부 다운로드는 의뢰 참여자·운영자만 가능하다. S3 객체 URL은 클라이언트에 직접 노출하지 않고 API가 권한 확인 후 파일을 내려준다.
- 모든 상태 변경은 `AuditService.record` 로 감사 로그에 남는다.

## API 엔드포인트

세션 쿠키 인증. 자세한 계약은 `apps/web/src/services/brokerage.ts`(웹 훅)와 1:1 대응.

| 메서드·경로                                          | 설명                        |
| ---------------------------------------------------- | --------------------------- |
| `POST /requests`                                     | 의뢰 생성 (request.manage)  |
| `GET /requests?scope=mine\|assigned\|proposed`       | 개인 뷰(의뢰자/전문가)      |
| `GET /requests/:id`                                  | 의뢰 상세(제안+스레드)      |
| `PATCH /requests/:id`                                | 의뢰 수정(open 상태)        |
| `POST /requests/:id/cancel\|complete\|start`         | 상태 전이                   |
| `POST /requests/:id/request-revision`                | 검수 반려·재작업 요청       |
| `POST /requests/:id/flag`                            | 신고·이의제기               |
| `POST /requests/:id/proposals`                       | 제안 제출(전문가)           |
| `POST /requests/:id/proposals/:pid/accept\|withdraw` | 수락(의뢰자)/철회(전문가)   |
| `POST /requests/:id/messages`                        | 스레드 메시지/산출물        |
| `POST /requests/:id/attachments`                     | 참고자료·산출물 파일 업로드 |
| `GET /requests/:id/attachments/:attachmentId`        | 첨부 다운로드               |
| `GET /marketplace`                                   | 공개 의뢰 탐색              |
| `GET·PUT /providers/me`                              | 내 전문가 프로필            |
| `GET /providers`, `GET /providers/:id`               | 전문가 디렉터리             |
| `GET /public/providers`, `GET /public/providers/:id` | 공개 전문가 디렉터리        |
| `GET /brokerage/stats`                               | 중계 현황 요약              |
| `GET·PATCH /brokerage/admin/requests[/:id]`          | 운영자 의뢰/분쟁 모더레이션 |
| `GET·PATCH /brokerage/admin/providers[/:id]`         | 운영자 전문가 검증          |

## 웹 화면

- `/app/requests` — 내 의뢰(의뢰자 워크스페이스) + 생성
- `/app/requests/:id` — 의뢰 상세 허브(역할별 액션 분기)
- `/app/marketplace` — 공개 의뢰 탐색 + 내 제안 + 진행 중 작업(전문가)
- `/app/expert` — 전문가 프로필 등록·수정
- `/app/moderation` — 운영자 모더레이션(의뢰·전문가)
- `/experts`·`/experts/:id` — 비로그인 공개 전문가 디렉터리/프로필(연락처 비노출)

## 토스 인앱

반응형·모바일 우선으로 설계되어 Apps-in-Toss WebView 미니앱으로 노출 가능하다.
환경 감지는 `apps/web/src/utils/tossEnv.ts`(`isTossInApp`/`useTossInApp`), 연동 가이드는
[docs/TOSS-INAPP.md](./TOSS-INAPP.md) 참고.
