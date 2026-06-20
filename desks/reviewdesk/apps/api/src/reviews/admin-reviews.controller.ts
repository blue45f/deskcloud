import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  adminReviewQuerySchema,
  moderateReviewSchema,
  type AdminReviewListDto,
  type AdminReviewQuery,
  type ModerateReviewInput,
} from '@reviewdesk/shared'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ReviewsService } from './reviews.service'

import type { Response } from 'express'

/**
 * 어드민 — 리뷰 검수·CRUD. 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정(SecretKeyGuard).
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '글로벌 ADMIN_TOKEN(셀프호스트)' })
@Controller('admin/reviews')
@UseGuards(SecretKeyGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: '리뷰 목록 — status/subjectId/featured 필터, 페이지네이션(offset/limit)' })
  async list(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Query(new ZodValidationPipe(adminReviewQuerySchema)) query: AdminReviewQuery
  ): Promise<AdminReviewListDto> {
    const result = await this.reviews.listReviews(tenantOf(req), query)
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: '리뷰 id(uuid)' })
  @ApiOperation({ summary: '검수 — approve|reject|feature|unfeature|reply' })
  async moderate(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema)) body: ModerateReviewInput
  ): Promise<{ ok: true }> {
    await this.reviews.moderate(tenantOf(req), id, body)
    return { ok: true }
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: '리뷰 id(uuid)' })
  @ApiOperation({ summary: '리뷰 삭제' })
  async remove(@Req() req: TenantRequest, @Param('id') id: string): Promise<void> {
    await this.reviews.deleteReview(tenantOf(req), id)
  }
}
