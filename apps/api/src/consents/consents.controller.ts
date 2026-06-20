import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  recordConsentSchema,
  type ConsentReceiptCreatedDto,
  type ConsentReceiptDto,
  type RecordConsentInput,
} from '@termsdesk/shared'

import { ApiKeyGuard } from '../auth/api-key.guard'
import {
  ClientIp,
  CurrentApiKey,
  CurrentUser,
  RequirePermission,
  RequireScope,
} from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ConsentsService } from './consents.service'

import type { ApiKeyContext, AuthUser } from '../common/request-context'
import type { Response } from 'express'

/** 공개(API 키) — SDK 가 동의 영수증을 기록. */
@ApiTags('public')
@ApiBearerAuth('apiKey')
@Controller('v1/consents')
@UseGuards(ApiKeyGuard)
export class PublicConsentController {
  constructor(private readonly consents: ConsentsService) {}

  @Post()
  @RequireScope('write:consent')
  @ApiOperation({ summary: '동의 영수증 기록 (append-only)' })
  record(
    @CurrentApiKey() key: ApiKeyContext,
    @ClientIp() ip: string,
    @Body(new ZodValidationPipe(recordConsentSchema)) body: RecordConsentInput
  ): Promise<ConsentReceiptCreatedDto> {
    return this.consents.record(key.orgId, body, ip)
  }
}

/** 대시보드(세션) — 영수증 조회/감사. */
@ApiTags('consents')
@ApiBearerAuth('session')
@Controller('consents')
@UseGuards(SessionGuard)
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get()
  @RequirePermission('consent.read')
  @ApiOperation({
    summary: '동의 영수증 목록(필터: subjectRef·policySlug·decision·method·from·to, offset/limit)',
  })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('subjectRef') subjectRef?: string,
    @Query('policySlug') policySlug?: string,
    @Query('decision') decision?: string,
    @Query('method') method?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<ConsentReceiptDto[]> {
    const filter = {
      subjectRef,
      policySlug,
      decision,
      method,
      from,
      to,
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    }
    const [items, total] = await Promise.all([
      this.consents.list(user.orgId, filter),
      this.consents.count(user.orgId, filter),
    ])
    res.setHeader('X-Total-Count', String(total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return items
  }

  @Get('subject/:subjectRef')
  @RequirePermission('consent.read')
  @ApiOperation({ summary: '특정 대상의 전체 동의 이력' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('subjectRef') subjectRef: string
  ): Promise<ConsentReceiptDto[]> {
    return this.consents.list(user.orgId, { subjectRef, limit: 500 })
  }
}
