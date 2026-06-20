import {
  listAssetsQuerySchema,
  uploadFieldsSchema,
  type AssetDto,
  type AssetListDto,
} from '@mediadesk/shared'
import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { resolveBaseUrl } from '../common/base-url'
import { PublishableAuthGuard } from '../common/publishable-auth.guard'
import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'

import { AssetsService, type UploadFile } from './assets.service'

import type { TenantRequest } from '../common/request'
import type { Request } from 'express'

/**
 * 공개(브라우저) 자산 API — publishable 키(pk_) + Origin 으로 인증한다(PublishableAuthGuard).
 *   POST /api/uploads   (multipart: file, folder?)  → AssetDto
 *   GET  /api/assets?folder=&limit=&offset=          → AssetListDto
 */
@ApiTags('assets (public)')
@ApiHeader({ name: 'X-Publishable-Key', required: true, description: 'pk_… (브라우저 노출 가능)' })
@UseGuards(PublishableAuthGuard)
@Controller()
export class AssetsPublicController {
  constructor(
    private readonly assets: AssetsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  @Post('uploads')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '파일 업로드(multipart). 자산 메타({ url, key, … }) 반환' })
  upload(
    @Req() req: Request & TenantRequest,
    @UploadedFile() file: UploadFile | undefined,
    @Body(new ZodValidationPipe(uploadFieldsSchema)) body: { folder?: string }
  ): Promise<AssetDto> {
    return this.assets.upload(req.tenant, file, body.folder, resolveBaseUrl(this.cfg, req))
  }

  @Get('assets')
  @ApiOperation({ summary: '공개 자산 목록(폴더 필터·페이지네이션)' })
  list(
    @Req() req: Request & TenantRequest,
    @Query(new ZodValidationPipe(listAssetsQuerySchema))
    query: { folder?: string; limit?: number; offset?: number }
  ): Promise<AssetListDto> {
    return this.assets.list(req.tenant, query, resolveBaseUrl(this.cfg, req))
  }
}
