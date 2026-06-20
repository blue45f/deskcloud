import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { InquiriesAdminController, InquiriesPublicController } from './inquiries.controller'
import { InquiriesService } from './inquiries.service'

/** 중앙 문의 보드 — DatabaseService·AuditService·APP_CONFIG 는 CoreModule(@Global) 제공. */
@Module({
  imports: [AuthModule],
  controllers: [InquiriesPublicController, InquiriesAdminController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
