import { Module } from '@nestjs/common'

import { ReactionsPublicController } from './reactions.controller'
import { ReactionsService } from './reactions.service'

/** 반응 도메인 — 공개 토글 컨트롤러 + 서비스. */
@Module({
  controllers: [ReactionsPublicController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
