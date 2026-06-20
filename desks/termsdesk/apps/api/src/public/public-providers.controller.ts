import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { PublicProvidersService } from './public-providers.service'

import type { ProviderProfileDto, ProviderProfileListDto } from '@termsdesk/shared'
import type { Response } from 'express'

function setTotal(res: Response, total: number): void {
  res.setHeader('X-Total-Count', String(total))
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
}

@ApiTags('public-providers')
@Controller('public/providers')
export class PublicProvidersController {
  constructor(private readonly providers: PublicProvidersService) {}

  @Get()
  @ApiOperation({ summary: '공개 전문가 디렉터리 — active=true, 연락처 비노출' })
  async list(
    @Res({ passthrough: true }) res: Response,
    @Query('specialty') specialty?: string
  ): Promise<ProviderProfileListDto> {
    const result = await this.providers.list({ specialty })
    setTotal(res, result.total)
    return result
  }

  @Get(':id')
  @ApiOperation({ summary: '공개 전문가 프로필 — active=true, 연락처 비노출' })
  getOne(@Param('id') id: string): Promise<ProviderProfileDto> {
    return this.providers.get(id)
  }
}
