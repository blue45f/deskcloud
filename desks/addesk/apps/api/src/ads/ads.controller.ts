import {
  createCampaignSchema,
  createCreativeSchema,
  createSlotSchema,
  serveQuerySchema,
  trackEventSchema,
  updateCampaignSchema,
  updateCreativeSchema,
  updateSlotSchema,
  uploadImageSchema,
  type CampaignDto,
  type CreateCampaignInput,
  type CreateCreativeInput,
  type CreateSlotInput,
  type CreativeDto,
  type ServeDto,
  type ServeQuery,
  type SlotDto,
  type StatsDto,
  type TrackEventInput,
  type TrackReceiptDto,
  type UpdateCampaignInput,
  type UpdateCreativeInput,
  type UpdateSlotInput,
  type UploadImageInput,
  type UploadResultDto,
} from '@addesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { AdsService } from './ads.service'

import type { Response } from 'express'

/**
 * 광고 API.
 *  - 공개(위젯, publishable 키): 서빙 + 노출/클릭 추적.
 *  - 어드민(secret 키): 캠페인/크리에이티브/슬롯 CRUD + 통계.
 */
@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  /* ── 공개(위젯) ────────────────────────────────────────────────────────── */

  @Get('serve')
  @UseGuards(PublishableKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '슬롯에 노출할 활성 크리에이티브 1개를 가중 랜덤 선택' })
  serve(
    @Req() req: TenantRequest,
    @Query(new ZodValidationPipe(serveQuerySchema)) query: ServeQuery
  ): Promise<ServeDto> {
    const t = tenantOf(req)
    return this.ads.serve({ id: t.id, plan: t.plan, usageCount: t.usageCount }, query.slot)
  }

  @Post('impression')
  @HttpCode(200)
  @UseGuards(PublishableKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '노출 추적 — 크리에이티브 impressions +1' })
  impression(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(trackEventSchema)) body: TrackEventInput
  ): Promise<TrackReceiptDto> {
    return this.ads.trackImpression(tenantOf(req).id, body.creativeId, userAgentOf(req))
  }

  @Post('click')
  @HttpCode(200)
  @UseGuards(PublishableKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '클릭 추적 — 크리에이티브 clicks +1' })
  click(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(trackEventSchema)) body: TrackEventInput
  ): Promise<TrackReceiptDto> {
    return this.ads.trackClick(tenantOf(req).id, body.creativeId, userAgentOf(req))
  }

  /* ── 어드민: 통계 ──────────────────────────────────────────────────────── */

  @Get('stats')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '통계 — 캠페인별 노출/클릭/CTR + 합계' })
  stats(@Req() req: TenantRequest): Promise<StatsDto> {
    return this.ads.stats(tenantOf(req).id)
  }

  /* ── 어드민: 캠페인 CRUD ───────────────────────────────────────────────── */

  @Get('campaigns')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '캠페인 목록' })
  listCampaigns(@Req() req: TenantRequest): Promise<CampaignDto[]> {
    return this.ads.listCampaigns(tenantOf(req).id)
  }

  @Post('campaigns')
  @HttpCode(201)
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '캠페인 생성' })
  createCampaign(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createCampaignSchema)) body: CreateCampaignInput
  ): Promise<CampaignDto> {
    return this.ads.createCampaign(tenantOf(req).id, body)
  }

  @Get('campaigns/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '캠페인 단건 조회' })
  getCampaign(@Req() req: TenantRequest, @Param('id') id: string): Promise<CampaignDto> {
    return this.ads.getCampaign(tenantOf(req).id, id)
  }

  @Put('campaigns/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '캠페인 수정' })
  updateCampaign(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) body: UpdateCampaignInput
  ): Promise<CampaignDto> {
    return this.ads.updateCampaign(tenantOf(req).id, id, body)
  }

  @Delete('campaigns/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '캠페인 삭제(소속 크리에이티브 포함)' })
  deleteCampaign(
    @Req() req: TenantRequest,
    @Param('id') id: string
  ): Promise<{ deleted: boolean; id: string }> {
    return this.ads.deleteCampaign(tenantOf(req).id, id)
  }

  /* ── 어드민: 크리에이티브 CRUD ─────────────────────────────────────────── */

  @Get('creatives')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '크리에이티브 목록(campaignId/slot 필터 옵션)' })
  listCreatives(
    @Req() req: TenantRequest,
    @Query('campaignId') campaignId?: string,
    @Query('slot') slotKey?: string
  ): Promise<CreativeDto[]> {
    return this.ads.listCreatives(tenantOf(req).id, { campaignId, slotKey })
  }

  @Post('creatives')
  @HttpCode(201)
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '크리에이티브 생성' })
  createCreative(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createCreativeSchema)) body: CreateCreativeInput
  ): Promise<CreativeDto> {
    return this.ads.createCreative(tenantOf(req).id, body)
  }

  @Get('creatives/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '크리에이티브 단건 조회' })
  getCreative(@Req() req: TenantRequest, @Param('id') id: string): Promise<CreativeDto> {
    return this.ads.getCreative(tenantOf(req).id, id)
  }

  @Put('creatives/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '크리에이티브 수정' })
  updateCreative(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCreativeSchema)) body: UpdateCreativeInput
  ): Promise<CreativeDto> {
    return this.ads.updateCreative(tenantOf(req).id, id, body)
  }

  @Delete('creatives/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '크리에이티브 삭제' })
  deleteCreative(
    @Req() req: TenantRequest,
    @Param('id') id: string
  ): Promise<{ deleted: boolean; id: string }> {
    return this.ads.deleteCreative(tenantOf(req).id, id)
  }

  /* ── 어드민: 이미지 업로드 + 공개 서빙 ─────────────────────────────────── */

  @Post('uploads')
  @HttpCode(201)
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({
    summary: '이미지 업로드 — AdDesk 가 호스팅하고 절대 URL 반환(크리에이티브 imageUrl 용)',
  })
  async upload(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(uploadImageSchema)) body: UploadImageInput
  ): Promise<UploadResultDto> {
    const { id, contentType, bytes } = await this.ads.createUpload(tenantOf(req).id, body)
    return { id, url: `${publicBaseUrl(req)}/api/ads/uploads/${id}`, contentType, bytes }
  }

  @Get('uploads/:id')
  @ApiOperation({ summary: '업로드 이미지 서빙(공개) — 위젯/브라우저가 직접 <img> 로드' })
  async serveUpload(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const upload = await this.ads.getUpload(id)
    if (!upload) {
      res.status(404).send('Not found')
      return
    }
    res
      .setHeader('Content-Type', upload.contentType)
      .setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      .setHeader('X-Content-Type-Options', 'nosniff')
      // 업로드 SVG 등의 스크립트 실행을 직접-탐색 시에도 무력화(이미지 전용 격리).
      .setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      )
      .send(Buffer.from(upload.data, 'base64'))
  }

  /* ── 어드민: 슬롯 CRUD ─────────────────────────────────────────────────── */

  @Get('slots')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '슬롯 목록' })
  listSlots(@Req() req: TenantRequest): Promise<SlotDto[]> {
    return this.ads.listSlots(tenantOf(req).id)
  }

  @Post('slots')
  @HttpCode(201)
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '슬롯 생성' })
  createSlot(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(createSlotSchema)) body: CreateSlotInput
  ): Promise<SlotDto> {
    return this.ads.createSlot(tenantOf(req).id, body)
  }

  @Put('slots/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '슬롯 수정' })
  updateSlot(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSlotSchema)) body: UpdateSlotInput
  ): Promise<SlotDto> {
    return this.ads.updateSlot(tenantOf(req).id, id, body)
  }

  @Delete('slots/:id')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '슬롯 삭제' })
  deleteSlot(
    @Req() req: TenantRequest,
    @Param('id') id: string
  ): Promise<{ deleted: boolean; id: string }> {
    return this.ads.deleteSlot(tenantOf(req).id, id)
  }
}

/** 요청의 User-Agent 헤더(추적 IVT 필터용). 없으면 undefined. */
function userAgentOf(req: TenantRequest): string | undefined {
  const ua = req.headers['user-agent']
  return Array.isArray(ua) ? ua[0] : ua
}

/**
 * 업로드 이미지의 절대 URL 베이스를 만든다. 명시 env(PUBLIC_API_URL)가 있으면 그것을,
 * 없으면 요청 헤더(프록시 forwarded proto/host)로 유추한다 — 서버리스/커스텀 도메인 무관.
 */
function publicBaseUrl(req: TenantRequest): string {
  const fromEnv = process.env.PUBLIC_API_URL?.replace(/\/+$/, '')
  if (fromEnv) return fromEnv
  const proto =
    String(req.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      ?.trim() ||
    req.protocol ||
    'https'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? ''
  return `${proto}://${host}`
}
