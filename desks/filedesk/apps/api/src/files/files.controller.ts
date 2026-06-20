import {
  isSecretKey,
  listFilesQuerySchema,
  signUrlSchema,
  uploadJsonSchema,
  type DeleteResultDto,
  type FileListDto,
  type FileStatsDto,
  type ListFilesQuery,
  type SignUrlInput,
  type SignedUrlDto,
  type UploadResultDto,
  type Visibility,
} from '@filedesk/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'

import { verifyFileToken } from '../common/secret'
import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'
import { SecretKeyGuard } from '../tenants/secret-key.guard'
import { extractKey, getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'
import { TenantsService } from '../tenants/tenants.service'

import { FilesService, type UploadCommand } from './files.service'

import type { Request, Response } from 'express'

/** multer 파일(타입 의존 없이 최소 형태만). */
interface UploadFile {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

/** 서빙 URL 의 베이스(절대 URL) — 위젯/SDK 가 받은 url 을 그대로 쓰도록. */
function resolveBaseUrl(cfg: AppConfig, req: Request): string {
  if (cfg.webOrigin && cfg.s3.publicBaseUrl) return cfg.s3.publicBaseUrl.replace(/\/+$/, '')
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol
  const host = req.headers.host
  return host ? `${proto}://${host}` : ''
}

/** data:URL 또는 순수 base64 에서 바이트를 디코드. */
function decodeBase64(dataBase64: string): Buffer {
  const comma = dataBase64.indexOf(',')
  const payload =
    dataBase64.startsWith('data:') && comma >= 0 ? dataBase64.slice(comma + 1) : dataBase64
  return Buffer.from(payload, 'base64')
}

/**
 * 파일 API — 공개 업로드(pk_) · 공개 서빙(가시성 기반) · 어드민 관리(sk_/어드민 토큰).
 *
 * 라우트 순서 주의: `GET /files/stats` 는 `GET /files/:key`(서빙)보다 먼저 선언해야
 * 'stats' 가 key 로 캡처되지 않는다. 서빙(:key)은 항상 마지막에 둔다.
 */
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 업로드(공개, publishable 키 + Origin) ──────────────────────────────────────

  @Post()
  @UseGuards(PublishableKeyGuard)
  @ApiHeader({ name: 'Authorization', required: true, description: 'Bearer pk_… (publishable 키)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '파일 업로드 — multipart(file 필드) 또는 base64 JSON. { id, key, url } 반환',
  })
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: UploadFile | undefined,
    @Body() rawBody: unknown
  ): Promise<UploadResultDto> {
    const { tenant } = getTenantCtx(req)
    const baseUrl = resolveBaseUrl(this.cfg, req)
    const cmd = this.buildUploadCommand(file, rawBody)
    return this.files.upload(tenant, baseUrl, cmd)
  }

  // ── 어드민(secret 키 / 어드민 토큰) ──────────────────────────────────────────────

  @Get()
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '파일 목록(메타데이터) — 페이지네이션·가시성 필터 (sk_/어드민)' })
  list(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(listFilesQuerySchema)) query: ListFilesQuery
  ): Promise<FileListDto> {
    const { tenant } = getTenantCtx(req)
    return this.files.list(tenant.id, query)
  }

  @Get('stats')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '파일 통계 — 개수·총 바이트(가시성 분해) (sk_/어드민)' })
  stats(@Req() req: AuthedRequest): Promise<FileStatsDto> {
    const { tenant } = getTenantCtx(req)
    return this.files.stats(tenant.id)
  }

  @Post(':id/signed-url')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: 'private 파일 한시 접근용 서명 토큰 발급 (sk_/어드민)' })
  async signUrl(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(signUrlSchema)) body: SignUrlInput
  ): Promise<SignedUrlDto> {
    const { tenant } = getTenantCtx(req)
    const row = await this.files.getById(id, tenant.id)
    return this.files.signUrl(row, resolveBaseUrl(this.cfg, req), body.expiresInSec)
  }

  @Delete(':id')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '파일 삭제 — 레지스트리 + 스토리지 바이트 (sk_/어드민)' })
  async remove(@Req() req: AuthedRequest, @Param('id') id: string): Promise<DeleteResultDto> {
    const { tenant } = getTenantCtx(req)
    await this.files.delete(id, tenant.id)
    return { deleted: true, id }
  }

  // ── 서빙(공개, 가시성 기반) — 반드시 마지막 ─────────────────────────────────────

  @Get(':key')
  @SkipThrottle()
  @ApiOperation({
    summary: '파일 서빙 — public 은 직접, private 은 sk_ 또는 ?token=(서명) 필요',
  })
  async serve(
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') token?: string
  ): Promise<void> {
    const row = await this.files.getByKey(key)
    if (row.visibility === 'private') {
      await this.authorizePrivate(row.id, req, token)
    }

    const served = await this.files.loadBytes(row)
    res.setHeader('Content-Type', served.contentType)
    res.setHeader('Content-Length', String(served.bytes.byteLength))
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(served.filename)}"`
    )
    // private 은 캐시 금지, public 은 콘텐츠 주소(불변 key)라 장기 캐시 가능.
    res.setHeader(
      'Cache-Control',
      row.visibility === 'private'
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable'
    )
    if (row.visibility === 'public') {
      res.setHeader('ETag', `"${key}"`)
      if (req.headers['if-none-match'] === `"${key}"`) {
        res.status(304).end()
        return
      }
    }
    res.status(200).end(served.bytes)
  }

  /** private 파일 접근 인가 — 서명 토큰(?token) 또는 secret 키(sk_) 중 하나. */
  private async authorizePrivate(
    fileId: string,
    req: Request,
    token: string | undefined
  ): Promise<void> {
    if (token && verifyFileToken(fileId, token, this.cfg.keyPepper)) return

    const key = extractKey(req)
    const adminToken = this.headerValue(req, 'x-admin-token')
    if (adminToken && adminToken === this.cfg.adminToken) return
    if (key && isSecretKey(key) && (await this.tenants.findBySecretKey(key))) return

    throw new UnauthorizedException(
      'private 파일입니다. 유효한 서명 토큰(?token=) 또는 secret 키(Authorization: Bearer sk_…)가 필요합니다'
    )
  }

  private headerValue(req: Request, name: string): string | undefined {
    const h = req.headers[name]
    const v = Array.isArray(h) ? h[0] : h
    return v?.trim() || undefined
  }

  /** multipart 파일 또는 base64 JSON 바디를 업로드 커맨드로 정규화. */
  private buildUploadCommand(file: UploadFile | undefined, rawBody: unknown): UploadCommand {
    if (file) {
      const visibility = this.readVisibility(rawBody)
      return {
        filename: file.originalname || 'file',
        contentType: file.mimetype || 'application/octet-stream',
        bytes: file.buffer,
        visibility,
      }
    }

    // base64 JSON 경로
    const parsed = uploadJsonSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new BadRequestException(
        '업로드할 파일이 없습니다. multipart(file 필드) 또는 JSON { filename, contentType, dataBase64 } 를 보내세요'
      )
    }
    const bytes = decodeBase64(parsed.data.dataBase64)
    return {
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      bytes,
      visibility: parsed.data.visibility ?? 'public',
    }
  }

  /** multipart 폼 필드에서 visibility 를 읽는다(기본 public). */
  private readVisibility(rawBody: unknown): Visibility {
    const v = (rawBody as { visibility?: unknown } | undefined)?.visibility
    return v === 'private' ? 'private' : 'public'
  }
}
