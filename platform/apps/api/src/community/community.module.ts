import { Module } from '@nestjs/common'

import { DatabaseService } from '../db/database.service'
import { DrizzleCommunityStore } from '../stores/drizzle-community.store'

import { CommunityController } from './community.controller'
import { CommunityService } from './community.service'
import { COMMUNITY_STORE } from './tokens'

/** 커뮤니티 도메인 — 공개 채팅·게시판·댓글(키 인증 없음). */
@Module({
  controllers: [CommunityController],
  providers: [
    CommunityService,
    {
      provide: COMMUNITY_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleCommunityStore(dbs),
      inject: [DatabaseService],
    },
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
