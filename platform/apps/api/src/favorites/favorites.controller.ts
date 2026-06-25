import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { FavoritesService } from './favorites.service'
import { putFavoritesSchema, type FavoritesListDto, type PutFavoritesInput } from './tokens'

/**
 * 즐겨찾기 API — 형제 앱이 공개 REST 로 직접 호출(SDK 불필요, 키 인증 없음, CORS 개방).
 *  - `GET /api/v1/apps/:appId/favorites?ownerKey=…` — owner 목록 조회
 *  - `PUT /api/v1/apps/:appId/favorites?ownerKey=…` — owner 목록 전체 교체(토글 후 전송)
 * ownerKey = 익명 멤버키(getMemberId) 또는 인증 사용자 id.
 */
@ApiTags('favorites')
@Controller('v1/apps/:appId/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'owner 즐겨찾기 목록(공개) — ?ownerKey=' })
  list(
    @Param('appId') appId: string,
    @Query('ownerKey') ownerKey?: string
  ): Promise<FavoritesListDto> {
    return this.favorites.list(appId, ownerKey)
  }

  @Put()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'owner 즐겨찾기 전체 교체(공개) — ?ownerKey=' })
  replace(
    @Param('appId') appId: string,
    @Body(new ZodValidationPipe(putFavoritesSchema)) body: PutFavoritesInput,
    @Query('ownerKey') ownerKey?: string
  ): Promise<FavoritesListDto> {
    return this.favorites.replace(appId, ownerKey, body.items)
  }
}
