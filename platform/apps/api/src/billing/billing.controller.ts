import { type BillingProvider } from '@desk/billing'
import { type TenantRecord } from '@desk/core'
import { SecretKeyGuard } from '@desk/core/nest'
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutResponseDto,
  type PlanSummaryDto,
  type SubscriptionDto,
} from '@desk/shared'
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { BillingService } from './billing.service'

import type { Request } from 'express'

const PROVIDERS: BillingProvider[] = ['stub', 'toss', 'stripe']

/** SecretKeyGuard 가 부착한 인증 테넌트를 req 에서 꺼낸다. */
function tenantOf(req: Request): TenantRecord {
  return (req as unknown as Record<string, TenantRecord>)['deskTenant']
}

/**
 * 빌링 API — 공개 가격표 + secret 키로 보호되는 체크아웃/구독/취소 + 제공자 웹훅(공개, 서명 검증).
 * 모든 결제는 TEST/STUB — 실제 청구 없음.
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: '공개 가격표 — 플랜·한도·기능 플래그' })
  listPlans(): PlanSummaryDto[] {
    return this.billing.listPlans()
  }

  @Post('checkout')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '체크아웃 시작(sk) — {plan} → {checkoutUrl}(스텁). 실제 청구 없음' })
  checkout(
    @Req() req: Request,
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput
  ): Promise<CheckoutResponseDto> {
    return this.billing.checkout(tenantOf(req).id, body)
  }

  @Get('subscription')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '내 구독 조회(sk)' })
  getSubscription(@Req() req: Request): Promise<SubscriptionDto> {
    return this.billing.getSubscription(tenantOf(req).id)
  }

  @Post('cancel')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '구독 취소(sk) → Free 복귀' })
  cancel(@Req() req: Request): Promise<SubscriptionDto> {
    return this.billing.cancel(tenantOf(req).id)
  }

  @Post('webhook/:provider')
  @HttpCode(200)
  @ApiOperation({ summary: '제공자 웹훅(서명 검증, STUB) → 구독/플랜 갱신' })
  async webhook(
    @Param('provider') providerParam: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | undefined>
  ): Promise<SubscriptionDto> {
    const provider = PROVIDERS.find((p) => p === providerParam)
    if (!provider) throw new BadRequestException(`알 수 없는 제공자: ${providerParam}`)
    // STUB 서명 검증은 정규화된 JSON 바디 기준(실제 연동 시 raw bytes HMAC 으로 교체).
    const rawBody = JSON.stringify(body ?? {})
    const result = await this.billing.handleWebhook(provider, rawBody, headers)
    if (!result) throw new BadRequestException('웹훅 서명 검증 실패')
    return result
  }
}
