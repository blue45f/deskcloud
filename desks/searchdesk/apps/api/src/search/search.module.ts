import { Module } from '@nestjs/common'

import { SearchController } from './search.controller'
import { SearchService } from './search.service'

/** 검색 도메인 — 공개(publishable) 검색 컨트롤러 + 서비스. */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
