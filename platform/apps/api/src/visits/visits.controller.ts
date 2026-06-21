import { visitPingSchema, type VisitPingInput, type VisitStatsDto } from '@desk/shared'
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { VisitsService } from './visits.service'

/**
 * 방문/트래픽 API — 형제 앱이 공개 REST 로 직접 호출하는 경량 카운터(SDK 불필요).
 *
 * 공개(키 인증 없음, CORS 개방):
 *  - `POST /api/v1/apps/:appId/visits/ping`  — 오늘 방문 +1(newVisitor 면 고유도 +1).
 *  - `GET  /api/v1/apps/:appId/visits/stats` — 오늘/전체 방문·고유 방문자 집계.
 *
 * 클라이언트가 브라우저당 1일 1회로 디바운스하고, 서버는 IP 스로틀로 폭주만 막는다.
 */
@ApiTags('visits')
@Controller('v1/apps/:appId/visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('ping')
  @HttpCode(202)
  // 공개 핑 — 봇/스팸 폭주 방지를 위해 IP당 분당 60건으로 스로틀.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '방문 핑(공개) — 오늘 방문 +1, newVisitor 면 고유 방문자도 +1' })
  async ping(
    @Param('appId') appId: string,
    @Body(new ZodValidationPipe(visitPingSchema)) body: VisitPingInput
  ): Promise<{ accepted: true }> {
    await this.visits.ping(appId, body)
    // 봇에 단서를 주지 않고 핑은 fire-and-forget 의미라 본문 없이 202.
    return { accepted: true }
  }

  @Get('stats')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '방문 집계(공개) — 오늘/전체 방문·고유 방문자 수' })
  stats(@Param('appId') appId: string): Promise<VisitStatsDto> {
    return this.visits.stats(appId)
  }
}
