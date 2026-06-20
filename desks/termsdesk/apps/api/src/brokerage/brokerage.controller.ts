import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  adminUpdateProviderSchema,
  adminUpdateRequestSchema,
  createMessageSchema,
  createProposalSchema,
  createReviewSchema,
  createServiceRequestSchema,
  flagRequestSchema,
  importToPolicySchema,
  requestRevisionSchema,
  updateServiceRequestSchema,
  upsertProviderProfileSchema,
  type AdminUpdateProviderInput,
  type AdminUpdateRequestInput,
  type BrokerageStatsDto,
  type CreateMessageInput,
  type CreateProposalInput,
  type CreateReviewInput,
  type CreateServiceRequestInput,
  type FlagRequestInput,
  type ImportToPolicyDto,
  type ImportToPolicyInput,
  type ProposalDto,
  type RequestAttachmentDto,
  type ProviderReviewDto,
  type ProviderProfileDto,
  type ProviderProfileListDto,
  type RequestDetailDto,
  type RequestMessageDto,
  type RequestRevisionInput,
  type ServiceRequestDto,
  type ServiceRequestListDto,
  type UpdateServiceRequestInput,
  type UpsertProviderProfileInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { BrokerageService } from './brokerage.service'

import type { RequestUploadFile } from './brokerage.service'
import type { AuthUser } from '../common/request-context'
import type { Response } from 'express'

/** 목록 응답에 총계 헤더를 부착(inquiries 전례). */
function setTotal(res: Response, total: number): void {
  res.setHeader('X-Total-Count', String(total))
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
}

function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'attachment'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

// ── 의뢰(의뢰자/전문가 개인 뷰) ──────────────────────────────────────────────────

@ApiTags('brokerage-requests')
@ApiBearerAuth('session')
@Controller('requests')
@UseGuards(SessionGuard)
export class RequestsController {
  constructor(private readonly brokerage: BrokerageService) {}

  @Post()
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '약관 의뢰 등록' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createServiceRequestSchema)) body: CreateServiceRequestInput
  ): Promise<ServiceRequestDto> {
    return this.brokerage.createRequest(user, body)
  }

  @Get()
  @RequirePermission('request.read')
  @ApiOperation({ summary: '내 의뢰 목록(scope: mine|assigned|proposed, status·type 필터)' })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('type') type?: string
  ): Promise<ServiceRequestListDto> {
    const result = await this.brokerage.listRequests(user, { scope, status, type })
    setTotal(res, result.total)
    return result
  }

  @Get(':id')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '의뢰 상세(의뢰·제안·스레드) — 참여자/운영자만' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RequestDetailDto> {
    return this.brokerage.getRequest(user, id)
  }

  @Patch(':id')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '의뢰 메타데이터 수정 — 의뢰자·open 상태만' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateServiceRequestSchema)) body: UpdateServiceRequestInput
  ): Promise<ServiceRequestDto> {
    return this.brokerage.updateRequest(user, id, body)
  }

  // 취소·완료는 의뢰자 측 관리 행위 → request.manage(편집 가능 역할)로 게이팅.
  // (서비스가 추가로 의뢰 조직/운영자 여부를 강제한다. viewer 가 취소·완료하는 권한 누수 방지.)
  @Post(':id/cancel')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '의뢰 취소 — 의뢰자 또는 운영자' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ServiceRequestDto> {
    return this.brokerage.cancelRequest(user, id)
  }

  @Post(':id/complete')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '의뢰 완료(검수 승인) — 의뢰자, delivered → completed' })
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ServiceRequestDto> {
    return this.brokerage.completeRequest(user, id)
  }

  @Post(':id/request-revision')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '검수 반려·재작업 요청 — 의뢰자, delivered → in_progress' })
  requestRevision(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestRevisionSchema)) body: RequestRevisionInput
  ): Promise<ServiceRequestDto> {
    return this.brokerage.requestRevision(user, id, body)
  }

  @Post(':id/flag')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '신고·이의제기 — 참여자, 운영자 분쟁 큐 등록' })
  flag(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(flagRequestSchema)) body: FlagRequestInput
  ): Promise<ServiceRequestDto> {
    return this.brokerage.flagRequest(user, id, body)
  }

  @Post(':id/start')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '진행 시작 — 배정 전문가, matched → in_progress' })
  start(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ServiceRequestDto> {
    return this.brokerage.startRequest(user, id)
  }

  @Post(':id/proposals')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '제안 제출 — 활성 전문가, 타 조직 의뢰·open 상태만' })
  submitProposal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createProposalSchema)) body: CreateProposalInput
  ): Promise<ProposalDto> {
    return this.brokerage.submitProposal(user, id, body)
  }

  @Post(':id/proposals/:pid/withdraw')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '제안 철회 — 제안 작성자, submitted → withdrawn' })
  withdrawProposal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pid') pid: string
  ): Promise<ProposalDto> {
    return this.brokerage.withdrawProposal(user, id, pid)
  }

  @Post(':id/proposals/:pid/accept')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '제안 수락·매칭 — 의뢰자(나머지 제안 자동 미선정)' })
  acceptProposal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pid') pid: string
  ): Promise<ServiceRequestDto> {
    return this.brokerage.acceptProposal(user, id, pid)
  }

  @Post(':id/messages')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '스레드 메시지 — 참여자만(delivery 는 배정 전문가)' })
  postMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createMessageSchema)) body: CreateMessageInput
  ): Promise<RequestMessageDto> {
    return this.brokerage.postMessage(user, id, body)
  }

  @Post(':id/attachments')
  @RequirePermission('request.read')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiOperation({ summary: '스레드 첨부 업로드 — 참여자만, S3/R2 저장 후 메시지에 연결' })
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: RequestUploadFile
  ): Promise<RequestAttachmentDto> {
    return this.brokerage.uploadAttachment(user, id, file)
  }

  @Get(':id/attachments/:attachmentId')
  @RequirePermission('request.read')
  @ApiOperation({ summary: '스레드 첨부 다운로드 — 참여자만, API가 저장소 객체를 프록시' })
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.brokerage.downloadAttachment(user, id, attachmentId)
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Length', String(file.buffer.byteLength))
    res.setHeader('Content-Disposition', attachmentDisposition(file.attachment.fileName))
    res.send(file.buffer)
  }

  @Post(':id/import-to-policy')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '완료 산출물 → 약관 초안 버전으로 가져오기(의뢰자)' })
  importToPolicy(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(importToPolicySchema)) body: ImportToPolicyInput
  ): Promise<ImportToPolicyDto> {
    return this.brokerage.importToPolicy(user, id, body)
  }

  @Post(':id/review')
  @RequirePermission('request.manage')
  @ApiOperation({ summary: '전문가 평가 — 의뢰자, 완료 의뢰 1건당 1회' })
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewInput
  ): Promise<ProviderReviewDto> {
    return this.brokerage.submitReview(user, id, body)
  }
}

