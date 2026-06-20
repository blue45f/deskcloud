import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { AuditService } from '../common/audit.service'

import type { AuthUser } from '../common/request-context'
import type { AuditEventDto } from '@termsdesk/shared'

@ApiTags('audit')
@ApiBearerAuth('session')
@Controller('audit')
@UseGuards(SessionGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  @ApiOperation({ summary: '감사 로그(변경 이력) — append-only' })
  list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string): Promise<AuditEventDto[]> {
    return this.audit.list(user.orgId, limit ? Number(limit) : 100)
  }
}
