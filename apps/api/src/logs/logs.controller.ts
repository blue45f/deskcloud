import { adminLogQuerySchema, type AdminLogQuery, type LogListDto } from '@moderationdesk/shared'
import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { LogsService } from './logs.service'

import type { Response } from 'express'

/**
 * 어드민 모더레이션 로그 — 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정(SecretKeyGuard).
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin/logs')
@UseGuards(SecretKeyGuard)
export class AdminLogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  @ApiOperation({ summary: '모더레이션 로그 목록 — verdict 필터, 페이지네이션(offset/limit)' })
  async list(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Query(new ZodValidationPipe(adminLogQuerySchema)) query: AdminLogQuery
  ): Promise<LogListDto> {
    const result = await this.logs.listLogs(tenantOf(req), query)
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }
}
