import { Module } from '@nestjs/common'

import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

/** 문서 도메인 — 색인(upsert/삭제) 컨트롤러 + 서비스. 서비스는 admin 모듈도 쓰므로 export. */
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
