import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  createPolicySchema,
  updatePolicySchema,
  type CreatePolicyInput,
  type PolicyDto,
  type UpdatePolicyInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { PoliciesService } from './policies.service'

import type { AuthUser } from '../common/request-context'

@ApiTags('policies')
@ApiBearerAuth('session')
@Controller('policies')
@UseGuards(SessionGuard)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '정책 목록' })
  list(@CurrentUser() user: AuthUser): Promise<PolicyDto[]> {
    return this.policies.list(user.orgId)
  }

  @Post()
  @RequirePermission('policy.write')
  @ApiOperation({ summary: '정책 생성(빈 레지스트리 등록)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPolicySchema)) body: CreatePolicyInput
  ): Promise<PolicyDto> {
    return this.policies.create(user.orgId, user, body)
  }

  @Get(':idOrSlug')
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '정책 단건(id 또는 slug)' })
  findOne(@CurrentUser() user: AuthUser, @Param('idOrSlug') idOrSlug: string): Promise<PolicyDto> {
    return this.policies.findOne(user.orgId, idOrSlug)
  }

  @Patch(':idOrSlug')
  @RequirePermission('policy.write')
  @ApiOperation({ summary: '정책 메타데이터 수정' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodValidationPipe(updatePolicySchema)) body: UpdatePolicyInput
  ): Promise<PolicyDto> {
    return this.policies.update(user.orgId, user, idOrSlug, body)
  }

  @Delete(':idOrSlug')
  @RequirePermission('policy.write')
  @ApiOperation({ summary: '정책 보관(archive)' })
  archive(
    @CurrentUser() user: AuthUser,
    @Param('idOrSlug') idOrSlug: string
  ): Promise<{ ok: true }> {
    return this.policies.archive(user.orgId, user, idOrSlug)
  }
}
