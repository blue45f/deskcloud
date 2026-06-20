import { visitPingSchema, type StatsOverviewDto, type VisitPingInput } from '@filedesk/shared'
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { StatsService } from './stats.service'

/**
 * 운영 현황 API — 공개(가드 없음) 집계.
 *
 * - GET /stats/overview: 크로스 테넌트 합계만(테넌트 이름·키 없음) → 인증 없이 노출해도 안전.
 * - POST /stats/visit: 방문 핑(브라우저/일 1회). 멱등 중복 제거, 서버가 일 버킷 계산.
 */
@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: '운영 현황(공개 집계) — 총/오늘 가입 수, 총 트래픽, 오늘 방문자 수 (인증 불요)',
  })
  overview(): Promise<StatsOverviewDto> {
    return this.stats.overview()
  }

  @Post('visit')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '방문 핑 — 브라우저/일 1회. clientId(무작위)만 받아 익명 집계(IP/PII 미저장)',
  })
  async visit(@Body(new ZodValidationPipe(visitPingSchema)) body: VisitPingInput): Promise<void> {
    await this.stats.recordVisit(body.clientId)
  }
}
