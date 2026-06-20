import {
  createBoardSchema,
  publicPostsQuerySchema,
  updateBoardSchema,
  type BoardDto,
  type CreateBoardInput,
  type PostListDto,
  type PublicPostsQuery,
  type UpdateBoardInput,
} from '@communitydesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'
import { PostsService } from '../posts/posts.service'

import { BoardsService } from './boards.service'

import type { Response } from 'express'

/**
 * 공개(publishable) — 위젯이 게시판 목록과 보드별 글 목록을 읽는다.
 * 인증: x-pk(또는 ?pk=) + Origin 허용목록.
 */
@ApiTags('boards (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('boards')
@UseGuards(PublishableKeyGuard)
export class BoardsPublicController {
  constructor(
    private readonly boards: BoardsService,
    private readonly posts: PostsService
  ) {}

  @Get()
  @ApiOperation({ summary: '게시판·카페 목록(노출 글 수 포함)' })
  list(@Req() req: TenantRequest): Promise<BoardDto[]> {
    return this.boards.listBoards(tenantOf(req))
  }

  @Get(':slug/posts')
  @ApiParam({ name: 'slug', example: 'notice' })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'popular', 'replies'] })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiOperation({ summary: '보드의 글 목록(노출 글만, 고정글 우선, 페이지네이션)' })
  async posts_(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(publicPostsQuerySchema)) query: PublicPostsQuery
  ): Promise<PostListDto> {
    const result = await this.posts.listPublicPosts(tenantOf(req), slug, query)
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }
}

/** 어드민 — 게시판 CRUD. 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token. */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin/boards')
@UseGuards(SecretKeyGuard)
export class AdminBoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get()
  @ApiOperation({ summary: '게시판 목록(노출 글 수 포함)' })
  list(@Req() req: TenantRequest): Promise<BoardDto[]> {
    return this.boards.listBoards(tenantOf(req))
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: '게시판·카페 생성(slug·name·kind)' })
  create(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createBoardSchema)) body: CreateBoardInput
  ): Promise<BoardDto> {
    return this.boards.createBoard(tenantOf(req), body)
  }

  @Put(':id')
  @ApiParam({ name: 'id', description: '게시판 id(uuid)' })
  @ApiOperation({ summary: '게시판 수정(name·description·kind)' })
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBoardSchema)) body: UpdateBoardInput
  ): Promise<BoardDto> {
    return this.boards.updateBoard(tenantOf(req), id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: '게시판 id(uuid)' })
  @ApiOperation({ summary: '게시판 삭제(글도 함께 정리)' })
  async remove(@Req() req: TenantRequest, @Param('id') id: string): Promise<void> {
    await this.boards.deleteBoard(tenantOf(req), id)
  }
}
