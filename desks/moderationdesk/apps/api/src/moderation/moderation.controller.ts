import { moderateSchema, type ModerateInput, type ModerateResultDto } from '@moderationdesk/shared'
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ModerateAuthGuard } from '../common/moderate-auth.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ModerationService } from './moderation.service'

/**
 * 모더레이션 검사 — publishable(x-pk, 브라우저) **또는** secret(x-sk, 서버) 키로 호출.
 * 규칙 기반은 항상, Claude AI 보조는 키가 있으면 선택 적용. throttled.
 */
@ApiTags('moderate')
@ApiHeader({ name: 'X-Pk', required: false, description: 'publishable 키(pk_...) — 브라우저' })
@ApiHeader({ name: 'X-Sk', required: false, description: 'secret 키(sk_...) — 서버' })
@Controller('moderate')
@UseGuards(ModerateAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: '텍스트 검사 → { verdict, matchedRules, aiScore? } (규칙 항상 + AI 선택)',
  })
  moderate(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(moderateSchema)) body: ModerateInput
  ): Promise<ModerateResultDto> {
    return this.moderation.moderate(tenantOf(req), body)
  }
}
