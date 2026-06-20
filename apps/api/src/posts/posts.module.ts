import { forwardRef, Module } from '@nestjs/common'

import { BoardsModule } from '../boards/boards.module'

import { AdminPostsController } from './admin-posts.controller'
import { PostsPublicController, VisitsPublicController } from './posts.controller'
import { PostsService } from './posts.service'

/**
 * 글·댓글 도메인 — 공개(작성·상세·댓글) + 어드민(목록·운영·삭제).
 * BoardsService 에 의존하지만 BoardsModule 도 PostsService(글 목록)에 의존하므로 forwardRef.
 */
@Module({
  imports: [forwardRef(() => BoardsModule)],
  controllers: [PostsPublicController, VisitsPublicController, AdminPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
