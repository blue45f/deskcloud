/** 게시판 종류 — board(일반 게시판) | cafe(카페/그룹). */
export const BOARD_KINDS = ['board', 'cafe'] as const
export type BoardKind = (typeof BOARD_KINDS)[number]

/** 콘텐츠 상태 — visible(노출) | hidden(숨김, 운영자) | pending(검수 대기). */
export const CONTENT_STATUSES = ['visible', 'hidden', 'pending'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** 반응 대상 종류 — 글(post) | 댓글(comment). */
export const REACTION_TARGETS = ['post', 'comment'] as const
export type ReactionTarget = (typeof REACTION_TARGETS)[number]

/** 허용 반응 종류(이모지 키). 토글 방식 — 같은 멤버가 같은 kind 를 다시 누르면 해제. */
export const REACTION_KINDS = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]

/** 글 운영 액션 — 어드민 PATCH 의 action 필드. */
export const POST_MODERATION_ACTIONS = [
  'show',
  'hide',
  'pin',
  'unpin',
  'lock',
  'unlock',
  'approve',
] as const
export type PostModerationAction = (typeof POST_MODERATION_ACTIONS)[number]

/** 댓글 운영 액션. */
export const COMMENT_MODERATION_ACTIONS = ['show', 'hide', 'approve'] as const
export type CommentModerationAction = (typeof COMMENT_MODERATION_ACTIONS)[number]

/** 글 목록 정렬 — recent(최신) | popular(반응순) | replies(댓글순). 고정글은 항상 먼저. */
export const POST_SORTS = ['recent', 'popular', 'replies'] as const
export type PostSort = (typeof POST_SORTS)[number]

/** 요금제 — free 는 소프트 한도가 적용된다. */
export const PLANS = ['free', 'pro', 'scale'] as const
export type Plan = (typeof PLANS)[number]

/** 무료 플랜 기본 소프트 한도(누적 글 작성). 초과 시 작성 402. env(FREE_PLAN_LIMIT)로 덮어쓸 수 있음. */
export const FREE_PLAN_LIMIT = 1000

/** slug — 게시판 식별자. 소문자·숫자·하이픈, 1~64자. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 멤버 식별자(호스트 앱이 부여) — 영숫자·하이픈·언더스코어·점·콜론, 1~128자. */
export const MEMBER_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/

/** 발급 키 접두사 — publishable(브라우저 안전) / secret(서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 길이 한도. */
export const POST_TITLE_MAX = 200
export const POST_BODY_MAX = 20000
export const COMMENT_BODY_MAX = 8000
export const AUTHOR_NAME_MAX = 80
export const BOARD_NAME_MAX = 120
export const BOARD_DESC_MAX = 500
export const TAG_MAX = 40
export const TAGS_MAX = 10

/** 댓글 중첩 최대 깊이(렌더 안전·과도한 스레딩 방지). 초과 입력은 이 깊이로 클램프. */
export const MAX_COMMENT_DEPTH = 6
