import { useEffect, useState } from 'react'

import { PLANS, UNLIMITED, type PlanSummaryDto } from '@desk/shared/browser'

import { fetchPlans } from './api'
import { BillingDashboard } from './BillingDashboard'

/** -1(UNLIMITED)은 '무제한', 그 외는 천단위 콤마. */
function fmt(n: number): string {
  return n === UNLIMITED ? '무제한' : n.toLocaleString('ko-KR')
}

function price(p: PlanSummaryDto): string {
  if (p.plan === 'enterprise') return '문의'
  if (p.priceKrwMonthly === 0) return '₩0'
  return `₩${p.priceKrwMonthly.toLocaleString('ko-KR')}/월`
}

/** 바이트 → 사람이 읽는 단위. */
function bytes(n: number): string {
  if (n === UNLIMITED) return '무제한'
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString('ko-KR')} GiB`
  return `${Math.round(n / 1024 / 1024).toLocaleString('ko-KR')} MiB`
}

/**
 * DeskCloud 가격(pricing) + 테넌트 빌링 대시보드.
 * 플랜은 API(/api/billing/plans, @desk/billing 단일 소스)에서 가져온다.
 */
export function App(): React.JSX.Element {
  const [plans, setPlans] = useState<PlanSummaryDto[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch((e: unknown) => setApiError((e as Error).message))
  }, [])

  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 1080,
        margin: '0 auto',
        padding: '48px 20px',
        color: '#0f172a',
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 34, margin: 0, letterSpacing: -0.5 }}>DeskCloud</h1>
        <p style={{ color: '#475569', marginTop: 8, fontSize: 16 }}>
          모든 Desk(SurveyDesk·NotifyDesk·SearchDesk·…)가 공유하는 빌링/수익화 플랫폼.
          각 Desk 는 <code>tenant.plan</code> 으로 한도를 강제하고, 구독·체크아웃은 여기서 일어납니다.
        </p>
      </header>

      {apiError && (
        <p
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          API 연결 실패({apiError}). 가격은 정적 폴백으로 표시됩니다. <code>pnpm dev</code> 로 API(:6090)를 띄우세요.
        </p>
      )}

      <PricingGrid plans={plans} />

      {plans && <BillingDashboard plans={plans} />}

      <footer style={{ marginTop: 48, fontSize: 12, color: '#94a3b8' }}>
        @desk/platform — 멀티테넌트 + 빌링 코어. 결제는 TEST/STUB(실제 청구 없음).
      </footer>
    </main>
  )
}

/** API 미응답 시에도 보이도록 PLANS 키만으로 골격을 그린다. */
function PricingGrid({ plans }: { plans: PlanSummaryDto[] | null }): React.JSX.Element {
  const items: (PlanSummaryDto | { plan: (typeof PLANS)[number] })[] =
    plans ?? PLANS.map((plan) => ({ plan }))
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${PLANS.length}, 1fr)`,
        gap: 16,
      }}
    >
      {items.map((item) => {
        const full = 'limits' in item ? item : null
        return (
          <article
            key={item.plan}
            style={{
              border: item.plan === 'pro' ? '2px solid #6366f1' : '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 20,
              background: item.plan === 'pro' ? '#f5f3ff' : '#fff',
              position: 'relative',
            }}
          >
            {item.plan === 'pro' && (
              <span
                style={{
                  position: 'absolute',
                  top: -11,
                  left: 20,
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 9999,
                }}
              >
                인기
              </span>
            )}
            <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>{full?.label ?? item.plan}</h2>
            <p style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px' }}>
              {full ? price(full) : '—'}
            </p>
            {full ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, lineHeight: 2 }}>
                <li>응답 {fmt(full.limits.responses ?? UNLIMITED)}/월</li>
                <li>알림 {fmt(full.limits.notifications ?? UNLIMITED)}/월</li>
                <li>검색 {fmt(full.limits.searches ?? UNLIMITED)}/월</li>
                <li>저장 {bytes(full.limits.storageBytes ?? UNLIMITED)}</li>
                <li>좌석 {fmt(full.limits.seats ?? UNLIMITED)}</li>
                <li>프로젝트 {fmt(full.limits.projects ?? UNLIMITED)}</li>
                <li style={{ color: full.features.removeBranding ? '#16a34a' : '#94a3b8' }}>
                  {full.features.removeBranding ? '✓ 배지 제거' : 'DeskCloud 배지'}
                </li>
                <li style={{ color: full.features.customDomain ? '#16a34a' : '#94a3b8' }}>
                  {full.features.customDomain ? '✓ 커스텀 도메인' : '커스텀 도메인 ✗'}
                </li>
                <li style={{ color: full.features.webhooks ? '#16a34a' : '#94a3b8' }}>
                  {full.features.webhooks ? '✓ 웹훅' : '웹훅 ✗'}
                </li>
              </ul>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>로딩 중…</p>
            )}
          </article>
        )
      })}
    </section>
  )
}
