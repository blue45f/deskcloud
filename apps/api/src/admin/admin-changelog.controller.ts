import {
  createEntrySchema,
  updateEntrySchema,
  type AdminEntryListDto,
  type ChangelogEntryDto,
  type CreateEntryInput,
  type OkDto,
  type UpdateEntryInput,
} from '@changelogdesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'

import { ChangelogService } from '../changelog/changelog.service'
import { ZodValidationPipe } from '../common/zod.pipe'
import { AdminAuthGuard } from '../tenants/admin-auth.guard'
import { type AuthedRequest } from '../tenants/request-context'
import { resolveAdminTenant } from '../tenants/resolve-admin-tenant'
import { TenantContextService } from '../tenants/tenant-context.service'

/**
 * 어드민(시크릿 키 x-sk 또는 글로벌 X-Admin-Token) — 체인지로그 CRUD + 게시.
 * admin-token 인증 시 x-tenant-id 헤더로 대상 테넌트를 지정한다.
 */
@ApiTags('admin: changelog')
@ApiHeader({ name: 'x-sk', required: false, description: '테넌트 시크릿 키(sk_…)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '글로벌 ADMIN_TOKEN' })
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'admin-token 인증 시 대상 테넌트 id/slug',
})
@Controller('admin/changelog')
@UseGuards(AdminAuthGuard)
export class AdminChangelogController {
  constructor(
    private readonly changelog: ChangelogService,
    private readonly ctx: TenantContextService
  ) {}

  @Get()
  @ApiOperation({ summary: '항목 목록(게시·미게시 모두, 최신순)' })
  async list(@Req() req: AuthedRequest): Promise<AdminEntryListDto> {
    return this.changelog.listAdmin(await resolveAdminTenant(req, this.ctx))
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: '항목 UUID' })
  @ApiOperation({ summary: '항목 단건' })
  async getOne(@Req() req: AuthedRequest, @Param('id') id: string): Promise<ChangelogEntryDto> {
    return this.changelog.getOne(await resolveAdminTenant(req, this.ctx), id)
  }

  @Post()
  @ApiOperation({ summary: '항목 생성(isPublished=true 면 즉시 게시)' })
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createEntrySchema)) body: CreateEntryInput
  ): Promise<ChangelogEntryDto> {
    return this.changelog.create(await resolveAdminTenant(req, this.ctx), body)
  }

  @Put(':id')
  @ApiParam({ name: 'id', description: '항목 UUID' })
  @ApiOperation({ summary: '항목 수정(부분 갱신·게시 토글)' })
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEntrySchema)) body: UpdateEntryInput
  ): Promise<ChangelogEntryDto> {
    return this.changelog.update(await resolveAdminTenant(req, this.ctx), id, body)
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: '항목 UUID' })
  @ApiOperation({ summary: '항목 삭제' })
  async remove(@Req() req: AuthedRequest, @Param('id') id: string): Promise<OkDto> {
    await this.changelog.remove(await resolveAdminTenant(req, this.ctx), id)
    return { ok: true }
  }
}
