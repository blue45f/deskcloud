import { Module } from '@nestjs/common'

import { AdminReviewsController } from './admin-reviews.controller'
import { ReviewsPublicController } from './reviews.controller'
import { ReviewsService } from './reviews.service'

/** 리뷰 도메인 — 공개(위젯) + 어드민 컨트롤러가 동일 서비스를 공유. */
@Module({
  controllers: [ReviewsPublicController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
