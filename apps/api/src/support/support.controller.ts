import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { SupportService } from './support.service'

import type { CreateSupportPostInput, SupportPostDto, SupportPostListDto } from '@termsdesk/shared'

type CreateSupportPostBody = Omit<CreateSupportPostInput, 'projectSlug'>

@ApiTags('public-support')
@Controller('public/support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get(':projectSlug/posts')
  @ApiOperation({ summary: '공개 지원 게시판 목록(사이트 문의·제휴·버그)' })
  list(
    @Param('projectSlug') projectSlug: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string
  ): Promise<SupportPostListDto> {
    return this.support.list(projectSlug, { category, limit })
  }

  @Post(':projectSlug/posts')
  @ApiOperation({ summary: '공개 지원 게시글 생성(연락처는 공개 응답에서 제외)' })
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() body: CreateSupportPostBody
  ): Promise<SupportPostDto> {
    return this.support.create({
      ...body,
      projectSlug,
    })
  }
}
