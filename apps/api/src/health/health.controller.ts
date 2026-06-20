import { Controller, Get, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'

import type { Response } from 'express'

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly dbs: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'liveness' })
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'reviewdesk-api' }
  }

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' }
  }

  @Get('ready')
  @ApiOperation({ summary: 'readiness — DB SELECT 1 (다운 시 503)' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<{ status: string; db: string }> {
    try {
      await this.dbs.db.execute(sql`SELECT 1`)
      return { status: 'ready', db: this.dbs.kind }
    } catch {
      res.status(503)
      return { status: 'unavailable', db: this.dbs.kind }
    }
  }
}
