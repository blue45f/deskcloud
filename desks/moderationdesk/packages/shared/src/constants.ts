/** 모더레이션 판정 — allow(통과) | flag(주의/검토) | block(차단). 강도: allow < flag < block. */
export const VERDICTS = ['allow', 'flag', 'block'] as const
export type Verdict = (typeof VERDICTS)[number]

/** 금칙 규칙 매칭 종류 — exact(완전일치) | substring(부분일치) | regex(정규식). */
export const RULE_KINDS = ['exact', 'substring', 'regex'] as const
export type RuleKind = (typeof RULE_KINDS)[number]

/**
 * 규칙 액션 — 매칭 시 어떤 판정을 유발하는가.
 *   block  → verdict block
 *   flag   → verdict flag
 *   review → verdict flag (운영자 검토 대상으로 분류하되 차단은 아님)
 */
export const RULE_ACTIONS = ['block', 'flag', 'review'] as const
export type RuleAction = (typeof RULE_ACTIONS)[number]

/** 신고 상태 — open(접수) → reviewing(검토중) → resolved(처리됨) | dismissed(기각). */
export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** 요금제 — free 는 소프트 한도가 적용된다. */
export const PLANS = ['free', 'pro', 'scale'] as const
export type Plan = (typeof PLANS)[number]

/** 무료 플랜 기본 소프트 한도(누적 검사). 초과 시 검사 402. env(FREE_PLAN_LIMIT)로 덮어쓸 수 있음. */
export const FREE_PLAN_LIMIT = 1000

/** 테넌트 slug — 소문자·숫자·하이픈, 1~64자. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 발급 키 접두사 — publishable(브라우저 안전) / secret(서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 입력 길이 한도. */
export const MODERATE_TEXT_MAX = 20_000
export const RULE_PATTERN_MAX = 500
export const RULE_LABEL_MAX = 120
export const REPORT_REASON_MAX = 1000
export const REPORT_NOTES_MAX = 4000
export const SUBJECT_TYPE_MAX = 60
export const SUBJECT_ID_MAX = 200
export const REPORTER_ID_MAX = 200

/**
 * AI 보조(선택) — 작고 저렴한 Claude 모델 기본값. env(MODERATION_AI_MODEL)로 덮어쓸 수 있음.
 * (claude-api 스킬 기준 small/cheap 모델.)
 */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5'

/** AI 독성 점수가 이 임계값 이상이면 verdict 를 flag 로 격상(block 은 규칙만이 내림). */
export const AI_FLAG_THRESHOLD = 0.5
