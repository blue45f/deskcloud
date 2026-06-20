import { useEffect } from 'react'

import { apiEndpoint } from '@/services/api'

/** localStorage 일별 플래그 키 — 'md-visit-YYYY-MM-DD'. IP/쿠키 미사용(프라이버시 친화). */
function visitFlagKey(day: string): string {
  return `md-visit-${day}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 방문 핑 — 앱 로드 시 하루 1회(브라우저 기준) `POST /api/visits/ping` 을 발사한다.
 * 본문 { newToday } 는 오늘 첫 방문인지를 알리는 advisory 신호(서버는 hits 항상 +1).
 * 완전 비인증·fire-and-forget(실패는 조용히 무시). 운영 트래픽 지표의 소스.
 */
export function useVisitPing(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const day = today()
    const key = visitFlagKey(day)
    let newToday = false
    try {
      newToday = localStorage.getItem(key) === null
      if (newToday) localStorage.setItem(key, '1')
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) — newToday=false 로 둔다.
    }

    const controller = new AbortController()
    void fetch(`${apiEndpoint()}/api/visits/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newToday }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      // 집계 핑은 실패해도 사용자 경험에 영향 없음 — 조용히 무시.
    })

    return () => controller.abort()
  }, [])
}
