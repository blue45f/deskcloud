import { FREE_PLAN_LIMIT } from '@addesk/shared'
import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

interface Tier {
  name: string
  price: string
  plan: 'free' | 'pro'
  features: string[]
  highlight?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '₩0',
    plan: 'free',
    features: [
      `월 ${FREE_PLAN_LIMIT.toLocaleString('ko-KR')}회 서빙까지`,
      '캠페인·크리에이티브·슬롯 무제한',
      '가중치 서빙 + 노출/클릭 추적',
      'CTR 통계 대시보드',
      '임베드 위젯 + SDK',
    ],
  },
  {
    name: 'Pro',
    price: '₩29,000/월',
    plan: 'pro',
    highlight: true,
    features: [
      '무제한 서빙',
      '우선 서빙 큐',
      '커스텀 도메인 위젯 호스팅',
      '상세 분석 + 내보내기',
      '우선 지원',
    ],
  },
]

export function PricingPage(): ReactElement {
  useDocumentTitle('요금제')
  return (
    <>
      <section className="ax-hero" style={{ paddingBottom: 8 }}>
        <h1 className="ax-enter ax-enter-1" style={{ fontSize: 32 }}>
          작게 시작하고, <span className="ax-grad-text">크게 확장</span>
        </h1>
        <p className="ax-enter ax-enter-2">
          작게 시작하고, 트래픽이 커지면 Pro 로. 플랜 한도는 API가 단일 소스입니다.
        </p>
      </section>

      <section className="ax-section">
        <div className="ax-grid cols-2">
          {TIERS.map((t) => (
            <div
              key={t.plan}
              className="ax-card ax-card-i ax-enter ax-enter-2"
              style={t.highlight ? { borderColor: 'var(--ax-accent)' } : undefined}
            >
              <div className="ax-row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{t.name}</h2>
                {t.highlight ? <span className="ax-badge ax-on">추천</span> : null}
              </div>
              <p className="ax-pricing-price" style={{ marginTop: 12 }}>
                {t.price}
              </p>
              <ul className="ax-stack" style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                {t.features.map((f) => (
                  <li key={f} className="ax-row">
                    <span aria-hidden="true" style={{ color: 'var(--ax-success)' }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 14 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={t.highlight ? 'ax-btn ax-btn-primary' : 'ax-btn'}
                style={{ marginTop: 20, width: '100%' }}
              >
                {t.name} 시작하기
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
