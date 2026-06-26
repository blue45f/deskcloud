import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { CommunityService } from './community.service'
import {
  createPostSchema,
  type CommunityListDto,
  type CommunityPostDto,
  type CreatePostInput,
} from './tokens'

/**
 * 커뮤니티 API — 형제 앱이 공개 REST 로 직접 호출(SDK 불필요, 키 인증 없음, CORS 개방).
 *  - `GET    /api/v1/apps/:appId/community/posts?kind=` — 글 목록(채팅·게시판·댓글)
 *  - `POST   /api/v1/apps/:appId/community/posts`        — 글 작성
 *  - `DELETE /api/v1/apps/:appId/community/posts/:id?authorKey=` — 본인 글 삭제
 */
@ApiTags('community')
@Controller('v1/apps/:appId/community/posts')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @ApiOperation({ summary: '커뮤니티 글 목록(공개) — ?kind=chat|board|comment' })
  list(@Param('appId') appId: string, @Query('kind') kind?: string): Promise<CommunityListDto> {
    return this.community.list(appId, kind)
  }

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '커뮤니티 글 작성(공개)' })
  create(
    @Param('appId') appId: string,
    @Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput
  ): Promise<CommunityPostDto> {
    return this.community.create(appId, body)
  }

  @Delete(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '본인 글 삭제(공개) — ?authorKey=' })
  remove(
    @Param('appId') appId: string,
    @Param('id') id: string,
    @Query('authorKey') authorKey?: string
  ): Promise<{ deleted: boolean }> {
    return this.community.remove(appId, id, authorKey)
  }
}
