import { useEffect, useState } from 'react'

import type { StatsOverviewDto } from '@filedesk/shared'
import type { ReactElement } from 'react'

import { Reveal } from '@/components/Reveal'
import { getStatsOverview } from '@/services/statsApi'

/** 한 장의 스탯 카드 정의 — 라벨·값·캡션·포맷터. */
interface StatCard {
  id: keyof StatsOverviewDto
  label: string
  caption: string
  /** 숫자를 사람이 읽는 표기로(기본은 ko-KR 천단위). */
  format?: (n: number) => string
}

const NUMBER = (n: number): string => n.toLocaleString('ko-KR')

const CARDS: StatCard[] = [
  {
    id: 'todayVisitors',
    label: '오늘 방문자 수',
    caption: '오늘 다녀간 고유 브라우저 수',
    format: (n) => `${NUMBER(n)}명`,
  },
  {
    id: 'totalTraffic',
    label: '총 트래픽',
    caption: '누적 페이지뷰',
    format: (n) => `${NUMBER(n)}회`,
  },
  {
    id: 'todaySignups',
    label: '오늘 신규 가입자 수',
    caption: '오늘 가입한 팀',
    format: (n) => `${NUMBER(n)}팀`,
  },
  {
    id: 'totalSignups',
    label: '총 가입 수',
    caption: '지금까지 가입한 팀',
    format: (n) => `${NUMBER(n)}팀`,
  },
]

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: StatsOverviewDto }
  | { status: 'error' }

/**
 * 운영 현황 패널 — 공개·프라이버시 안전 집계 4종(오늘 방문자/총 트래픽/오늘 가입/총 가입).
 *
 * 데이터 출처: GET /api/stats/overview(인증 없음, 크로스 테넌트 합계만). 로딩 중엔 스켈레톤,
 * 실패하면 '—' 로 우아하게 강등한다(패널을 숨기지 않아 레이아웃이 흔들리지 않음).
 * 각 카드는 라벨이 붙은 group 이고, 숫자는 색만으로 전달하지 않는다(텍스트 라벨+캡션 동반).
 */
export function OperationsPanel(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let ignore = false
    getStatsOverview()
      .then((data) => {
        if (!ignore) setState({ status: 'ready', data })
      })
      .catch(() => {
        if (!ignore) setState({ status: 'error' })
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section className="fd-section" aria-labelledby="fd-ops-heading">
      <Reveal className="fd-section-head fd-center">
        <h2 id="fd-ops-heading">운영 현황</h2>
        <p>FileDesk 플랫폼 전체의 실시간 집계입니다. 가입 수는 실제 데이터로 매일 갱신됩니다.</p>
      </Reveal>

      <div
        className="fd-grid cols-4"
        style={{ marginTop: 22 }}
        aria-busy={state.status === 'loading'}
      >
        {CARDS.map((card, i) => (
          <Reveal key={card.id} index={i} className="fd-card">
            <div role="group" aria-label={card.label}>
              <p className="fd-stat-label">{card.label}</p>
              {state.status === 'loading' ? (
                <div
                  className="fd-skeleton"
                  style={{ height: 36, width: '70%', marginTop: 6 }}
                  aria-hidden="true"
                />
              ) : (
                <p className="fd-stat-value">
                  {state.status === 'ready' ? (card.format ?? NUMBER)(state.data[card.id]) : '—'}
                </p>
              )}
              <p className="fd-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
                {state.status === 'error' ? '집계를 불러오지 못했습니다' : card.caption}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="fd-muted" style={{ fontSize: 12, marginTop: 14, textAlign: 'center' }}>
        방문자 집계는 IP·개인정보 없이 브라우저/일 단위로만 익명 측정합니다.
      </p>
    </section>
  )
}
