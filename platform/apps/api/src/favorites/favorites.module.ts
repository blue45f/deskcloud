import { Module } from '@nestjs/common'

import { DatabaseService } from '../db/database.service'
import { DrizzleFavoritesStore } from '../stores/drizzle-favorites.store'

import { FavoritesController } from './favorites.controller'
import { FavoritesService } from './favorites.service'
import { FAVORITES_STORE } from './tokens'

/** 즐겨찾기 도메인 — 공개 owner별 북마크 목록(키 인증 없음). */
@Module({
  controllers: [FavoritesController],
  providers: [
    FavoritesService,
    {
      provide: FAVORITES_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleFavoritesStore(dbs),
      inject: [DatabaseService],
    },
  ],
  exports: [FavoritesService],
})
export class FavoritesModule {}
