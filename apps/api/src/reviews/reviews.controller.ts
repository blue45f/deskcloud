import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  submitReviewSchema,
  subjectIdSchema,
  type PublicReviewsDto,
  type ReviewAggregate,
  type ReviewReceiptDto,
  type ReviewWallDto,
  type SubmitReviewInput,
} from '@reviewdesk/shared'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ReviewsService } from './reviews.service'

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/**
 * 공개(publishable) — 위젯이 리뷰를 제출하고 승인본·집계를 읽는다.
 * 인증: x-pk(또는 ?pk=) + Origin 허용목록(PublishableKeyGuard).
 */
@ApiTags('reviews (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('reviews')
@UseGuards(PublishableKeyGuard)
export class ReviewsPublicController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '리뷰 제출 — 검증·throttled, usage 증가. 영수증(id·status) 반환' })
  submit(
    @Req() req: TenantRequest,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('referer') referrer: string | undefined,
    @Body(new ZodValidationPipe(submitReviewSchema)) body: SubmitReviewInput
  ): Promise<ReviewReceiptDto> {
    // 위젯이 meta 를 안 보내면 헤더로 보완.
    const meta = {
      pageUrl: body.meta?.pageUrl,
      userAgent: body.meta?.userAgent ?? userAgent,
      referrer: body.meta?.referrer ?? referrer,
    }
    return this.reviews.submitReview(tenantOf(req), { ...body, meta })
  }

  @Get()
  @ApiQuery({ name: 'subjectId', example: 'pro-plan' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOperation({ summary: 'subject 의 승인본 리뷰 + 집계(표시 위젯)' })
  list(
    @Req() req: TenantRequest,
    @Query('subjectId', new ZodValidationPipe(subjectIdSchema)) subjectId: string,
    @Query('limit') limit?: string
  ): Promise<PublicReviewsDto> {
    return this.reviews.getPublicReviews(tenantOf(req), subjectId, parseLimit(limit))
  }

  @Get('wall')
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOperation({ summary: '후기 월 — 승인+추천(featured) 리뷰' })
  wall(@Req() req: TenantRequest, @Query('limit') limit?: string): Promise<ReviewWallDto> {
    return this.reviews.getWall(tenantOf(req), parseLimit(limit))
  }

  @Get('aggregate')
  @ApiQuery({ name: 'subjectId', example: 'pro-plan' })
  @ApiOperation({ summary: 'subject 별점 요약(배지용) — 승인본 기준' })
  aggregate(
    @Req() req: TenantRequest,
    @Query('subjectId', new ZodValidationPipe(subjectIdSchema)) subjectId: string
  ): Promise<ReviewAggregate> {
    return this.reviews.getAggregate(tenantOf(req), subjectId)
  }
}
