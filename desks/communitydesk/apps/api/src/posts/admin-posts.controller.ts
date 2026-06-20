import {
  adminPostsQuerySchema,
  moderateCommentSchema,
  moderatePostSchema,
  type AdminPostListDto,
  type AdminPostsQuery,
  type AdminStatsDto,
  type ModerateCommentInput,
  type ModeratePostInput,
} from '@communitydesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { PostsService } from './posts.service'

import type { Response } from 'express'

/**
 * 어드민 — 글/댓글 검수·운영. 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정.
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin')
@UseGuards(SecretKeyGuard)
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      '운영 대시보드 지표 — 오늘 방문자/트래픽(추적), 총 트래픽, 오늘/총 가입(멤버). ' +
      '글로벌 토큰 인증 시 플랫폼 전역(테넌트 수)도 포함',
  })
  stats(@Req() req: TenantRequest): Promise<AdminStatsDto> {
    return this.posts.getStats(tenantOf(req), req.adminMode === 'admin-token')
  }

  @Get('posts')
  @ApiOperation({ summary: '글 목록 — boardSlug/status/tag 필터, 페이지네이션(offset/limit)' })
  async list(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Query(new ZodValidationPipe(adminPostsQuerySchema)) query: AdminPostsQuery
  ): Promise<AdminPostListDto> {
    const result = await this.posts.listAdminPosts(tenantOf(req), query)
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Patch('posts/:id')
  @ApiParam({ name: 'id', description: '글 id(uuid)' })
  @ApiOperation({ summary: '글 운영 — show|hide|pin|unpin|lock|unlock|approve' })
  async moderatePost(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderatePostSchema)) body: ModeratePostInput
  ): Promise<{ ok: true }> {
    await this.posts.moderatePost(tenantOf(req), id, body)
    return { ok: true }
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: '글 id(uuid)' })
  @ApiOperation({ summary: '글 삭제(댓글 함께 정리)' })
  async removePost(@Req() req: TenantRequest, @Param('id') id: string): Promise<void> {
    await this.posts.deletePost(tenantOf(req), id)
  }

  @Patch('comments/:id')
  @ApiParam({ name: 'id', description: '댓글 id(uuid)' })
  @ApiOperation({ summary: '댓글 운영 — show|hide|approve' })
  async moderateComment(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateCommentSchema)) body: ModerateCommentInput
  ): Promise<{ ok: true }> {
    await this.posts.moderateComment(tenantOf(req), id, body)
    return { ok: true }
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: '댓글 id(uuid)' })
  @ApiOperation({ summary: '댓글 삭제' })
  async removeComment(@Req() req: TenantRequest, @Param('id') id: string): Promise<void> {
    await this.posts.deleteComment(tenantOf(req), id)
  }
}
