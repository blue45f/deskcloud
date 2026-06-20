import { randomUUID } from 'node:crypto'

import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { type PlatformStatsDto } from '@searchdesk/shared'

import { VisitsService } from './visits.service'

import type { Request, Response } from 'express'

/** 첫 파티 방문자 식별 쿠키 — httpOnly, ~30일. unique-vs-returning 판정에만 쓴다. */
const VISITOR_COOKIE = 'sd_vid'
const VISITOR_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Cookie 헤더에서 단일 쿠키 값을 꺼낸다(cookie-parser 미사용 — 의존성 경량). */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

/**
 * 플랫폼 현황(공개·무인증) — health 컨트롤러 스타일. 테넌트 가드 없음, 교차 테넌트 데이터 없음.
 * - POST /api/stats/visit : 방문 핑(멱등). sd_vid 쿠키로 신규/재방문 판정 후 visits 누적.
 * - GET  /api/stats       : PlatformStatsDto(가입 실측 + 트래픽 추적).
 */
@ApiTags('stats (public)')
@Controller('stats')
export class StatsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('visit')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '방문 핑 — 첫 파티 쿠키로 오늘 방문/고유 방문자 누적(공개)' })
  recordVisit(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const existing = readCookie(req, VISITOR_COOKIE)
    const visitorIsNew = !existing
    if (visitorIsNew) {
      res.cookie(VISITOR_COOKIE, randomUUID(), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: VISITOR_COOKIE_MAX_AGE_MS,
        path: '/',
      })
    }
    // 비차단 쓰기 — 실패해도 응답은 204(추적은 베스트에포트).
    void this.visits.recordVisit({ visitorIsNew }).catch(() => undefined)
  }

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '플랫폼 현황 — 오늘/총 방문자·가입(공개, 테넌트별 데이터 없음)' })
  getStats(): Promise<PlatformStatsDto> {
    return this.visits.getPlatformStats()
  }
}
