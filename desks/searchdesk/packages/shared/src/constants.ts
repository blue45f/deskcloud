/** 요금제 — free 는 누적 문서 소프트 캡 적용, pro 는 무제한. */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/** 무료 플랜 기본 문서 소프트 캡(env FREE_PLAN_DOC_CAP 로 override). */
export const DEFAULT_FREE_PLAN_DOC_CAP = 1000

/** 테넌트 slug — 소문자/숫자/하이픈, 1~64자. URL·식별자로 사용. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 인덱스 이름 — 테넌트 내 문서 묶음 식별자. 영숫자·._- 허용, 1~64자. */
export const INDEX_NAME_RE = /^[A-Za-z0-9._-]+$/

/** 기본 인덱스 이름 — index 미지정 시 사용. */
export const DEFAULT_INDEX = 'default'

/** 문서 id — 테넌트가 지정하는 안정적 식별자(upsert 키). 영숫자·._-: 허용, 1~200자. */
export const DOC_ID_RE = /^[A-Za-z0-9._:-]+$/

/** 키 접두사 — publishable(브라우저 노출 가능) · secret(서버 전용, 해시 저장). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(접두사 뒤) 길이 — base62 무작위. */
export const KEY_BODY_LENGTH = 32

/** 필드 길이 상한(저장·색인 안전 한도). */
export const TITLE_MAX = 300
export const BODY_MAX = 20000
export const URL_MAX = 2000
export const CATEGORY_MAX = 120
export const TAG_MAX = 80
export const MAX_TAGS = 50

/** 검색 결과 기본/최대 limit. */
export const SEARCH_DEFAULT_LIMIT = 10
export const SEARCH_MAX_LIMIT = 50

/** 하이라이트 스니펫 기본 길이(문자) — 매치 토큰 주변으로 잘라낼 윈도. */
export const SNIPPET_MAX = 200

/**
 * 랭킹 가중치 — title 매치가 body 매치보다 무겁다(요구사항: title > body).
 * 점수 = titleWeight * title커버리지 + bodyWeight * body커버리지 + 보너스.
 */
export const TITLE_WEIGHT = 10
export const BODY_WEIGHT = 3
/** 모든 쿼리 토큰이 문서에 존재할 때(완전 커버리지) 보너스. */
export const FULL_COVERAGE_BONUS = 4
/** title 에 쿼리 구문이 그대로(연속) 등장할 때 보너스. */
export const TITLE_PHRASE_BONUS = 6
/** body 에 쿼리 구문이 그대로(연속) 등장할 때 보너스. */
export const BODY_PHRASE_BONUS = 2
