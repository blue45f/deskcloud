import { PLAN_LIMITS, PLANS, UNLIMITED, type PlanSummaryDto } from '@desk/shared/browser'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Minus, Package } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { fetchPlans } from '@/services/api'
import { cn } from '@/utils/cn'
import { fmtNum, fmtPriceKrw, fmtStorage } from '@/utils/format'

/** API 미응답 시 표시할 정적 폴백(PLAN_LIMITS 단일 소스에서 파생). */
function staticPlans(): PlanSummaryDto[] {
  return PLANS.map((plan) => {
    const l = PLAN_LIMITS[plan]
    return {
      plan,
      label: l.label,
      priceKrwMonthly: l.priceKrwMonthly,
      priceUsdCentsMonthly: l.priceUsdCentsMonthly,
      limits: {
        api_calls: l.api_calls,
        events: l.events,
        storage_mb: l.storage_mb,
        seats: l.seats,
      },
      features: {
        removeBranding: l.removableBadge,
        customDomain: plan === 'scale' || plan === 'enterprise',
        webhooks: plan !== 'free',
      },
    }
  })
}

const TAGLINE: Record<string, string> = {
  free: '취미·검증용 — 영구 무료',
  pro: '성장하는 제품을 위한 표준',
  scale: '트래픽이 큰 팀',
  enterprise: '맞춤 한도·보안·SLA',
}

function priceLabel(p: PlanSummaryDto): { big: string; suffix: string } {
  if (p.plan === 'enterprise') return { big: '문의', suffix: '' }
  if (p.priceKrwMonthly === 0) return { big: '₩0', suffix: '/월' }
  return { big: fmtPriceKrw(p.plan, p.priceKrwMonthly), suffix: '/월' }
}

function FeatureRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[0.8125rem]">
      {ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <Minus className="mt-0.5 size-4 shrink-0 text-text-subtle" aria-hidden />
      )}
      <span className={cn(ok ? 'text-text' : 'text-text-subtle')}>{children}</span>
    </li>
  )
}

function PlanCard({ p }: { p: PlanSummaryDto }) {
  const featured = p.plan === 'pro'
  const { big, suffix } = priceLabel(p)
  const cta =
    p.plan === 'enterprise' ? (
      <Button asChild variant="secondary" className="w-full">
        <a href="mailto:sales@deskcloud.dev">영업 문의</a>
      </Button>
    ) : p.plan === 'free' ? (
      <Button asChild variant="secondary" className="w-full">
        <Link to="/signup">무료로 시작</Link>
      </Button>
    ) : (
      <Button asChild variant={featured ? 'accent' : 'primary'} className="w-full">
        <Link to="/signup">{p.label} 시작</Link>
      </Button>
    )

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border bg-surface p-6',
        featured ? 'border-accent-strong shadow-md' : 'border-border'
      )}
    >
      {featured ? (
        <span className="absolute -top-2.5 left-6">
          <Badge tone="accent" size="sm">
            인기
          </Badge>
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-text">{p.label}</h3>
      <p className="mt-0.5 text-xs text-text-muted">{TAGLINE[p.plan]}</p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-text">{big}</span>
        {suffix ? <span className="text-sm text-text-muted">{suffix}</span> : null}
      </p>

      <div className="mt-5">{cta}</div>

      <ul className="mt-5 space-y-2 border-t border-border pt-5">
        <li className="text-[0.8125rem] text-text-muted">
          API 호출{' '}
          <strong className="font-mono text-text">{fmtNum(p.limits.api_calls ?? UNLIMITED)}</strong>
          /월
        </li>
        <li className="text-[0.8125rem] text-text-muted">
          이벤트{' '}
          <strong className="font-mono text-text">{fmtNum(p.limits.events ?? UNLIMITED)}</strong>
          /월
        </li>
        <li className="text-[0.8125rem] text-text-muted">
          저장{' '}
          <strong className="font-mono text-text">
            {fmtStorage(p.limits.storage_mb ?? UNLIMITED)}
          </strong>
        </li>
        <li className="text-[0.8125rem] text-text-muted">
          좌석{' '}
          <strong className="font-mono text-text">{fmtNum(p.limits.seats ?? UNLIMITED)}</strong>
        </li>
      </ul>

      <ul className="mt-4 space-y-2 border-t border-border pt-4">
        <FeatureRow ok={p.features.removeBranding}>DeskCloud 배지 제거</FeatureRow>
        <FeatureRow ok={p.features.customDomain}>커스텀 도메인</FeatureRow>
        <FeatureRow ok={p.features.webhooks}>웹훅</FeatureRow>
      </ul>
    </article>
  )
}

export default function PricingPage() {
  useDocumentTitle('요금제')
  const { data, isError } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
  })
  const plans = data ?? staticPlans()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" size="sm">
          요금제
        </Badge>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold tracking-tight text-balance text-text">
          한 번 가입, 전체 패밀리에 적용되는 요금
        </h1>
        <p className="mt-4 text-pretty text-text-muted">
          플랜·한도는 모든 Desk 에 공통으로 적용됩니다. 한 콘솔에서 사용량을 보고 언제든
          업/다운그레이드 하세요. 결제는 TEST/STUB — 실제 청구는 없습니다.
        </p>
      </header>

      {isError ? (
        <Banner tone="info" className="mx-auto mt-6 max-w-2xl text-center">
          API(:6090)에 연결하지 못해 정적 가격표를 표시합니다. <code>pnpm dev</code> 로 API 를
          띄우면 단일 소스(@desk/billing)로 동기화됩니다.
        </Banner>
      ) : null}

      <section className="mt-10 grid gap-5 lg:grid-cols-4" aria-label="플랜">
        {plans.map((p) => (
          <PlanCard key={p.plan} p={p} />
        ))}
      </section>

      {/* 번들 노트 */}
      <section className="mt-10">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-fg">
            <Package className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">패밀리 번들</h2>
            <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">
              하나의 구독으로 모든 Desk(약관·설문·리뷰·알림·검색·실시간·커뮤니티·채팅 등)를
              사용합니다. 한도는 테넌트 단위로 합산 적용되므로 서비스별로 따로 결제할 필요가
              없습니다.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link to="/catalog">
              포함 서비스 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-text-subtle">
        모든 한도·기능은 <code className="font-mono">PLAN_LIMITS</code> /{' '}
        <code className="font-mono">@desk/billing</code> 단일 소스에서 옵니다.
      </p>
    </div>
  )
}
