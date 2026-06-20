import { Module } from '@nestjs/common'

import { AiAssistService } from './ai-assist.service'
import { ModerationController } from './moderation.controller'
import { ModerationService } from './moderation.service'

/** 모더레이션 도메인 — 검사 컨트롤러 + 서비스 + AI 보조(선택). */
@Module({
  controllers: [ModerationController],
  providers: [ModerationService, AiAssistService],
  exports: [ModerationService],
})
export class ModerationModule {}
