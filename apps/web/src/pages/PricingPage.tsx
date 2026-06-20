import { PLAN_USER_LIMITS } from '@authdesk/shared'
import { Link } from 'react-router-dom'

import type { Plan } from '@authdesk/shared'
import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

interface Tier {
  name: string
  price: string
  plan: Plan
  features: string[]
  highlight?: boolean
}

function userLimitLabel(plan: Plan): string {
  const n = PLAN_USER_LIMITS[plan]
  return n < 0 ? '무제한 사용자' : `사용자 ${n.toLocaleString('en-US')}명까지`
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '₩0',
    plan: 'free',
    features: [
      userLimitLabel('free'),
      '이메일 + 비밀번호 인증',
      'JWT 세션 (테넌트별 서명)',
      '임베드 위젯 + SDK',
      '어드민 통계',
    ],
  },
  {
    name: 'Pro',
    price: '₩29,000/월',
    plan: 'pro',
    highlight: true,
    features: [
      userLimitLabel('pro'),
      'OAuth/소셜 로그인(예정)',
      '커스텀 세션 수명',
      '이메일 인증 플로우',
      '우선 지원',
    ],
  },
]

export function PricingPage(): ReactElement {
  useDocumentTitle('요금제')
  return (
    <>
      <section className="ad-hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 32 }}>요금제</h1>
        <p>작게 시작하고, 사용자가 늘면 Pro 로. 플랜 한도는 API가 단일 소스입니다.</p>
      </section>

      <section className="ad-section">
        <div className="ad-grid cols-2">
          {TIERS.map((t) => (
            <div
              key={t.plan}
              className="ad-card"
              style={t.highlight ? { borderColor: 'var(--ad-accent)' } : undefined}
            >
              <div className="ad-row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{t.name}</h2>
                {t.highlight ? <span className="ad-badge ad-accentish">추천</span> : null}
              </div>
              <p className="ad-pricing-price" style={{ marginTop: 12 }}>
                {t.price}
              </p>
              <ul className="ad-stack" style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                {t.features.map((f) => (
                  <li key={f} className="ad-row">
                    <span aria-hidden="true" style={{ color: 'var(--ad-success)' }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 14 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={t.highlight ? 'ad-btn ad-btn-primary' : 'ad-btn'}
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
