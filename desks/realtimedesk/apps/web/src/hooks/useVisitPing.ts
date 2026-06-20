import { useEffect, useRef } from 'react'

import type { VisitPingInput } from '@realtimedesk/shared'

import { api } from '@/services/api'

/** localStorage 일자 키 접두 — 'rt-visit-YYYYMMDD'(KST) 가 있으면 오늘 이미 방문한 것. */
const VISIT_KEY_PREFIX = 'rt-visit-'

/** KST(Asia/Seoul) 기준 오늘 일자 키(YYYYMMDD). 서버와 같은 자정 경계. */
function kstDayKey(now: Date = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '')
}

/** 오늘 첫 방문이면 localStorage 에 표시하고 true 를 돌려준다(없을 때만 표시). */
function markFirstVisitToday(): boolean {
  if (typeof localStorage === 'undefined') return false
  const key = `${VISIT_KEY_PREFIX}${kstDayKey()}`
  try {
    if (localStorage.getItem(key)) return false
    localStorage.setItem(key, '1')
    return true
  } catch {
    // 프라이빗 모드 등 localStorage 접근 불가 — 방문자 판정 없이 hit 만 보낸다.
    return false
  }
}

/**
 * 방문 추적 — 앱 부팅 시 세션당 1회 `/api/metrics/ping` 을 보낸다.
 * 오늘 첫 방문이면 firstToday=true(고유 방문자), 그 외엔 hit 만. 실패는 조용히 무시한다
 * (트래킹이 UX 를 막지 않음). 추적은 hit/visitor 만 세며 개인정보는 보내지 않는다.
 */
export function useVisitPing(): void {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    const body: VisitPingInput = { firstToday: markFirstVisitToday() }
    void api.postAnonymous('metrics/ping', body).catch(() => {
      // 조용히 무시 — 트래킹 실패가 앱 동작을 막지 않는다.
    })
  }, [])
}
