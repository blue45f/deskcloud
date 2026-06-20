import { BadRequestException, Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  recipientIdSchema,
  updatePreferencesSchema,
  type PreferencesDto,
  type UpdatePreferencesInput,
} from '@notifydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'

import { PreferencesService } from './preferences.service'

/** 공개(publishable 키 + Origin) — 사용자가 자기 알림 선호를 조회/갱신한다. */
@ApiTags('preferences (publishable)')
@ApiHeader({ name: 'Authorization', required: true, description: 'Bearer pk_… (publishable 키)' })
@Controller('preferences')
@UseGuards(PublishableKeyGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  @ApiQuery({ name: 'recipientId', required: true })
  @ApiOperation({ summary: '선호 설정 조회(없으면 빈 목록 = 전부 허용)' })
  get(@Req() req: AuthedRequest, @Query('recipientId') recipientId: string): Promise<PreferencesDto> {
    const { tenant } = getTenantCtx(req)
    const rid = this.parseRecipientId(recipientId)
    return this.preferences.get(tenant.id, rid)
  }

  @Put()
  @ApiOperation({ summary: '선호 설정 일괄 갱신((type,channel)별 on/off)' })
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updatePreferencesSchema)) body: UpdatePreferencesInput
  ): Promise<PreferencesDto> {
    const { tenant } = getTenantCtx(req)
    return this.preferences.update(tenant.id, body)
  }

  private parseRecipientId(value: string): string {
    const result = recipientIdSchema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException('recipientId 쿼리 파라미터가 유효하지 않습니다')
    }
    return result.data
  }
}
