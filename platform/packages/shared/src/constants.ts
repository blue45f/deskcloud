/** 구독 플랜 식별자 — 모든 Desk가 `tenant.plan` 으로 읽어 한도를 강제한다. */
export const PLANS = ['free', 'pro', 'scale', 'enterprise'] as const
export type Plan = (typeof PLANS)[number]

/** 멤버(좌석) 역할 — owner 1명 + admin/member 다수. */
export const MEMBER_ROLES = ['owner', 'admin', 'member'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

/** 사용량 미터링 메트릭 — Desk별 과금/한도의 기준 단위. */
export const USAGE_METRICS = [
  'api_calls', // 모든 Desk 공통: API 호출 수
  'events', // 수집 이벤트(응답·리뷰·알림 발송 등)
  'storage_mb', // 저장 사용량(MiB)
  'seats', // 점유 좌석 수(스냅샷성 메트릭)
] as const
export type UsageMetric = (typeof USAGE_METRICS)[number]

/** API 키 프리픽스 — 한눈에 종류를 구분(publishable=공개 안전, secret=서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(prefix 제외) 길이 — 24바이트 → base64url 32자. */
export const KEY_RANDOM_BYTES = 24

/** slug — 테넌트 식별 슬러그. 소문자/숫자/하이픈, 1~64자(appId 규약과 동일). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 사용량 집계 기간 — 'current' 는 진행 중인 달(UTC), 그 외 'YYYY-MM'. */
export const USAGE_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** 한도 무제한 표식 — PlanLimit 의 -1 은 "제한 없음". */
export const UNLIMITED = -1

/**
 * 문의(Inquiry) 카테고리 — 모든 Desk·형제 앱이 공통 게시판으로 쓰는 분류.
 * partnership=제휴 문의 · bug=사이트 버그 신고 · feedback=사이트 의견 · usage=이용 문의.
 */
export const INQUIRY_CATEGORIES = ['partnership', 'bug', 'feedback', 'usage'] as const
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]

/** 카테고리 한글 라벨 — 위젯/게시판 UI 표시용. */
export const INQUIRY_CATEGORY_LABELS: Readonly<Record<InquiryCategory, string>> = {
  partnership: '제휴 문의',
  bug: '사이트 버그 신고',
  feedback: '사이트 의견',
  usage: '이용 문의',
}

/** 문의 처리 상태 — new(접수) → in_progress(처리 중) → resolved(완료) → closed(종료). */
export const INQUIRY_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

/** 상태 한글 라벨 — 어드민 트리아지 UI 표시용. */
export const INQUIRY_STATUS_LABELS: Readonly<Record<InquiryStatus, string>> = {
  new: '접수',
  in_progress: '처리 중',
  resolved: '완료',
  closed: '종료',
}

/** 공개 게시판 목록 최대 페이지 크기(서버 캡). */
export const INQUIRY_LIST_MAX_LIMIT = 50

/**
 * 방문 핑 1회당 최대 증가량 — 봇이 큰 값을 보내도 서버가 1로 캡한다.
 * 클라이언트는 항상 1을 의미하지만, 계약상 명시적 상한을 둔다.
 */
export const VISITS_PING_MAX = 1

/** 일자 형식 — 방문 집계 버킷 키('YYYY-MM-DD', UTC). */
export const VISIT_DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
