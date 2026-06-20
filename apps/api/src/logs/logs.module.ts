import { Module } from '@nestjs/common'

import { AdminLogsController } from './logs.controller'
import { LogsService } from './logs.service'

/** 모더레이션 로그 도메인 — 어드민 조회. */
@Module({
  controllers: [AdminLogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
