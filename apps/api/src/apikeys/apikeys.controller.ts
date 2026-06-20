import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  createApiKeySchema,
  type ApiKeyCreatedDto,
  type ApiKeyDto,
  type CreateApiKeyInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ApiKeysService } from './apikeys.service'

import type { AuthUser } from '../common/request-context'

@ApiTags('api-keys')
@ApiBearerAuth('session')
@Controller('apikeys')
@UseGuards(SessionGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @RequirePermission('apikey.manage')
  @ApiOperation({ summary: 'API 키 목록' })
  list(@CurrentUser() user: AuthUser): Promise<ApiKeyDto[]> {
    return this.apiKeys.list(user.orgId)
  }

  @Post()
  @RequirePermission('apikey.manage')
  @ApiOperation({ summary: 'API 키 발급(평문은 1회만 노출)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput
  ): Promise<ApiKeyCreatedDto> {
    return this.apiKeys.create(user.orgId, user, body)
  }

  @Delete(':id')
  @RequirePermission('apikey.manage')
  @ApiOperation({ summary: 'API 키 폐기' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.apiKeys.revoke(user.orgId, user, id)
  }
}
