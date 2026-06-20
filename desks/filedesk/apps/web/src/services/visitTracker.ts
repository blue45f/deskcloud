import { pingVisit } from './statsApi'

const CLIENT_ID_KEY = 'fd.clientId'
const LAST_VISIT_DAY_KEY = 'fd.lastVisitDay'

/** 서버 일 버킷(서버 로컬 자정)과 같은 의미의 로컬 오늘 키(YYYY-MM-DD). */
function todayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 브라우저 고유 clientId 를 읽거나(없으면) 생성해 localStorage 에 보관한다. */
function readOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(CLIENT_ID_KEY, id)
  return id
}

/**
 * 방문 핑을 하루 1회만 보낸다(브라우저/일). 오늘 이미 보냈으면 아무것도 하지 않는다.
 * fire-and-forget — 네트워크/스토리지 오류는 모두 조용히 무시한다(앱 동작에 영향 없음).
 * 이 멱등 덕분에 서버의 '오늘 방문자 수' 가 정직한 고유 브라우저/일 집계가 된다.
 */
export function trackVisitOncePerDay(): void {
  try {
    const today = todayKey()
    if (localStorage.getItem(LAST_VISIT_DAY_KEY) === today) return
    const clientId = readOrCreateClientId()
    // lastVisitDay 를 먼저 갱신해 동시 호출/재마운트로 인한 중복 핑을 줄인다.
    localStorage.setItem(LAST_VISIT_DAY_KEY, today)
    void pingVisit(clientId).catch(() => {
      // 핑 실패는 무시한다(다음 날 다시 시도). 서버 카운터만 누락될 뿐 UX 영향 없음.
    })
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 추적은 생략하고 앱은 정상 동작.
  }
}
