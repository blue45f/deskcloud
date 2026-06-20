import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  type Type,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { checkLimit, type CheckLimitResult, type PlanBearer } from '../enforce-limit'

/**
 * 사용량 한도 가드(NestJS 어댑터) — Desk 가 라우트에 붙여 "작업 전" 한도를 강제한다.
 *
 * Desk 는 두 가지를 제공한다:
 *  1) `@EnforceLimit('responses')` — 어느 메트릭을 강제할지(데코레이터 메타데이터).
 *  2) `UsageLimitResolver` — 요청에서 (테넌트 plan, 현재 사용량)을 가져오는 콜백(주입).
 *
 * hard-cap(Free 초과)이면 402-스러운 ForbiddenException(업그레이드 URL 포함) 으로 차단,
 * soft-cap 은 통과시키되 결과를 `req.deskLimit` 에 부착(컨트롤러가 경고 헤더/배너에 활용).
 */

export const ENFORCE_LIMIT_KEY = 'desk:enforce-limit'

/** 라우트에 강제할 메트릭을 지정. */
export const EnforceLimit = (metric: string): MethodDecorator & ClassDecorator =>
  SetMetadata(ENFORCE_LIMIT_KEY, metric)

/** request 에 부착되는 한도 평가 결과 키. */
export const LIMIT_CONTEXT_KEY = 'deskLimit' as const

/**
 * Desk 가 구현해 주입하는 리졸버 — 요청 컨텍스트에서 테넌트 plan 과 현재 사용량을 가져온다.
 * (core 의 SecretKeyGuard 가 부착한 req.deskTenant + UsageMeter 를 조합하면 됨.)
 */
export interface UsageLimitResolver {
  /** 요청·메트릭으로 (plan 보유 테넌트, 현재 사용량) 을 반환. null 이면 가드는 통과(미인증 등). */
  resolve(
    req: unknown,
    metric: string
  ): Promise<{ tenant: PlanBearer; current: number } | null>
}

/** UsageLimitResolver 주입 토큰. */
export const USAGE_LIMIT_RESOLVER = Symbol('DESK_USAGE_LIMIT_RESOLVER')

@Injectable()
export class UsageLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: UsageLimitResolver
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metric = this.reflector.getAllAndOverride<string | undefined>(ENFORCE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!metric) return true // 강제할 메트릭이 없으면 통과

    const req = context.switchToHttp().getRequest<Record<string, unknown>>()
    const resolved = await this.resolver.resolve(req, metric)
    if (!resolved) return true

    const result: CheckLimitResult = checkLimit(resolved.tenant, metric, resolved.current)
    req[LIMIT_CONTEXT_KEY] = result

    if (!result.allowed) {
      throw new ForbiddenException({
        error: 'plan_limit_exceeded',
        message: result.reason,
        metric,
        plan: result.plan,
        limit: result.limit,
        used: result.used,
        upgradeUrl: result.upgradeUrl,
        suggestedPlan: result.suggestedPlan,
      })
    }
    return true
  }
}

/**
 * Desk 모듈에 가드를 등록하는 헬퍼 — resolver 구현 클래스를 받아 프로바이더 배열을 만든다.
 * @example
 *   providers: [...usageLimitProviders(MyResolver)]
 */
export function usageLimitProviders(resolverClass: Type<UsageLimitResolver>): unknown[] {
  return [
    resolverClass,
    { provide: USAGE_LIMIT_RESOLVER, useExisting: resolverClass },
    {
      provide: UsageLimitGuard,
      useFactory: (reflector: Reflector, resolver: UsageLimitResolver) =>
        new UsageLimitGuard(reflector, resolver),
      inject: [Reflector, USAGE_LIMIT_RESOLVER],
    },
  ]
}
