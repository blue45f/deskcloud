import { Controller, Get, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { StorageService } from '../storage/storage.service'
import { TransformService } from '../transform/transform.service'

import type { Response } from 'express'

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly storage: StorageService,
    private readonly transform: TransformService
  ) {}

  @Get()
  @ApiOperation({ summary: 'liveness' })
  health(): { status: string; service: string; storage: string; transform: boolean } {
    return {
      status: 'ok',
      service: 'mediadesk-api',
      storage: this.storage.driver,
      transform: this.transform.available,
    }
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
