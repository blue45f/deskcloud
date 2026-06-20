import {
  applyEvent,
  createBillingAdapter,
  DESK_PLANS,
  shouldShowBadge,
  type BillingAdapter,
  type BillingProvider,
  type NormalizedWebhookEvent,
  type Subscription,
} from '@desk/billing'
import { TenantService } from '@desk/core'
import { TENANT_SERVICE } from '@desk/core/nest'
import {
  PLANS,
  type CheckoutInput,
  type CheckoutResponseDto,
  type Plan,
  type PlanSummaryDto,
  type SubscriptionDto,
} from '@desk/shared'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

import { SUBSCRIPTION_STORE, type SubscriptionStorePort } from './tokens'

/** 다음 청구 주기 종료(now + 30일) ISO. 스텁/단순화. */
function periodEndFromNow(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * 빌링 서비스 — 결제 어댑터(TEST/STUB) + 구독 상태 머신 + tenant.plan 동기화를 오케스트레이션.
 * **실제 자금 이동 없음**(money-movement boundary). 어댑터는 결제 결정만 모사한다.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing')
  private readonly adapter: BillingAdapter

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(TENANT_SERVICE) private readonly tenants: TenantService,
    @Inject(SUBSCRIPTION_STORE) private readonly store: SubscriptionStorePort
  ) {
    this.adapter = createBillingAdapter(cfg.billingProvider)
  }

  get provider(): BillingProvider {
    return this.adapter.provider
  }

  /** 공개 가격표 — @desk/billing 의 DESK_PLANS 단일 소스. */
  listPlans(): PlanSummaryDto[] {
    return PLANS.map((plan) => {
      const def = DESK_PLANS[plan]
      return {
        plan,
        label: def.label,
        priceKrwMonthly: def.priceKrwMonthly,
        priceUsdCentsMonthly: def.priceUsdCentsMonthly,
        limits: { ...def.limits },
        features: { ...def.features },
      }
    })
  }

  /** 체크아웃 시작 — 어댑터로 세션 생성 + 구독을 incomplete 로. 실제 청구 없음. */
  async checkout(tenantId: string, input: CheckoutInput): Promise<CheckoutResponseDto> {
    if (input.plan === 'free') {
      throw new BadRequestException('Free 플랜은 체크아웃이 필요 없습니다(취소를 사용하세요)')
    }
    if (input.plan === 'enterprise') {
      throw new BadRequestException('Enterprise 는 영업 문의 — 셀프서비스 체크아웃 대상이 아닙니다')
    }
    const base = this.cfg.webOrigin
    const session = await this.adapter.createCheckout({
      tenantId,
      plan: input.plan,
      successUrl: input.successUrl ?? `${base}/billing?status=success`,
      cancelUrl: input.cancelUrl ?? `${base}/billing?status=cancel`,
    })

    const sub = await this.store.getOrCreate(tenantId, this.provider)
    const updated = applyEvent(sub, {
      event: 'checkout_started',
      plan: input.plan,
      providerSubscriptionId: session.sessionId,
    })
    await this.store.save(updated)

    return {
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
      plan: session.plan,
      provider: session.provider,
      charged: session.charged,
    }
  }

  /** 구독 조회(없으면 Free/none 기본 생성). */
  async getSubscription(tenantId: string): Promise<SubscriptionDto> {
    const sub = await this.store.getOrCreate(tenantId, this.provider)
    return this.toDto(sub)
  }

  /** 취소 — 구독을 canceled + tenant.plan=free. */
  async cancel(tenantId: string): Promise<SubscriptionDto> {
    await this.adapter.cancel(tenantId)
    const sub = await this.store.getOrCreate(tenantId, this.provider)
    const canceled = applyEvent(sub, { event: 'canceled' })
    await this.store.save(canceled)
    await this.tenants.setPlan(tenantId, 'free')
    this.logger.log(`구독 취소: tenant=${tenantId} → free`)
    return this.toDto(canceled)
  }

  /**
   * 웹훅 처리 — 어댑터로 서명 검증·정규화한 뒤 상태 머신에 적용하고 tenant.plan 을 동기화.
   * @returns 검증 실패면 null(컨트롤러는 400).
   */
  async handleWebhook(
    provider: BillingProvider,
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<SubscriptionDto | null> {
    // 설정된 어댑터와 경로 provider 가 다르면, 해당 provider 의 어댑터로 검증(테스트·멀티프로바이더 대비).
    const adapter =
      provider === this.adapter.provider ? this.adapter : createBillingAdapter(provider)
    const event = adapter.verifyWebhook({ rawBody, headers })
    if (!event) return null
    return this.applyWebhookEvent(event)
  }

  /** 정규화된 웹훅 이벤트를 구독·테넌트에 반영. */
  private async applyWebhookEvent(event: NormalizedWebhookEvent): Promise<SubscriptionDto> {
    const sub = await this.store.getOrCreate(event.tenantId, event.provider)
    const updated = applyEvent(sub, {
      event: event.event,
      plan: event.plan,
      providerSubscriptionId: event.providerSubscriptionId,
      periodEnd:
        event.periodEnd ??
        (event.event === 'activated' || event.event === 'reactivated'
          ? periodEndFromNow()
          : undefined),
    })
    const saved = await this.store.save(updated)
    // tenant.plan 동기화 — 구독 plan 을 권위 소스로.
    try {
      await this.tenants.setPlan(event.tenantId, saved.plan as Plan)
    } catch (err) {
      this.logger.warn(`tenant.plan 동기화 실패(tenant=${event.tenantId}): ${(err as Error).message}`)
    }
    this.logger.log(
      `웹훅 ${event.provider}/${event.rawType} → ${saved.status} (plan=${saved.plan}) tenant=${event.tenantId}`
    )
    return this.toDto(saved)
  }

  private toDto(sub: Subscription): SubscriptionDto {
    return {
      tenantId: sub.tenantId,
      plan: sub.plan,
      status: sub.status,
      provider: sub.provider,
      periodEnd: sub.periodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      showBadge: shouldShowBadge(sub.plan),
    }
  }
}
