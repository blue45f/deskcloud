import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  updateOrgPlanSchema,
  updateOrgSchema,
  type OrgDto,
  type PlanUsageDto,
  type UpdateOrgInput,
  type UpdateOrgPlanInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { PlanService } from '../common/plan.service'
import { ZodValidationPipe } from '../common/zod.pipe'

import { OrgsService } from './orgs.service'

import type { AuthUser } from '../common/request-context'

@ApiTags('org')
@ApiBearerAuth('session')
@Controller('org')
@UseGuards(SessionGuard)
export class OrgsController {
  constructor(
    private readonly orgs: OrgsService,
    private readonly plans: PlanService
  ) {}

  @Patch()
  @RequirePermission('member.manage')
  @ApiOperation({ summary: '조직 정보 수정(이름)' })
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateOrgSchema)) body: UpdateOrgInput
  ): Promise<OrgDto> {
    return this.orgs.update(user.orgId, user, body)
  }

  @Get('usage')
  @ApiOperation({ summary: '현재 플랜·한도·사용량(멤버/정책/API 키/이번 달 호출)' })
  usage(@CurrentUser() user: AuthUser): Promise<PlanUsageDto> {
    return this.plans.usage(user.orgId)
  }

  @Patch('plan')
  @RequirePermission('member.manage')
  @ApiOperation({ summary: '플랜 변경(mock 청구) — 결정 기록만, 실제 결제 없음' })
  changePlan(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateOrgPlanSchema)) body: UpdateOrgPlanInput
  ): Promise<OrgDto> {
    return this.orgs.changePlan(user.orgId, user, body)
  }
}
