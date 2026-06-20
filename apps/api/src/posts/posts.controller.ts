import {
  createCommentSchema,
  createPostSchema,
  trackVisitSchema,
  type CreateCommentInput,
  type CreatePostInput,
  type PostDetailDto,
  type PostReceiptDto,
  type TrackVisitInput,
} from '@communitydesk/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { PostsService } from './posts.service'

/**
 * 공개(publishable) — 위젯/호스트 앱이 글을 읽고, 멤버(memberId)를 대신해 글·댓글을 작성한다.
 * 인증: x-pk(또는 ?pk=) + Origin 허용목록. 엔드유저 인증은 호스트 앱이 책임진다.
 */
@ApiTags('posts (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('posts')
@UseGuards(PublishableKeyGuard)
export class PostsPublicController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '글 작성(마크다운 살균, usage 증가). 영수증(id·status) 반환' })
  create(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput
  ): Promise<PostReceiptDto> {
    return this.posts.createPost(tenantOf(req), body)
  }

  @Get(':id')
  @ApiHeader({
    name: 'X-Member-Id',
    required: false,
    description: '읽는 멤버 식별자(있으면 오늘 고유 방문자 집계에 사용)',
  })
  @ApiParam({ name: 'id', description: '글 id(uuid)' })
  @ApiOperation({ summary: '글 상세 + 중첩 댓글 트리(읽기 카운트 증가)' })
  detail(@Req() req: TenantRequest, @Param('id') id: string): Promise<PostDetailDto> {
    const memberId = req.headers['x-member-id']
    const visitorId = Array.isArray(memberId) ? memberId[0] : memberId
    return this.posts.getPostDetail(tenantOf(req), id, visitorId)
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiParam({ name: 'id', description: '글 id(uuid)' })
  @ApiOperation({ summary: '중첩 댓글 작성(parentId 로 답글). 잠긴 글은 거부' })
  comment(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput
  ): Promise<PostReceiptDto> {
    return this.posts.createComment(tenantOf(req), id, body)
  }
}

/**
 * 방문 핑(공개) — 호스트 앱/위젯이 글을 열지 않아도 페이지뷰를 1회 기록한다.
 * 인증: x-pk + Origin 허용목록(글 컨트롤러와 동일). memberId 가 있으면 고유 방문자에 반영.
 */
@ApiTags('posts (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('visits')
@UseGuards(PublishableKeyGuard)
export class VisitsPublicController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '방문(페이지뷰) 1회 기록 — 오늘 트래픽/방문자 집계' })
  async track(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(trackVisitSchema)) body: TrackVisitInput
  ): Promise<void> {
    await this.posts.recordVisit(tenantOf(req).id, body.memberId)
  }
}
