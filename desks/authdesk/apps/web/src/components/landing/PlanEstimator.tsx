import { PLAN_USER_LIMITS, PLANS, UNLIMITED } from '@authdesk/shared'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { Plan } from '@authdesk/shared'
import type { ChangeEvent, ReactElement } from 'react'

/** 슬라이더 스텝(로그 스케일 느낌) — 실제 플랜 경계와 그 주변 값을 촘촘히 둔다. */
const STEPS = [
  100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  scale: 'Scale',
  enterprise: 'Enterprise',
}

/** 사용자 수 → 수용 가능한 가장 작은 플랜. (limit -1 == 무제한) */
function recommendPlan(users: number): Plan {
  for (const plan of PLANS) {
    const limit = PLAN_USER_LIMITS[plan]
    if (limit === UNLIMITED || users <= limit) return plan
  }
  return 'enterprise'
}

function formatUsers(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * 플랜 추정기 — "내 사용자 수면 어떤 플랜?" 을 즉답한다.
 *
 * 플랜 한도(PLAN_USER_LIMITS)는 shared 가 단일 소스이므로, 가격표와 추정기가 절대
 * 어긋나지 않는다. (랜딩의 "데이터 어포던스" 기능 2 — 인터랙티브)
 */
export function PlanEstimator(): ReactElement {
  const [index, setIndex] = useState(2) // 기본 1,000 (free 상한)
  const fieldId = useId()

  // index 는 항상 0..STEPS.length-1 로 클램프되지만, noUncheckedIndexedAccess 하에선
  // 인덱싱이 T | undefined 이므로 안전 폴백(첫 스텝)을 둔다.
  const users = STEPS[index] ?? STEPS[0]
  const plan = useMemo(() => recommendPlan(users), [users])
  const fillPct = (index / (STEPS.length - 1)) * 100

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setIndex(Number(event.target.value))
  }

  const planLimit = PLAN_USER_LIMITS[plan]
  const headroom =
    planLimit === UNLIMITED ? '무제한' : `${formatUsers(planLimit)}명까지 한 플랜으로`

  return (
    <div className="ad-estimator">
      <div>
        <label className="ad-label" htmlFor={fieldId} style={{ marginBottom: 10 }}>
          예상 월간 사용자 수
        </label>
        <input
          id={fieldId}
          type="range"
          className="ad-range"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={index}
          onChange={onChange}
          aria-valuetext={`${formatUsers(users)}명 — 권장 ${PLAN_LABELS[plan]}`}
          style={{ '--ad-range-fill': `${fillPct}%` } as React.CSSProperties}
        />
        <div
          className="ad-row"
          style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}
        >
          <span className="ad-muted">100</span>
          <span className="ad-muted">1M+</span>
        </div>
      </div>

      <div aria-live="polite">
        <div className="ad-stat-label">예상 사용자</div>
        <div className="ad-estimator-readout">{formatUsers(users)}</div>
        <div className="ad-estimator-plan">
          <span aria-hidden="true">✦</span>
          {PLAN_LABELS[plan]} 권장
        </div>
        <p className="ad-muted" style={{ margin: '10px 0 14px', fontSize: 13 }}>
          {headroom}.
        </p>
        <Link to="/pricing" className="ad-btn ad-btn-sm ad-btn-ghost-arrow">
          요금제 비교 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
