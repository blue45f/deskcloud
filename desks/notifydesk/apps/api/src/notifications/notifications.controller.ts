import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { notifySchema, type NotifyInput, type NotifyResultDto } from '@notifydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { SecretKeyGuard } from '../tenants/secret-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'

import { NotificationsService } from './notifications.service'

/** 서버 발송(secret 키 또는 ADMIN_TOKEN) — 수신자에게 채널 발송(선호·템플릿 반영). */
@ApiTags('notify (secret)')
@ApiHeader({ name: 'Authorization', required: false, description: 'Bearer sk_… (secret 키)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '플랫폼 어드민 토큰(+ ?tenantId)' })
@Controller('notify')
@UseGuards(SecretKeyGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: '알림 발송 — templateKey(렌더) 또는 title/body(애드혹). 선호·소프트 캡 적용',
  })
  notify(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(notifySchema)) body: NotifyInput
  ): Promise<NotifyResultDto> {
    const { tenant } = getTenantCtx(req)
    return this.notifications.notify(tenant, body, this.cfg)
  }
}
