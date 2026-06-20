import { Module } from '@nestjs/common'

import { DocumentsModule } from '../documents/documents.module'

import { AdminController } from './admin.controller'

/** 어드민 도메인 — 문서 목록·테넌트·키 로테이션·사용량. DocumentsService 를 재사용. */
@Module({
  imports: [DocumentsModule],
  controllers: [AdminController],
})
export class AdminModule {}
