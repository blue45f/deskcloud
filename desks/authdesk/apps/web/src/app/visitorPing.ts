/**
 * 방문자 핑 유틸 — localStorage 에 방문자 id(vid)를 영속하고, 테넌트·날짜별 1회만 핑을 쏘게 가드한다.
 *
 * 정직성: 트래픽/고유 방문자는 신규-추적 메트릭이라 과거를 채울 수 없다(서버가 '추적 시작 이후'로 표기).
 * 여기서는 같은 날 중복 집계를 피하려고 (tenant, day) 키로 하루 1회만 핑을 보낸다.
 */
const VID_KEY = 'authdesk.vid'

/** 영속 방문자 id 를 읽거나(없으면) 새로 만들어 저장한다. crypto.randomUUID 우선, 폴백 포함. */
export function getOrCreateVid(): string {
  if (typeof localStorage === 'undefined') return 'anon'
  const existing = localStorage.getItem(VID_KEY)
  if (existing) return existing
  const vid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(VID_KEY, vid)
  return vid
}

/** 날짜 키(YYYY-MM-DD, 로컬 tz). 하루 1회 가드용. */
function todayKey(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 이 테넌트에 대해 오늘 아직 핑을 안 보냈으면 true 를 돌려주고, 보낸 것으로 표시한다(멱등).
 * 같은 탭/세션의 재렌더·새로고침에서도 하루 1회만 통과한다.
 */
export function shouldPingToday(publishableKey: string): boolean {
  if (typeof localStorage === 'undefined') return false
  const key = `authdesk.visit.${publishableKey}`
  if (localStorage.getItem(key) === todayKey()) return false
  localStorage.setItem(key, todayKey())
  return true
}
