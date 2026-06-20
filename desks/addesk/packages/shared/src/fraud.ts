/**
 * 무효 트래픽(IVT) 1차 필터 — 노출/클릭 추적의 봇/크롤러 휴리스틱(순수 함수).
 *
 * 진짜 광고 서버라면 누구나 가지는 최소 방어선이다. 공개 publishable(pk_) 키로 누구나 추적 이벤트를
 * 보낼 수 있으므로, 명백한 봇 User-Agent 를 거른다 — 자기 CTR 의 자명한 부풀리기/크롤러 노이즈를
 * 카운터에서 제외한다. api(추적 경로)·테스트가 공유한다.
 *
 * 주의: 이건 완벽한 봇 탐지가 아니라(스푸핑 가능) cheap 한 1차 거름망이다. 교차 테넌트 안전(tenantId
 * 스코프)·정확 dedup 은 별도 레이어의 몫. UA 가 비어 있으면(서버사이드/일부 임베드) 통과시킨다 —
 * 정상 트래픽을 과차단하지 않기 위함(보수적 deny-known-bots 정책).
 */

/** 흔한 봇/크롤러/헤드리스 시그니처(소문자 부분일치). */
const BOT_UA_PATTERNS: readonly string[] = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'headless',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'curl',
  'wget',
  'python-requests',
  'http-client',
  'okhttp',
  'go-http',
  'java/',
  'libwww',
  'lighthouse',
  'pingdom',
  'gtmetrix',
  'preview',
  'facebookexternalhit',
  'embedly',
]

/**
 * User-Agent 가 명백한 봇/크롤러로 보이는지(순수 함수).
 * UA 가 없거나 빈 문자열이면 false(통과) — UA 부재만으로는 봇이라 단정하지 않는다.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_UA_PATTERNS.some((p) => ua.includes(p))
}
