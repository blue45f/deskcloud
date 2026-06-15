import { useState } from 'react'

import { type PlanSummaryDto, type SubscriptionDto } from '@desk/shared/browser'

import {
  cancelSubscription,
  fetchSubscription,
  startCheckout,
} from './api'
import { PoweredByDeskCloud } from './PoweredByDeskCloud'

const STATUS_COLOR: Record<string, string> = {
  active: '#16a34a',
  past_due: '#d97706',
  incomplete: '#6366f1',
  canceled: '#64748b',
  none: '#94a3b8',
}

/**
 * 테넌트 빌링 대시보드 — secret 키로 구독을 불러와 체크아웃/취소를 수행한다.
 * 모든 결제는 TEST/STUB(실제 청구 없음). 체크아웃은 스텁 URL 을 새 탭으로 연다.
 */
export function BillingDashboard({ plans }: { plans: PlanSummaryDto[] }): React.JSX.Element {
  const [sk, setSk] = useState('')
  const [sub, setSub] = useState<SubscriptionDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const paidPlans = plans.filter((p) => p.plan !== 'free' && p.plan !== 'enterprise')

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const load = (): Promise<void> =>
    run(async () => {
      setSub(await fetchSubscription(sk.trim()))
    })

  const checkout = (plan: string): Promise<void> =>
    run(async () => {
      const res = await startCheckout(sk.trim(), plan)
      setNotice(`체크아웃 세션 생성(${res.provider}, charged=${res.charged}) — 결제 페이지로 이동`)
      window.open(res.checkoutUrl, '_blank', 'noopener')
      // 스텁은 즉시 활성화되지 않음(웹훅 대기) — 구독을 다시 불러와 incomplete 확인.
      setSub(await fetchSubscription(sk.trim()))
    })

  const cancel = (): Promise<void> =>
    run(async () => {
      setSub(await cancelSubscription(sk.trim()))
      setNotice('구독이 취소되어 Free 로 복귀했습니다.')
    })

  return (
    <section
      style={{
        marginTop: 48,
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: 24,
        background: '#fff',
      }}
    >
      <h2 style={{ fontSize: 22, margin: '0 0 4px' }}>테넌트 빌링 대시보드</h2>
      <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: 14 }}>
        secret 키(<code>sk_…</code>)로 구독을 관리하세요. 모든 결제는 <strong>TEST/STUB</strong> —
        실제 청구가 발생하지 않습니다.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="sk-input" style={{ position: 'absolute', left: -9999 }}>
          secret 키
        </label>
        <input
          id="sk-input"
          type="password"
          value={sk}
          onChange={(e) => setSk(e.target.value)}
          placeholder="sk_… (시드 로그 또는 가입 응답에서 확인)"
          style={{
            flex: 1,
            minWidth: 280,
            padding: '10px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'ui-monospace, monospace',
          }}
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy || sk.trim().length === 0}
          style={btn('#0f172a')}
        >
          구독 불러오기
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>
          오류: {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ color: '#16a34a', fontSize: 13, marginTop: 12 }}>
          {notice}
        </p>
      )}

      {sub && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: 16,
              background: '#f8fafc',
              borderRadius: 12,
            }}
          >
            <Stat label="플랜" value={sub.plan.toUpperCase()} />
            <Stat
              label="상태"
              value={sub.status}
              color={STATUS_COLOR[sub.status] ?? '#0f172a'}
            />
            <Stat label="제공자" value={sub.provider} />
            <Stat label="갱신일" value={sub.periodEnd ? sub.periodEnd.slice(0, 10) : '—'} />
            <div style={{ marginLeft: 'auto' }}>
              <PoweredByDeskCloud hidden={!sub.showBadge} />
              {!sub.showBadge && (
                <span style={{ fontSize: 12, color: '#16a34a' }}>배지 제거됨 (유료 특전)</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paidPlans.map((p) => (
              <button
                key={p.plan}
                type="button"
                onClick={() => void checkout(p.plan)}
                disabled={busy || sub.plan === p.plan}
                style={btn(sub.plan === p.plan ? '#94a3b8' : '#6366f1')}
              >
                {sub.plan === p.plan ? `${p.label} (현재)` : `${p.label} 로 업그레이드`}
              </button>
            ))}
            {sub.plan !== 'free' && (
              <button type="button" onClick={() => void cancel()} disabled={busy} style={btn('#dc2626')}>
                구독 취소 (Free 복귀)
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  color = '#0f172a',
}: {
  label: string
  value: string
  color?: string
}): React.JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return {
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    background: bg,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  }
}
