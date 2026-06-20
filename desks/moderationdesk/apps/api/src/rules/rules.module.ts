import { Module } from '@nestjs/common'

import { AdminRulesController } from './rules.controller'
import { RulesService } from './rules.service'

/** 금칙 규칙 도메인 — 어드민 CRUD. */
@Module({
  controllers: [AdminRulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