// ── 마켓플레이스(공개 모집 의뢰 탐색) ────────────────────────────────────────────

@ApiTags('brokerage-marketplace')
@ApiBearerAuth('session')
@Controller('marketplace')
@UseGuards(SessionGuard)
export class MarketplaceController {
  constructor(private readonly brokerage: BrokerageService) {}

  @Get()
  @ApiOperation({ summary: '공개 모집 의뢰 목록(type·policyType 필터) — 인증 사용자 누구나' })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('type') type?: string,
    @Query('policyType') policyType?: string
  ): Promise<ServiceRequestListDto> {
    const result = await this.brokerage.marketplace(user, { type, policyType })
    setTotal(res, result.total)
    return result
  }
}

// ── 전문가 프로필 ──────────────────────────────────────────────────────────────

@ApiTags('brokerage-providers')
@ApiBearerAuth('session')
@Controller('providers')
@UseGuards(SessionGuard)
export class ProvidersController {
  constructor(private readonly brokerage: BrokerageService) {}

  // @Get('me') 는 반드시 @Get(':id') 보다 먼저 — 라우트 매칭 우선순위.
  @Get('me')
  @ApiOperation({ summary: '내 전문가 프로필(없으면 null)' })
  myProvider(@CurrentUser() user: AuthUser): Promise<ProviderProfileDto | null> {
    return this.brokerage.myProvider(user)
  }

  @Put('me')
  @ApiOperation({ summary: '전문가 프로필 등록·수정(opt-in) — verified 는 보존' })
  upsert(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(upsertProviderProfileSchema)) body: UpsertProviderProfileInput
  ): Promise<ProviderProfileDto> {
    return this.brokerage.upsertProvider(user, body)
  }

  @Get()
  @ApiOperation({ summary: '전문가 목록(active=true, specialty 필터) — verified·완료수 정렬' })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('specialty') specialty?: string
  ): Promise<ProviderProfileListDto> {
    const result = await this.brokerage.listProviders(user, { specialty })
    setTotal(res, result.total)
    return result
  }

  @Get(':id')
  @ApiOperation({ summary: '전문가 단건(active 또는 운영자)' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProviderProfileDto> {
    return this.brokerage.getProvider(user, id)
  }
}

// ── 통계·운영자 모더레이션 ────────────────────────────────────────────────────────

@ApiTags('brokerage')
@ApiBearerAuth('session')
@Controller('brokerage')
@UseGuards(SessionGuard)
export class BrokerageController {
  constructor(private readonly brokerage: BrokerageService) {}

  @Get('stats')
  @ApiOperation({ summary: '중계 현황 요약 — 대시보드 카드' })
  stats(@CurrentUser() user: AuthUser): Promise<BrokerageStatsDto> {
    return this.brokerage.stats(user)
  }

  @Get('admin/requests')
  @ApiOperation({ summary: '운영자: 전체 의뢰 목록(status 필터, adminNote 포함)' })
  async adminRequests(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('flagged') flagged?: string
  ): Promise<ServiceRequestListDto> {
    const result = await this.brokerage.adminListRequests(user, { status, flagged })
    setTotal(res, result.total)
    return result
  }

  @Patch('admin/requests/:id')
  @ApiOperation({ summary: '운영자: 의뢰 모더레이션(강제 취소·운영 메모)' })
  adminUpdateRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateRequestSchema)) body: AdminUpdateRequestInput
  ): Promise<ServiceRequestDto> {
    return this.brokerage.adminUpdateRequest(user, id, body)
  }

  @Get('admin/providers')
  @ApiOperation({ summary: '운영자: 전체 전문가 목록(비활성 포함, contact 포함)' })
  async adminProviders(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response
  ): Promise<ProviderProfileListDto> {
    const result = await this.brokerage.adminListProviders(user)
    setTotal(res, result.total)
    return result
  }

  @Patch('admin/providers/:id')
  @ApiOperation({ summary: '운영자: 전문가 모더레이션(검증 배지·활성 토글)' })
  adminUpdateProvider(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateProviderSchema)) body: AdminUpdateProviderInput
  ): Promise<ProviderProfileDto> {
    return this.brokerage.adminUpdateProvider(user, id, body)
  }
}
