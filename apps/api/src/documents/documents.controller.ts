import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  upsertDocumentsSchema,
  type DeleteResultDto,
  type IndexResultDto,
  type UpsertDocumentsInput,
} from '@searchdesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { SecretKeyGuard } from '../tenants/secret-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'

import { DocumentsService } from './documents.service'

/** 색인(secret 키 sk_ 또는 X-Admin-Token) — 문서 upsert/삭제. 브라우저에서 호출 금지. */
@ApiTags('docs (secret)')
@ApiHeader({ name: 'Authorization', required: false, description: 'Bearer sk_… (secret 키)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '플랫폼 어드민 토큰(+ ?tenantId)' })
@Controller('docs')
@UseGuards(SecretKeyGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: '문서 색인(upsert) — document(단건) 또는 documents[](배치). free 플랜 문서 캡 적용',
  })
  upsert(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(upsertDocumentsSchema)) body: UpsertDocumentsInput
  ): Promise<IndexResultDto> {
    const { tenant } = getTenantCtx(req)
    return this.documents.upsert(tenant, body, this.cfg)
  }

  @Delete(':id')
  @ApiParam({ name: 'id', example: 'd1' })
  @ApiQuery({ name: 'index', required: false, description: '미지정 시 default 인덱스' })
  @ApiOperation({ summary: '문서 삭제(docId 기준). index 미지정 시 default' })
  remove(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('index') index?: string
  ): Promise<DeleteResultDto> {
    const { tenant } = getTenantCtx(req)
    return this.documents.remove(tenant, id, index)
  }
}
