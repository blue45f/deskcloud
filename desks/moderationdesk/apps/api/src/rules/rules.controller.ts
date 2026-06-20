import {
  createRuleSchema,
  updateRuleSchema,
  type CreateRuleInput,
  type RuleDto,
  type UpdateRuleInput,
} from '@moderationdesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { RulesService } from './rules.service'

/**
 * 어드민 금칙 규칙 CRUD — 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정(SecretKeyGuard).
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin/rules')
@UseGuards(SecretKeyGuard)
export class AdminRulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @ApiOperation({ summary: '금칙 규칙 목록(최신순)' })
  list(@Req() req: TenantRequest): Promise<RuleDto[]> {
    return this.rules.listRules(tenantOf(req))
  }

  @Post()
  @ApiOperation({ summary: '규칙 생성(pattern·kind·action·label·enabled)' })
  create(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createRuleSchema)) body: CreateRuleInput
  ): Promise<RuleDto> {
    return this.rules.createRule(tenantOf(req), body)
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: '규칙 id(uuid)' })
  @ApiOperation({ summary: '규칙 수정(부분 갱신)' })
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRuleSchema)) body: UpdateRuleInput
  ): Promise<RuleDto> {
    return this.rules.updateRule(tenantOf(req), id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: '규칙 id(uuid)' })
  @ApiOperation({ summary: '규칙 삭제' })
  async remove(@Req() req: TenantRequest, @Param('id') id: string): Promise<void> {
    await this.rules.deleteRule(tenantOf(req), id)
  }
}
