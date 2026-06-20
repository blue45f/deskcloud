import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  inviteMemberSchema,
  updateMemberSchema,
  type InviteMemberInput,
  type MemberDto,
  type UpdateMemberInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { MembersService } from './members.service'

import type { AuthUser } from '../common/request-context'

@ApiTags('members')
@ApiBearerAuth('session')
@Controller('members')
@UseGuards(SessionGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: '조직 멤버 목록' })
  list(@CurrentUser() user: AuthUser): Promise<MemberDto[]> {
    return this.members.list(user.orgId)
  }

  @Post()
  @RequirePermission('member.manage')
  @ApiOperation({ summary: '멤버 추가(역할 부여)' })
  invite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput
  ): Promise<MemberDto> {
    return this.members.invite(user.orgId, user, body)
  }

  @Patch(':id')
  @RequirePermission('member.manage')
  @ApiOperation({ summary: '멤버 역할 변경' })
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: UpdateMemberInput
  ): Promise<MemberDto> {
    return this.members.updateRole(user.orgId, user, id, body)
  }

  @Delete(':id')
  @RequirePermission('member.manage')
  @ApiOperation({ summary: '멤버 삭제' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.members.remove(user.orgId, user, id)
  }
}
