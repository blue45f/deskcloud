import { Module } from '@nestjs/common'

import { DatabaseService } from '../db/database.service'
import { DrizzleInquiryStore } from '../stores/drizzle-inquiry.store'

import { InquiriesController } from './inquiries.controller'
import { InquiriesService } from './inquiries.service'
import { INQUIRY_STORE } from './tokens'

/**
 * 문의 도메인 — 공개 제출/게시판(키 인증 없음) + 어드민 트리아지(X-Admin-Token).
 * AdminTokenGuard 가 의존하는 CORE_OPTIONS 는 전역 CoreModule 이 제공한다.
 */
@Module({
  controllers: [InquiriesController],
  providers: [
    InquiriesService,
    {
      provide: INQUIRY_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleInquiryStore(dbs),
      inject: [DatabaseService],
    },
  ],
  exports: [InquiriesService],
})
export class InquiriesModule {}
