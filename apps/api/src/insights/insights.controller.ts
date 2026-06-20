import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'

import { InsightsService } from './insights.service'

import type { AuthUser } from '../common/request-context'
import type { ApiKeyUsageDto, ConsentTrendPointDto, ReconsentStatusDto } from '@termsdesk/shared'

/** 대시보드 운영 인사이트(읽기 전용 집계) — 카드별로 기존 권한 모델을 그대로 따른다. */
@ApiTags('insights')
@ApiBearerAuth('session')
@Controller('insights')
@UseGuards(SessionGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('consents/daily')
  @RequirePermission('consent.read')
  @ApiOperation({ summary: '동의 추이 — 일자(UTC) 버킷 집계, 기본 최근 30일(7~90 클램프)' })
  consentTrend(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string
  ): Promise<ConsentTrendPointDto[]> {
    return this.insights.consentTrend(user.orgId, days ? Number(days) : 30)
  }

  @Get('reconsent')
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '재동의 필요 현황 — 현재 게시본 해시 불일치 subjectRef 수(정책별)' })
  reconsentStatus(@CurrentUser() user: AuthUser): Promise<ReconsentStatusDto[]> {
    return this.insights.reconsentStatus(user.orgId)
  }

  @Get('apikeys')
  @RequirePermission('apikey.manage')
  @ApiOperation({ summary: 'API 키 사용 — last_used_at + audit_events 30일 동의 기록 집계' })
  apiKeyUsage(@CurrentUser() user: AuthUser): Promise<ApiKeyUsageDto> {
    return this.insights.apiKeyUsage(user.orgId)
  }
}
