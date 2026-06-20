import { Module } from '@nestjs/common'

import { PostsModule } from '../posts/posts.module'

import { AdminBoardsController, BoardsPublicController } from './boards.controller'
import { BoardsService } from './boards.service'

/** 게시판 도메인 — 공개(목록·글) + 어드민(CRUD). 글 목록은 PostsService 에 위임. */
@Module({
  imports: [PostsModule],
  controllers: [BoardsPublicController, AdminBoardsController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
