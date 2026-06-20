import { DEFAULT_FREE_PLAN_FILE_CAP, DEFAULT_MAX_FILE_BYTES, formatBytes } from '@filedesk/shared'
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
      `파일 ${DEFAULT_FREE_PLAN_FILE_CAP}개까지`,
      `파일당 최대 ${formatBytes(DEFAULT_MAX_FILE_BYTES)}`,
      'Postgres-bytea 스토리지',
      'public / private 접근 제어',
      '임베드 위젯 + SDK',
    ],
  },
  {
    name: 'Pro',
    price: '₩19,000/월',
    plan: 'pro',
    highlight: true,
    features: [
      '무제한 파일',
      '더 큰 업로드 한도',
      'S3 / R2 스토리지 스왑',
      '서명 URL(한시 접근)',
      '우선 지원',
    ],
  },
]

export function PricingPage(): ReactElement {
  useDocumentTitle('요금제')
  return (
    <>
      <section className="fd-hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 32 }}>요금제</h1>
        <p>작게 시작하고, 트래픽이 커지면 Pro 로. 플랜 한도는 API가 단일 소스입니다.</p>
      </section>

      <section className="fd-section">
        <div className="fd-grid cols-2">
          {TIERS.map((t) => (
            <div
              key={t.plan}
              className="fd-card"
              style={t.highlight ? { borderColor: 'var(--fd-accent)' } : undefined}
            >
              <div className="fd-row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{t.name}</h2>
                {t.highlight ? <span className="fd-badge fd-public">추천</span> : null}
              </div>
              <p className="fd-pricing-price" style={{ marginTop: 12 }}>
                {t.price}
              </p>
              <ul className="fd-stack" style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                {t.features.map((f) => (
                  <li key={f} className="fd-row">
                    <span aria-hidden="true" style={{ color: 'var(--fd-success)' }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 14 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={t.highlight ? 'fd-btn fd-btn-primary' : 'fd-btn'}
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
