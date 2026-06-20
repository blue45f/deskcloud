import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  searchQuerySchema,
  type SearchQueryInput,
  type SearchResponseDto,
} from '@searchdesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'
import { TenantsService } from '../tenants/tenants.service'

import { SearchService } from './search.service'

/** 공개(publishable 키 pk_ + Origin) — 브라우저에서 전문 검색(랭킹·하이라이트·패싯). */
@ApiTags('search (publishable)')
@ApiHeader({ name: 'Authorization', required: true, description: 'Bearer pk_… (publishable 키)' })
@Controller('search')
@UseGuards(PublishableKeyGuard)
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  @Get()
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @ApiQuery({ name: 'q', required: false, description: '검색어' })
  @ApiQuery({ name: 'index', required: false, description: '대상 인덱스(미지정 시 default)' })
  @ApiQuery({ name: 'category', required: false, description: '카테고리 필터(단일)' })
  @ApiQuery({ name: 'tags', required: false, description: '태그 필터(쉼표 구분, AND)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: '검색 — 랭킹 hits + 하이라이트 + facets(category·tags)' })
  async query(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQueryInput
  ): Promise<SearchResponseDto> {
    const { tenant } = getTenantCtx(req)
    // 사용량(검색) 카운터 — 비차단. 실패해도 검색은 진행.
    void this.tenants.incrementSearchCount(tenant.id).catch(() => undefined)
    return this.search.search(tenant, query, this.cfg)
  }
}
