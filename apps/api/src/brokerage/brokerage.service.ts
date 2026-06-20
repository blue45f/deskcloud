import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  POLICY_TYPES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPES,
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
  type CreateReviewInput,
  type EscrowStatus,
  type FlagRequestInput,
  type ImportToPolicyInput,
  type ImportToPolicyDto,
  type ProviderReviewDto,
  type CreateMessageInput,
  type CreateProposalInput,
  type CreateServiceRequestInput,
  type MessageKind,
  type ParticipantRole,
  type PolicyType,
  type ProposalDto,
  type ProposalProviderDto,
  type ProposalStatus,
  type RequestAttachmentDto,
  type ProviderProfileDto,
  type ProviderProfileListDto,
  type RequestDetailDto,
  type RequestMessageDto,
  type RequestRevisionInput,
  type RequestVisibility,
  type ServiceRequestDto,
  type ServiceRequestListDto,
  type ServiceRequestStatus,
  type ServiceRequestType,
  type UpdateServiceRequestInput,
  type UpsertProviderProfileInput,
  type ViewerRelation,
} from '@termsdesk/shared'
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import {
  organizations,
  policies,
  requestAttachments,
  providerProfiles,
  providerReviews,
  requestMessages,
  requestProposals,
  serviceRequests,
  users,
} from '../db/schema'
import { NotificationsService } from '../notifications/notifications.service'
import { PoliciesService } from '../policies/policies.service'
import { VersionsService } from '../policies/versions.service'

import { AttachmentStorageService } from './attachment-storage.service'

import type { AuthUser } from '../common/request-context'

type RequestRow = typeof serviceRequests.$inferSelect
type ProposalRow = typeof requestProposals.$inferSelect
type MessageRow = typeof requestMessages.$inferSelect
type AttachmentRow = typeof requestAttachments.$inferSelect
type ProviderRow = typeof providerProfiles.$inferSelect
type ReviewRow = typeof providerReviews.$inferSelect

interface RequestCounts {
  proposalCount: number
  messageCount: number
}

interface RatingAgg {
  avgRating: number | null
  reviewCount: number
}

export interface RequestUploadFile {
  originalname: string
  mimetype?: string
  size: number
  buffer: Buffer
}

export interface DownloadedRequestAttachment {
  attachment: RequestAttachmentDto
  buffer: Buffer
  contentType: string
}

const EMPTY_RATING: RatingAgg = { avgRating: null, reviewCount: 0 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 정규화용 셋 — 동결 계약의 열거형을 그대로 사용.
const STATUS_SET = new Set<string>(SERVICE_REQUEST_STATUSES)
const TYPE_SET = new Set<string>(SERVICE_REQUEST_TYPES)
const POLICY_TYPE_SET = new Set<string>(POLICY_TYPES)
const MAX_ATTACHMENTS_PER_MESSAGE = 5
const DEFAULT_ATTACHMENT_CONTENT_TYPE = 'application/octet-stream'

function badRequestFromIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return new BadRequestException(
    issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  )
}

/** YYYY-MM-DD 마감일 → UTC 자정 Date. */
const toDeadlineDate = (value: string): Date => new Date(`${value}T00:00:00Z`)

/** specialties CSV ↔ string[] 변환. */
const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

const sanitizeFileName = (value: string): string => {
  const cleaned = value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  return cleaned || 'attachment'
}

const normalizeContentType = (value: string | undefined): string => {
  const trimmed = value?.trim().toLowerCase()
  return trimmed && trimmed.length <= 120 ? trimmed : DEFAULT_ATTACHMENT_CONTENT_TYPE
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${Math.floor(bytes / (1024 * 1024))}MB`
  if (bytes >= 1024) return `${Math.floor(bytes / 1024)}KB`
  return `${bytes}B`
}

@Injectable()
export class BrokerageService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService,
    private readonly policiesService: PoliciesService,
    private readonly versionsService: VersionsService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly attachmentStorage?: AttachmentStorageService
  ) {}

  // ── 의뢰 작성·조회 ────────────────────────────────────────────────────────────

  async createRequest(
    user: AuthUser,
    input: CreateServiceRequestInput
  ): Promise<ServiceRequestDto> {
    const parsed = createServiceRequestSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const [row] = await this.dbs.db
      .insert(serviceRequests)
      .values({
        requesterOrgId: user.orgId,
        requesterUserId: user.userId,
        requesterName: user.name,
        title: data.title,
        description: data.description,
        serviceType: data.serviceType,
        policyType: data.policyType,
        jurisdiction: data.jurisdiction,
        budgetMin: data.budgetMin ?? null,
        budgetMax: data.budgetMax ?? null,
        deadline: data.deadline ? toDeadlineDate(data.deadline) : null,
        visibility: data.visibility,
      })
      .returning()

    const saved = row!
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.created',
      targetType: 'service_request',
      targetId: saved.id,
      metadata: { summary: `의뢰 등록: ${saved.title} (${saved.serviceType})` },
    })

    return this.toRequestDtoWithNames(saved, 'requester', { adminNote: true })
  }

  async listRequests(
    user: AuthUser,
    filters: { scope?: unknown; status?: unknown; type?: unknown } = {}
  ): Promise<ServiceRequestListDto> {
    const scope = this.normalizeScope(filters.scope)
    const status = this.normalizeStatus(filters.status)
    const type = this.normalizeType(filters.type)

    const conds: SQL[] = []
    if (scope === 'mine') {
      conds.push(eq(serviceRequests.requesterOrgId, user.orgId))
    } else if (scope === 'assigned') {
      conds.push(eq(serviceRequests.assignedProviderUserId, user.userId))
    } else {
      // proposed — 내가 제안을 낸 의뢰만(서브쿼리).
      const proposed = await this.dbs.db
        .select({ id: requestProposals.requestId })
        .from(requestProposals)
        .where(eq(requestProposals.providerUserId, user.userId))
      const ids = proposed.map((r) => r.id)
      if (ids.length === 0) return { items: [], total: 0 }
      conds.push(inArray(serviceRequests.id, ids))
    }
    if (status) conds.push(eq(serviceRequests.status, status))
    if (type) conds.push(eq(serviceRequests.serviceType, type))
    const where = conds.length > 0 ? and(...conds) : undefined

    const rows = await this.dbs.db
      .select()
      .from(serviceRequests)
      .where(where)
      .orderBy(desc(serviceRequests.createdAt))

    const admin = await this.isPlatformAdmin(user)
    const ids = rows.map((r) => r.id)
    const [counts, myProposals, orgNames] = await Promise.all([
      this.countsFor(ids),
      this.myProposalMap(user.userId, ids),
      this.orgNameMap(rows.map((r) => r.requesterOrgId)),
    ])

    const items = rows.map((row) =>
      this.toRequestDto(row, this.relationFor(user, row, admin, myProposals.has(row.id)), {
        requesterOrgName: orgNames.get(row.requesterOrgId) ?? '',
        counts: counts.get(row.id),
        myProposalId: myProposals.get(row.id) ?? null,
        adminNote: admin || row.requesterOrgId === user.orgId,
      })
    )
    return { items, total: items.length }
  }

  async getRequest(user: AuthUser, id: string): Promise<RequestDetailDto> {
    const row = await this.findRequestOr404(id)
    const admin = await this.isPlatformAdmin(user)
    const myProposalId = await this.myProposalId(user.userId, id)
    let relation = this.relationFor(user, row, admin, myProposalId !== null)

    // 비참여자: open 의뢰는 'guest' 로 열람 허용(마켓에서 진입해 제안할 수 있어야 한다).
    // 그 외 상태의 비참여 의뢰는 존재 여부를 누설하지 않도록 동일한 404.
    if (relation === 'none') {
      if (row.status === 'open') relation = 'guest'
      else throw new NotFoundException('의뢰를 찾을 수 없습니다')
    }

    const counts = await this.countsFor([id])
    const hasReview = row.status === 'completed' ? await this.hasReviewFor(id) : false
    const requestDto = await this.toRequestDtoWithNames(row, relation, {
      counts: counts.get(id),
      myProposalId,
      // 비참여 전문가(guest)에게는 의뢰자 담당자 이름 비노출(프라이버시).
      hideRequesterName: relation === 'guest',
      adminNote: admin,
      hasReview,
    })

    // 제안 가시성: 의뢰자/운영자는 전체, 전문가는 본인 것만.
    const proposalRows = await this.dbs.db
      .select()
      .from(requestProposals)
      .where(eq(requestProposals.requestId, id))
      .orderBy(desc(requestProposals.createdAt))
    const visibleProposals =
      relation === 'requester' || relation === 'admin'
        ? proposalRows
        : proposalRows.filter((p) => p.providerUserId === user.userId)

    const [providerMap, proposalOrgNames] = await Promise.all([
      this.providerSummaryMap(visibleProposals.map((p) => p.providerUserId)),
      this.orgNameMap(visibleProposals.map((p) => p.providerOrgId).filter((v): v is string => !!v)),
    ])
    const proposals = visibleProposals.map((p) =>
      this.toProposalDto(p, providerMap.get(p.providerUserId) ?? null, {
        providerOrgName: p.providerOrgId ? (proposalOrgNames.get(p.providerOrgId) ?? '') : '',
      })
    )

    const messageRows = await this.dbs.db
      .select()
      .from(requestMessages)
      .where(eq(requestMessages.requestId, id))
      .orderBy(asc(requestMessages.createdAt))
    const attachmentMap = await this.attachmentsForMessages(messageRows.map((m) => m.id))
    const messages = messageRows.map((m) => this.toMessageDto(m, attachmentMap.get(m.id) ?? []))

    return { request: requestDto, proposals, messages }
  }

  async updateRequest(
    user: AuthUser,
    id: string,
    input: UpdateServiceRequestInput
  ): Promise<ServiceRequestDto> {
    const parsed = updateServiceRequestSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const row = await this.findRequestOr404(id)
    // 의뢰자(같은 조직)만, open 상태에서만 메타데이터 수정.
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'open') {
      throw new ConflictException('제안 모집 중인 의뢰만 수정할 수 있습니다')
    }

    const nextMin = data.budgetMin === undefined ? row.budgetMin : (data.budgetMin ?? null)
    const nextMax = data.budgetMax === undefined ? row.budgetMax : (data.budgetMax ?? null)
    if (nextMin != null && nextMax != null && nextMin > nextMax) {
      throw new BadRequestException('budgetMax: 최소 예산은 최대 예산보다 클 수 없습니다')
    }

    const [updated] = await this.dbs.db
      .update(serviceRequests)
      .set({
        title: data.title ?? row.title,
        description: data.description ?? row.description,
        serviceType: data.serviceType ?? row.serviceType,
        policyType: data.policyType ?? row.policyType,
        jurisdiction: data.jurisdiction ?? row.jurisdiction,
        budgetMin: nextMin,
        budgetMax: nextMax,
        deadline:
          data.deadline === undefined
            ? row.deadline
            : data.deadline
              ? toDeadlineDate(data.deadline)
              : null,
        visibility: data.visibility ?? row.visibility,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, row.id))
      .returning()

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.updated',
      targetType: 'service_request',
      targetId: row.id,
      metadata: { summary: `의뢰 수정: ${updated!.title}` },
    })

    const counts = await this.countsFor([id])
    return this.toRequestDtoWithNames(updated!, 'requester', {
      counts: counts.get(id),
      adminNote: true,
    })
  }

  // ── 상태 전이 ──────────────────────────────────────────────────────────────────

  async cancelRequest(user: AuthUser, id: string): Promise<ServiceRequestDto> {
    const row = await this.findRequestOr404(id)
    const admin = await this.isPlatformAdmin(user)
    const isRequester = row.requesterOrgId === user.orgId
    if (!isRequester && !admin) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (this.isTerminal(row.status)) {
      throw new ConflictException('이미 종료된 의뢰입니다')
    }

    // 모의 에스크로 환불(refunded) — 보증 중 취소면 환불 처리(자금 이동 없음).
    const refundEscrow = row.escrowStatus === 'held'
    const updated = await this.transition(row, 'cancelled', {
      closedAt: new Date(),
      ...(refundEscrow ? { escrowStatus: 'refunded' } : {}),
    })
    if (refundEscrow) {
      await this.audit.record({
        orgId: row.requesterOrgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'escrow.refunded',
        targetType: 'service_request',
        targetId: row.id,
        metadata: { summary: `모의 에스크로 환불: ${row.title}` },
      })
    }
    await this.audit.record({
      orgId: row.requesterOrgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.cancelled',
      targetType: 'service_request',
      targetId: row.id,
      metadata: { summary: `의뢰 취소: ${row.title}${admin && !isRequester ? ' (운영자)' : ''}` },
    })
    // 배정된 전문가가 있으면 취소를 통지.
    await this.notifications.notify({
      userId: row.assignedProviderUserId,
      orgId: row.requesterOrgId,
      type: 'request_cancelled',
      title: '의뢰가 취소되었습니다',
      body: `"${row.title}" 의뢰가 취소되었습니다.`,
      requestId: row.id,
      actorUserId: user.userId,
    })
    return this.toRequestDtoWithNames(updated, admin ? 'admin' : 'requester', { adminNote: admin })
  }

  async completeRequest(user: AuthUser, id: string): Promise<ServiceRequestDto> {
    const row = await this.findRequestOr404(id)
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'delivered') {
      throw new ConflictException('검수 대기 상태의 의뢰만 완료할 수 있습니다')
    }

    // 모의 에스크로 정산(released) — 보증 중이었으면 정산 처리(자금 이동 없음).
    const releaseEscrow = row.escrowStatus === 'held'
    const updated = await this.transition(row, 'completed', {
      closedAt: new Date(),
      ...(releaseEscrow ? { escrowStatus: 'released' } : {}),
    })
    if (releaseEscrow) {
      await this.audit.record({
        orgId: user.orgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'escrow.released',
        targetType: 'service_request',
        targetId: row.id,
        metadata: { summary: `모의 에스크로 정산: ${row.title}` },
      })
    }
    // 배정 전문가의 완료 누적 증가(신뢰 신호).
    await this.incrementProviderCompleted(row)
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.completed',
      targetType: 'service_request',
      targetId: row.id,
      metadata: { summary: `의뢰 완료: ${row.title}` },
    })
    await this.notifications.notify({
      userId: row.assignedProviderUserId,
      orgId: row.requesterOrgId,
      type: 'request_completed',
      title: '의뢰가 완료되었습니다',
      body: `"${row.title}" 의뢰가 완료 처리되었습니다. 완료 이력에 반영됩니다.`,
      requestId: row.id,
      actorUserId: user.userId,
    })
    return this.toRequestDtoWithNames(updated, 'requester', { adminNote: false })
  }

  async requestRevision(
    user: AuthUser,
    id: string,
    input: RequestRevisionInput
  ): Promise<ServiceRequestDto> {
    const parsed = requestRevisionSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const row = await this.findRequestOr404(id)
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'delivered') {
      throw new ConflictException('검수 대기 상태의 산출물만 재작업 요청할 수 있습니다')
    }

    await this.dbs.db.insert(requestMessages).values({
      requestId: id,
      authorUserId: user.userId,
      authorName: user.name,
      authorRole: 'requester',
      kind: 'system',
      body: `검수 반려·재작업 요청: ${data.note}`,
    })
    const updated = await this.transition(row, 'in_progress')

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.revision_requested',
      targetType: 'service_request',
      targetId: row.id,
      metadata: { summary: `재작업 요청: ${row.title}` },
    })
    await this.notifications.notify({
      userId: row.assignedProviderUserId,
      orgId: row.requesterOrgId,
      type: 'revision_requested',
      title: '재작업 요청이 도착했습니다',
      body: `"${row.title}" 의뢰의 산출물 검수가 반려되었습니다. 재작업 내용을 확인해 주세요.`,
      requestId: row.id,
      actorUserId: user.userId,
    })

    const counts = await this.countsFor([id])
    return this.toRequestDtoWithNames(updated, 'requester', {
      counts: counts.get(id),
      adminNote: false,
    })
  }

  async flagRequest(
    user: AuthUser,
    id: string,
    input: FlagRequestInput
  ): Promise<ServiceRequestDto> {
    const parsed = flagRequestSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const row = await this.findRequestOr404(id)
    const admin = await this.isPlatformAdmin(user)
    const isRequester = row.requesterOrgId === user.orgId
    const isProvider = row.assignedProviderUserId === user.userId
    if (!isRequester && !isProvider && !admin) {
      throw new NotFoundException('의뢰를 찾을 수 없습니다')
    }
    if (row.status === 'cancelled') {
      throw new ConflictException('취소된 의뢰는 이의제기할 수 없습니다')
    }

    const flaggedMessage = data.messageId
      ? await this.findMessageForFlagOr404(id, data.messageId)
      : null
    const disputeNote = this.composeDisputeNote(row.disputeNote, user, data.note, flaggedMessage)

    const [updated] = await this.dbs.db
      .update(serviceRequests)
      .set({
        flagged: true,
        disputeNote,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, row.id))
      .returning()

    await this.dbs.db.insert(requestMessages).values({
      requestId: id,
      authorUserId: user.userId,
      authorName: user.name,
      authorRole: isRequester ? 'requester' : isProvider ? 'provider' : 'admin',
      kind: 'system',
      body: flaggedMessage
        ? '메시지 이의제기가 접수되어 운영자 검토 대기 상태가 되었습니다.'
        : '의뢰 이의제기가 접수되어 운영자 검토 대기 상태가 되었습니다.',
    })

    await this.audit.record({
      orgId: row.requesterOrgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.flagged',
      targetType: 'service_request',
      targetId: row.id,
      metadata: {
        summary: `${flaggedMessage ? '메시지' : '의뢰'} 이의제기: ${row.title}`,
      },
    })

    await this.notifyPlatformAdmins(row, user)
    const participantRecipients = admin
      ? [row.requesterUserId, row.assignedProviderUserId]
      : isRequester
        ? [row.assignedProviderUserId]
        : [row.requesterUserId]
    for (const recipient of participantRecipients) {
      await this.notifications.notify({
        userId: recipient,
        orgId: row.requesterOrgId,
        type: 'request_flagged',
        title: '이의제기가 접수되었습니다',
        body: `"${row.title}" 의뢰가 운영자 분쟁 큐에 등록되었습니다.`,
        requestId: row.id,
        actorUserId: user.userId,
      })
    }

    const counts = await this.countsFor([id])
    return this.toRequestDtoWithNames(
      updated!,
      admin ? 'admin' : isRequester ? 'requester' : 'provider',
      {
        counts: counts.get(id),
        adminNote: admin,
      }
    )
  }

  /**
   * 완료 산출물 → 약관 버전 가져오기. 최신 delivery 메시지(제출본)를 기존 버전 관리의
   * **초안**으로 옮긴다(게시·content_hash 는 의뢰자가 정식 흐름에서 결정 — 불변식 보존).
   */
  async importToPolicy(
    user: AuthUser,
    id: string,
    input: ImportToPolicyInput
  ): Promise<ImportToPolicyDto> {
    const parsed = importToPolicySchema.safeParse(input ?? {})
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)

    const row = await this.findRequestOr404(id)
    // 의뢰자(같은 조직)만, 검수 대기·완료 의뢰만.
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'delivered' && row.status !== 'completed') {
      throw new ConflictException('검수 대기 또는 완료된 의뢰만 약관 버전으로 가져올 수 있습니다')
    }

    // 최신 산출물(제출본) 메시지.
    const deliveries = await this.dbs.db
      .select()
      .from(requestMessages)
      .where(and(eq(requestMessages.requestId, id), eq(requestMessages.kind, 'delivery')))
      .orderBy(desc(requestMessages.createdAt))
      .limit(1)
    const delivery = deliveries[0]
    if (!delivery) {
      throw new ConflictException('가져올 산출물(제출본)이 없습니다')
    }

    const name = parsed.data.name ?? row.title
    const slug = await this.uniquePolicySlug(user.orgId, name)
    // 기존 정책 생성 흐름 재사용(플랜 한도·감사 로그 포함).
    const policy = await this.policiesService.create(user.orgId, user, {
      slug,
      name,
      type: row.policyType as PolicyType,
      jurisdiction: row.jurisdiction,
      description: '약관 의뢰 중계 산출물에서 가져온 정책',
    })
    const version = await this.versionsService.createDraft(user.orgId, user, policy.slug, {
      title: name,
      body: delivery.body,
      locale: 'ko',
      changeSummary: `약관 의뢰 "${row.title}" 산출물에서 가져옴`,
    })

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.imported_to_policy',
      targetType: 'service_request',
      targetId: row.id,
      metadata: {
        summary: `산출물 → 약관 초안: ${row.title} → ${policy.slug} ${version.versionLabel}`,
      },
    })

    return {
      policyId: policy.id,
      policySlug: policy.slug,
      policyName: policy.name,
      versionId: version.id,
      versionLabel: version.versionLabel,
    }
  }

  /** 전문가 평가(완료 의뢰) — 의뢰자만, 의뢰당 1건. 배정 전문가를 대상으로 별점·후기 기록. */
  async submitReview(
    user: AuthUser,
    requestId: string,
    input: CreateReviewInput
  ): Promise<ProviderReviewDto> {
    const parsed = createReviewSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const row = await this.findRequestOr404(requestId)
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'completed') {
      throw new ConflictException('완료된 의뢰만 평가할 수 있습니다')
    }
    if (!row.assignedProviderUserId) {
      throw new ConflictException('배정된 전문가가 없어 평가할 수 없습니다')
    }
    const existing = await this.dbs.db
      .select({ id: providerReviews.id })
      .from(providerReviews)
      .where(eq(providerReviews.requestId, requestId))
      .limit(1)
    if (existing[0]) throw new ConflictException('이미 이 의뢰에 대한 평가를 등록했습니다')

    const [saved] = await this.dbs.db
      .insert(providerReviews)
      .values({
        providerUserId: row.assignedProviderUserId,
        requestId,
        reviewerOrgId: user.orgId,
        reviewerUserId: user.userId,
        reviewerName: user.name,
        rating: data.rating,
        comment: data.comment ?? null,
      })
      .returning()

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'provider.reviewed',
      targetType: 'service_request',
      targetId: requestId,
      metadata: {
        summary: `전문가 평가: ${row.title} → ${row.assignedProviderName ?? ''} (${data.rating}점)`,
      },
    })
    await this.notifications.notify({
      userId: row.assignedProviderUserId,
      orgId: row.requesterOrgId,
      type: 'review_received',
      title: '새 평가를 받았습니다',
      body: `"${row.title}" 의뢰에 ${data.rating}점 평가가 등록되었습니다.`,
      requestId,
      actorUserId: user.userId,
    })
    return this.toReviewDto(saved!, row.title)
  }

  async startRequest(user: AuthUser, id: string): Promise<ServiceRequestDto> {
    const row = await this.findRequestOr404(id)
    if (row.assignedProviderUserId !== user.userId) {
      throw new NotFoundException('의뢰를 찾을 수 없습니다')
    }
    if (row.status !== 'matched') {
      throw new ConflictException('매칭된 의뢰만 진행 시작할 수 있습니다')
    }

    const updated = await this.transition(row, 'in_progress')
    await this.audit.record({
      orgId: row.requesterOrgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.started',
      targetType: 'service_request',
      targetId: row.id,
      metadata: { summary: `진행 시작: ${row.title} (전문가 ${user.name})` },
    })
    await this.notifications.notify({
      userId: row.requesterUserId,
      orgId: row.requesterOrgId,
      type: 'work_started',
      title: '전문가가 작업을 시작했습니다',
      body: `"${row.title}" 의뢰의 작업이 진행 중입니다.`,
      requestId: row.id,
      actorUserId: user.userId,
    })
    return this.toRequestDtoWithNames(updated, 'provider', { adminNote: false })
  }

  // ── 제안 ───────────────────────────────────────────────────────────────────────

  async submitProposal(
    user: AuthUser,
    requestId: string,
    input: CreateProposalInput
  ): Promise<ProposalDto> {
    const parsed = createProposalSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    // 활성 전문가 프로필 필요.
    const profile = await this.activeProfileOf(user.userId)
    if (!profile) {
      throw new ForbiddenException('제안하려면 활성 전문가 프로필이 필요합니다')
    }

    const row = await this.findRequestOr404(requestId)
    // 자기 조직 의뢰엔 제안 불가, open 상태만.
    if (row.requesterOrgId === user.orgId) {
      throw new ForbiddenException('자기 조직의 의뢰에는 제안할 수 없습니다')
    }
    if (row.status !== 'open') {
      throw new ConflictException('제안 모집 중인 의뢰에만 제안할 수 있습니다')
    }

    // 의뢰당 1제안(unique) — 철회 후 재제안은 같은 행을 갱신.
    const existing = await this.dbs.db
      .select()
      .from(requestProposals)
      .where(
        and(
          eq(requestProposals.requestId, requestId),
          eq(requestProposals.providerUserId, user.userId)
        )
      )
      .limit(1)
    const prev = existing[0]
    if (prev && prev.status === 'submitted') {
      throw new ConflictException('이미 제안을 제출했습니다')
    }

    let saved: ProposalRow
    if (prev) {
      const [updated] = await this.dbs.db
        .update(requestProposals)
        .set({
          message: data.message,
          quotedAmount: data.quotedAmount ?? null,
          estimatedDays: data.estimatedDays ?? null,
          status: 'submitted',
          providerName: user.name,
          providerOrgId: user.orgId,
          updatedAt: new Date(),
        })
        .where(eq(requestProposals.id, prev.id))
        .returning()
      saved = updated!
    } else {
      const [inserted] = await this.dbs.db
        .insert(requestProposals)
        .values({
          requestId,
          providerUserId: user.userId,
          providerOrgId: user.orgId,
          providerName: user.name,
          message: data.message,
          quotedAmount: data.quotedAmount ?? null,
          estimatedDays: data.estimatedDays ?? null,
        })
        .returning()
      saved = inserted!
    }

    await this.audit.record({
      orgId: row.requesterOrgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'proposal.submitted',
      targetType: 'service_request',
      targetId: requestId,
      metadata: { summary: `제안 제출: ${row.title} (전문가 ${user.name})` },
    })
    await this.notifications.notify({
      userId: row.requesterUserId,
      orgId: row.requesterOrgId,
      type: 'proposal_received',
      title: '새 제안이 도착했습니다',
      body: `"${row.title}" 의뢰에 ${user.name} 전문가가 제안을 보냈습니다.`,
      requestId,
      actorUserId: user.userId,
    })

    const summary = await this.providerSummaryMap([user.userId])
    return this.toProposalDto(saved, summary.get(user.userId) ?? null, {
      providerOrgName: await this.orgName(user.orgId),
    })
  }

  async withdrawProposal(
    user: AuthUser,
    requestId: string,
    proposalId: string
  ): Promise<ProposalDto> {
    const proposal = await this.findProposalOr404(requestId, proposalId)
    if (proposal.providerUserId !== user.userId) {
      throw new NotFoundException('제안을 찾을 수 없습니다')
    }
    if (proposal.status !== 'submitted') {
      throw new ConflictException('검토 대기 중인 제안만 철회할 수 있습니다')
    }

    const [updated] = await this.dbs.db
      .update(requestProposals)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(eq(requestProposals.id, proposal.id))
      .returning()

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'proposal.withdrawn',
      targetType: 'service_request',
      targetId: requestId,
      metadata: { summary: `제안 철회 (전문가 ${user.name})` },
    })

    const summary = await this.providerSummaryMap([user.userId])
    return this.toProposalDto(updated!, summary.get(user.userId) ?? null, {
      providerOrgName: updated!.providerOrgId ? await this.orgName(updated!.providerOrgId) : '',
    })
  }

  async acceptProposal(
    user: AuthUser,
    requestId: string,
    proposalId: string
  ): Promise<ServiceRequestDto> {
    const row = await this.findRequestOr404(requestId)
    // 의뢰자(같은 조직)만 수락.
    if (row.requesterOrgId !== user.orgId) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    if (row.status !== 'open') {
      throw new ConflictException('제안 모집 중인 의뢰만 수락할 수 있습니다')
    }
    const proposal = await this.findProposalOr404(requestId, proposalId)
    if (proposal.status !== 'submitted') {
      throw new ConflictException('검토 대기 중인 제안만 수락할 수 있습니다')
    }

    // 수락 제안 → accepted, 나머지 submitted → rejected.
    await this.dbs.db
      .update(requestProposals)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(requestProposals.id, proposal.id))
    await this.dbs.db
      .update(requestProposals)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(
        and(eq(requestProposals.requestId, requestId), eq(requestProposals.status, 'submitted'))
      )

    // 모의 에스크로 — 견적이 있으면 보증(held)으로 기록(자금 이동 없음).
    const escrowHeld = proposal.quotedAmount != null
    const [updated] = await this.dbs.db
      .update(serviceRequests)
      .set({
        status: 'matched',
        acceptedProposalId: proposal.id,
        assignedProviderUserId: proposal.providerUserId,
        assignedProviderOrgId: proposal.providerOrgId,
        assignedProviderName: proposal.providerName,
        escrowStatus: escrowHeld ? 'held' : 'none',
        escrowAmount: proposal.quotedAmount,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, row.id))
      .returning()

    if (escrowHeld) {
      await this.audit.record({
        orgId: user.orgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'escrow.held',
        targetType: 'service_request',
        targetId: row.id,
        metadata: {
          summary: `모의 에스크로 보증: ${row.title} (₩${proposal.quotedAmount?.toLocaleString('ko-KR')})`,
        },
      })
    }

    // 시스템 메시지 1건 — 스레드 시작 표시.
    await this.dbs.db.insert(requestMessages).values({
      requestId,
      authorUserId: user.userId,
      authorName: user.name,
      authorRole: 'requester',
      kind: 'system',
      body: `${proposal.providerName} 전문가의 제안이 수락되어 매칭되었습니다.`,
    })

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'proposal.accepted',
      targetType: 'service_request',
      targetId: requestId,
      metadata: { summary: `제안 수락·매칭: ${row.title} → ${proposal.providerName}` },
    })
    await this.notifications.notify({
      userId: proposal.providerUserId,
      orgId: proposal.providerOrgId ?? row.requesterOrgId,
      type: 'proposal_accepted',
      title: '제안이 수락되었습니다',
      body: `"${row.title}" 의뢰에 매칭되었습니다. 작업을 시작해 주세요.`,
      requestId,
      actorUserId: user.userId,
    })

    const counts = await this.countsFor([requestId])
    return this.toRequestDtoWithNames(updated!, 'requester', {
      counts: counts.get(requestId),
      adminNote: true,
    })
  }

  // ── 스레드 ─────────────────────────────────────────────────────────────────────

  async uploadAttachment(
    user: AuthUser,
    requestId: string,
    file: RequestUploadFile | undefined
  ): Promise<RequestAttachmentDto> {
    if (!file) throw new BadRequestException('첨부할 파일이 없습니다')
    if (!file.buffer?.byteLength || file.size <= 0) {
      throw new BadRequestException('빈 파일은 첨부할 수 없습니다')
    }
    if (!this.attachmentStorage?.isConfigured()) {
      throw new ServiceUnavailableException('첨부 파일 저장소가 설정되지 않았습니다')
    }
    const maxBytes = this.attachmentStorage.maxBytes()
    if (file.size > maxBytes) {
      throw new BadRequestException(`첨부 파일은 최대 ${formatBytes(maxBytes)}까지 가능합니다`)
    }

    const row = await this.findRequestOr404(requestId)
    const { admin, authorRole } = await this.assertCanUseThread(user, row)
    if (row.status === 'open' && !admin) {
      throw new ConflictException('매칭 이후부터 파일을 첨부할 수 있습니다')
    }

    const fileName = sanitizeFileName(file.originalname)
    const contentType = normalizeContentType(file.mimetype)
    const key = `brokerage/${requestId}/${randomUUID()}-${fileName}`

    await this.attachmentStorage.put({
      key,
      body: file.buffer,
      contentType,
    })

    const [saved] = await this.dbs.db
      .insert(requestAttachments)
      .values({
        requestId,
        uploaderUserId: user.userId,
        uploaderName: user.name,
        uploaderRole: authorRole,
        fileName,
        contentType,
        sizeBytes: file.size,
        storageKey: key,
      })
      .returning()

    await this.audit.record({
      orgId: row.requesterOrgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.attachment_uploaded',
      targetType: 'service_request',
      targetId: requestId,
      metadata: { summary: `첨부 업로드: ${row.title} (${fileName})` },
    })

    return this.toAttachmentDto(saved!)
  }

  async downloadAttachment(
    user: AuthUser,
    requestId: string,
    attachmentId: string
  ): Promise<DownloadedRequestAttachment> {
    const row = await this.findRequestOr404(requestId)
    await this.assertCanUseThread(user, row)
    if (!this.attachmentStorage?.isConfigured()) {
      throw new ServiceUnavailableException('첨부 파일 저장소가 설정되지 않았습니다')
    }

    const attachment = await this.findAttachmentOr404(requestId, attachmentId)
    const stored = await this.attachmentStorage.get(attachment.storageKey)
    return {
      attachment: this.toAttachmentDto(attachment),
      buffer: stored.buffer,
      contentType: stored.contentType || attachment.contentType,
    }
  }

  async postMessage(
    user: AuthUser,
    requestId: string,
    input: CreateMessageInput
  ): Promise<RequestMessageDto> {
    const parsed = createMessageSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data

    const row = await this.findRequestOr404(requestId)
    const { isRequester, isProvider, authorRole } = await this.assertCanUseThread(user, row)
    const attachments = await this.claimableAttachmentsForMessage(
      user,
      requestId,
      data.attachmentIds
    )

    // delivery 는 배정 전문가만 — 산출물 제출로 간주, 상태를 delivered 로 전이.
    const kind: MessageKind = data.kind
    if (kind === 'delivery') {
      if (!isProvider) {
        throw new ForbiddenException('산출물 제출은 배정된 전문가만 가능합니다')
      }
      if (row.status !== 'in_progress') {
        throw new ConflictException('진행 중인 의뢰에만 산출물을 제출할 수 있습니다')
      }
    }

    const [saved] = await this.dbs.db
      .insert(requestMessages)
      .values({
        requestId,
        authorUserId: user.userId,
        authorName: user.name,
        authorRole,
        kind,
        body: data.body,
      })
      .returning()

    if (attachments.length > 0) {
      await this.dbs.db
        .update(requestAttachments)
        .set({ messageId: saved!.id })
        .where(
          inArray(
            requestAttachments.id,
            attachments.map((a) => a.id)
          )
        )
    }

    if (kind === 'delivery') {
      await this.transition(row, 'delivered')
      await this.audit.record({
        orgId: row.requesterOrgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'request.delivered',
        targetType: 'service_request',
        targetId: requestId,
        metadata: { summary: `산출물 제출: ${row.title} (전문가 ${user.name})` },
      })
      await this.notifications.notify({
        userId: row.requesterUserId,
        orgId: row.requesterOrgId,
        type: 'work_delivered',
        title: '산출물이 제출되었습니다',
        body: `"${row.title}" 의뢰의 산출물이 제출되어 검수를 기다립니다.`,
        requestId,
        actorUserId: user.userId,
      })
    } else {
      // 일반 메시지 → 상대방에게 통지(운영자는 양측 모두).
      const recipients = isRequester
        ? [row.assignedProviderUserId]
        : isProvider
          ? [row.requesterUserId]
          : [row.requesterUserId, row.assignedProviderUserId]
      for (const recipient of recipients) {
        await this.notifications.notify({
          userId: recipient,
          orgId: row.requesterOrgId,
          type: 'message_received',
          title: '새 메시지가 도착했습니다',
          body: `"${row.title}" 의뢰에 ${user.name} 님의 새 메시지가 있습니다.`,
          requestId,
          actorUserId: user.userId,
        })
      }
    }

    return this.toMessageDto(
      saved!,
      attachments.map((a) => this.toAttachmentDto({ ...a, messageId: saved!.id }))
    )
  }

  // ── 마켓플레이스 ──────────────────────────────────────────────────────────────

  async marketplace(
    user: AuthUser,
    filters: { type?: unknown; policyType?: unknown } = {}
  ): Promise<ServiceRequestListDto> {
    const type = this.normalizeType(filters.type)
    const policyType = this.normalizePolicyType(filters.policyType)

    const conds: SQL[] = [
      eq(serviceRequests.visibility, 'public'),
      eq(serviceRequests.status, 'open'),
    ]
    if (type) conds.push(eq(serviceRequests.serviceType, type))
    if (policyType) conds.push(eq(serviceRequests.policyType, policyType))

    const rows = await this.dbs.db
      .select()
      .from(serviceRequests)
      .where(and(...conds))
      .orderBy(desc(serviceRequests.createdAt))

    const ids = rows.map((r) => r.id)
    const [counts, myProposals, orgNames] = await Promise.all([
      this.countsFor(ids),
      this.myProposalMap(user.userId, ids),
      this.orgNameMap(rows.map((r) => r.requesterOrgId)),
    ])

    const items = rows.map((row) => {
      const isOwn = row.requesterOrgId === user.orgId
      const proposed = myProposals.has(row.id)
      // 마켓 뷰: 자기 조직이면 requester, 제안했으면 provider, 그 외 guest.
      const relation: ViewerRelation = isOwn ? 'requester' : proposed ? 'provider' : 'guest'
      return this.toRequestDto(row, relation, {
        requesterOrgName: orgNames.get(row.requesterOrgId) ?? '',
        counts: counts.get(row.id),
        myProposalId: myProposals.get(row.id) ?? null,
        // 마켓 비참여 전문가에게는 의뢰자 담당자 이름 비노출(프라이버시).
        hideRequesterName: !isOwn,
        adminNote: false,
      })
    })
    return { items, total: items.length }
  }

  // ── 전문가 프로필 ──────────────────────────────────────────────────────────────

  async myProvider(user: AuthUser): Promise<ProviderProfileDto | null> {
    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, user.userId))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    const orgName = await this.orgName(row.orgId)
    const rating = await this.ratingFor(row.userId)
    return this.toProviderDto(row, orgName, { contact: true, rating })
  }

  async upsertProvider(
    user: AuthUser,
    input: UpsertProviderProfileInput
  ): Promise<ProviderProfileDto> {
    const parsed = upsertProviderProfileSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data
    const specialtiesCsv = data.specialties.join(',')

    const existing = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, user.userId))
      .limit(1)

    let saved: ProviderRow
    if (existing[0]) {
      // verified 는 여기서 못 바꾼다(운영자 전용) — 기존 값 보존.
      const [updated] = await this.dbs.db
        .update(providerProfiles)
        .set({
          orgId: user.orgId,
          displayName: data.displayName,
          headline: data.headline,
          bio: data.bio,
          specialties: specialtiesCsv,
          jurisdictions: data.jurisdictions,
          hourlyRate: data.hourlyRate ?? null,
          contact: data.contact ?? null,
          active: data.active,
          updatedAt: new Date(),
        })
        .where(eq(providerProfiles.id, existing[0].id))
        .returning()
      saved = updated!
    } else {
      const [inserted] = await this.dbs.db
        .insert(providerProfiles)
        .values({
          userId: user.userId,
          orgId: user.orgId,
          displayName: data.displayName,
          headline: data.headline,
          bio: data.bio,
          specialties: specialtiesCsv,
          jurisdictions: data.jurisdictions,
          hourlyRate: data.hourlyRate ?? null,
          contact: data.contact ?? null,
          active: data.active,
        })
        .returning()
      saved = inserted!
    }

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'provider.upserted',
      targetType: 'provider_profile',
      targetId: saved.id,
      metadata: { summary: `전문가 프로필 ${existing[0] ? '수정' : '등록'}: ${saved.displayName}` },
    })

    const orgName = await this.orgName(saved.orgId)
    const rating = await this.ratingFor(saved.userId)
    return this.toProviderDto(saved, orgName, { contact: true, rating })
  }

  async listProviders(
    _user: AuthUser,
    filters: { specialty?: unknown } = {}
  ): Promise<ProviderProfileListDto> {
    const specialty =
      typeof filters.specialty === 'string' && filters.specialty.trim()
        ? filters.specialty.trim()
        : undefined

    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.active, true))
      .orderBy(desc(providerProfiles.verified), desc(providerProfiles.completedCount))

    const filtered = specialty
      ? rows.filter((r) => splitCsv(r.specialties).includes(specialty))
      : rows

    const [orgNames, ratings] = await Promise.all([
      this.orgNameMap(filtered.map((r) => r.orgId)),
      this.ratingMap(filtered.map((r) => r.userId)),
    ])
    const items = filtered.map((r) =>
      // 목록에서는 연락처 비노출.
      this.toProviderDto(r, orgNames.get(r.orgId) ?? '', {
        contact: false,
        rating: ratings.get(r.userId) ?? EMPTY_RATING,
      })
    )
    return { items, total: items.length }
  }

  async getProvider(user: AuthUser, id: string): Promise<ProviderProfileDto> {
    if (!UUID_RE.test(id)) throw new NotFoundException('전문가를 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, id))
      .limit(1)
    const row = rows[0]
    const admin = await this.isPlatformAdmin(user)
    // active or 운영자만.
    if (!row || (!row.active && !admin)) {
      throw new NotFoundException('전문가를 찾을 수 없습니다')
    }
    const orgName = await this.orgName(row.orgId)
    // 연락처는 본인·운영자에게만.
    const showContact = admin || row.userId === user.userId
    const [rating, reviews] = await Promise.all([
      this.ratingFor(row.userId),
      this.reviewsForProvider(row.userId),
    ])
    return this.toProviderDto(row, orgName, { contact: showContact, rating, reviews })
  }

  // ── 통계 ───────────────────────────────────────────────────────────────────────

  async stats(user: AuthUser): Promise<BrokerageStatsDto> {
    const [byStatus, providers, myReqRows, myProposals, assignedRows] = await Promise.all([
      this.dbs.db
        .select({ status: serviceRequests.status, c: sql<number>`count(*)::int` })
        .from(serviceRequests)
        .groupBy(serviceRequests.status),
      this.dbs.db
        .select({ c: sql<number>`count(*)::int` })
        .from(providerProfiles)
        .where(eq(providerProfiles.active, true)),
      // 내 조직 의뢰(상태 포함) — 건수 + 의뢰자 처리 대기 계산용.
      this.dbs.db
        .select({ id: serviceRequests.id, status: serviceRequests.status })
        .from(serviceRequests)
        .where(eq(serviceRequests.requesterOrgId, user.orgId)),
      this.dbs.db
        .select({ c: sql<number>`count(*)::int` })
        .from(requestProposals)
        .where(eq(requestProposals.providerUserId, user.userId)),
      // 내게 배정된 의뢰(상태) — 전문가 처리 대기 계산용.
      this.dbs.db
        .select({ status: serviceRequests.status })
        .from(serviceRequests)
        .where(eq(serviceRequests.assignedProviderUserId, user.userId)),
    ])

    const statusCount = (s: ServiceRequestStatus): number =>
      Number(byStatus.find((r) => r.status === s)?.c ?? 0)

    // 의뢰자 처리 대기: 검수 대기(delivered) + 제안이 도착한 모집(open) 의뢰.
    const deliveredMine = myReqRows.filter((r) => r.status === 'delivered').length
    const openMineIds = myReqRows.filter((r) => r.status === 'open').map((r) => r.id)
    let openWithProposals = 0
    if (openMineIds.length > 0) {
      const withProp = await this.dbs.db
        .select({ requestId: requestProposals.requestId })
        .from(requestProposals)
        .where(
          and(
            inArray(requestProposals.requestId, openMineIds),
            eq(requestProposals.status, 'submitted')
          )
        )
      openWithProposals = new Set(withProp.map((r) => r.requestId)).size
    }

    const actionableAsProvider = assignedRows.filter(
      (r) => r.status === 'matched' || r.status === 'in_progress'
    ).length

    return {
      openRequests: statusCount('open'),
      inProgressRequests:
        statusCount('matched') + statusCount('in_progress') + statusCount('delivered'),
      completedRequests: statusCount('completed'),
      activeProviders: Number(providers[0]?.c ?? 0),
      myRequests: myReqRows.length,
      myProposals: Number(myProposals[0]?.c ?? 0),
      actionableAsRequester: deliveredMine + openWithProposals,
      actionableAsProvider,
    }
  }

  // ── 운영자 모더레이션 ────────────────────────────────────────────────────────────

  async adminListRequests(
    user: AuthUser,
    filters: { status?: unknown; flagged?: unknown } = {}
  ): Promise<ServiceRequestListDto> {
    await this.assertAdmin(user)
    const status = this.normalizeStatus(filters.status)
    const flagged = this.normalizeFlagged(filters.flagged)
    const conds: SQL[] = []
    if (status) conds.push(eq(serviceRequests.status, status))
    if (flagged !== undefined) conds.push(eq(serviceRequests.flagged, flagged))
    const where = conds.length > 0 ? and(...conds) : undefined

    const rows = await this.dbs.db
      .select()
      .from(serviceRequests)
      .where(where)
      .orderBy(desc(serviceRequests.createdAt))

    const ids = rows.map((r) => r.id)
    const [counts, orgNames] = await Promise.all([
      this.countsFor(ids),
      this.orgNameMap(rows.map((r) => r.requesterOrgId)),
    ])
    const items = rows.map((row) =>
      this.toRequestDto(row, 'admin', {
        requesterOrgName: orgNames.get(row.requesterOrgId) ?? '',
        counts: counts.get(row.id),
        adminNote: true,
      })
    )
    return { items, total: items.length }
  }

  async adminUpdateRequest(
    user: AuthUser,
    id: string,
    input: AdminUpdateRequestInput
  ): Promise<ServiceRequestDto> {
    await this.assertAdmin(user)
    const parsed = adminUpdateRequestSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data
    const row = await this.findRequestOr404(id)
    if (data.status === 'cancelled' && data.escrowDecision === 'release') {
      throw new BadRequestException('취소와 정산 결정을 동시에 처리할 수 없습니다')
    }
    if (data.escrowDecision && row.escrowStatus !== 'held') {
      throw new ConflictException('보증 중인 모의 에스크로만 정산/환불 결정할 수 있습니다')
    }

    const changes: string[] = []
    const set: Partial<RequestRow> = { updatedAt: new Date() }
    let notifyType:
      | 'request_cancelled'
      | 'dispute_resolved'
      | 'escrow_released'
      | 'escrow_refunded'
      | null = null
    let notifyTitle = ''
    let notifyBody = ''
    let systemMessage: string | null = null
    let statusCancelRefund = false

    if (data.status === 'cancelled' && !this.isTerminal(row.status)) {
      set.status = 'cancelled'
      set.closedAt = new Date()
      if (row.escrowStatus === 'held') {
        set.escrowStatus = 'refunded'
        statusCancelRefund = true
        changes.push('모의 에스크로 환불')
      }
      changes.push('상태 cancelled')
      notifyType = 'request_cancelled'
      notifyTitle = '의뢰가 운영자에 의해 취소되었습니다'
      notifyBody = `"${row.title}" 의뢰가 운영자 판단으로 취소되었습니다.`
      systemMessage = '운영자가 의뢰를 강제 취소했습니다.'
    }
    if (data.escrowDecision === 'release') {
      set.escrowStatus = 'released'
      set.status = 'completed'
      set.closedAt = row.closedAt ?? new Date()
      if (data.flagged === undefined && row.flagged) set.flagged = false
      changes.push('모의 에스크로 정산')
      notifyType = 'escrow_released'
      notifyTitle = '운영자가 정산을 결정했습니다'
      notifyBody = `"${row.title}" 의뢰의 모의 에스크로가 정산 완료로 처리되었습니다.`
      systemMessage = '운영자가 분쟁을 검토해 모의 에스크로 정산을 결정했습니다.'
    } else if (data.escrowDecision === 'refund') {
      set.escrowStatus = 'refunded'
      set.status = 'cancelled'
      set.closedAt = row.closedAt ?? new Date()
      if (data.flagged === undefined && row.flagged) set.flagged = false
      changes.push('모의 에스크로 환불')
      notifyType = 'escrow_refunded'
      notifyTitle = '운영자가 환불을 결정했습니다'
      notifyBody = `"${row.title}" 의뢰의 모의 에스크로가 환불로 처리되었습니다.`
      systemMessage = '운영자가 분쟁을 검토해 모의 에스크로 환불을 결정했습니다.'
    }
    if (data.flagged !== undefined) {
      set.flagged = data.flagged
      changes.push(data.flagged ? '분쟁 표시' : '분쟁 해제')
      if (!data.flagged && !data.escrowDecision) {
        notifyType = 'dispute_resolved'
        notifyTitle = '분쟁 검토가 종료되었습니다'
        notifyBody = `"${row.title}" 의뢰의 운영자 분쟁 검토가 종료되었습니다.`
        systemMessage = '운영자가 분쟁 검토를 종료했습니다.'
      }
    }
    if (data.disputeNote !== undefined) {
      set.disputeNote = data.disputeNote
      changes.push(data.disputeNote === null ? '분쟁 메모 제거' : '분쟁 메모 갱신')
    } else if (data.escrowDecision && row.disputeNote) {
      changes.push('분쟁 메모 유지')
    }
    if (set.flagged === false && row.flagged && !changes.includes('분쟁 해제')) {
      changes.push('분쟁 해제')
    }
    if (data.adminNote !== undefined) {
      set.adminNote = data.adminNote
      changes.push(data.adminNote === null ? '메모 제거' : '메모 갱신')
    }

    const [updated] = await this.dbs.db
      .update(serviceRequests)
      .set(set)
      .where(eq(serviceRequests.id, row.id))
      .returning()

    if (data.escrowDecision === 'release' && row.status !== 'completed') {
      await this.incrementProviderCompleted(row)
    }
    if (data.escrowDecision === 'release') {
      await this.audit.record({
        orgId: row.requesterOrgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'escrow.released',
        targetType: 'service_request',
        targetId: row.id,
        metadata: { summary: `운영자 모의 에스크로 정산: ${row.title}` },
      })
    }
    if (data.escrowDecision === 'refund' || statusCancelRefund) {
      await this.audit.record({
        orgId: row.requesterOrgId,
        actorUserId: user.userId,
        actorName: user.name,
        action: 'escrow.refunded',
        targetType: 'service_request',
        targetId: row.id,
        metadata: { summary: `운영자 모의 에스크로 환불: ${row.title}` },
      })
    }
    if (systemMessage) {
      await this.dbs.db.insert(requestMessages).values({
        requestId: id,
        authorUserId: user.userId,
        authorName: user.name,
        authorRole: 'admin',
        kind: 'system',
        body: systemMessage,
      })
    }

    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'request.admin_updated',
      targetType: 'service_request',
      targetId: row.id,
      metadata: {
        summary: `의뢰 모더레이션: ${row.title} — ${changes.length > 0 ? changes.join(', ') : '변경 없음'}`,
      },
    })

    if (notifyType) {
      for (const recipient of [row.requesterUserId, row.assignedProviderUserId]) {
        await this.notifications.notify({
          userId: recipient,
          orgId: row.requesterOrgId,
          type: notifyType,
          title: notifyTitle,
          body: notifyBody,
          requestId: row.id,
          actorUserId: user.userId,
        })
      }
    }

    const counts = await this.countsFor([id])
    return this.toRequestDtoWithNames(updated!, 'admin', {
      counts: counts.get(id),
      adminNote: true,
    })
  }

  async adminListProviders(user: AuthUser): Promise<ProviderProfileListDto> {
    await this.assertAdmin(user)
    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .orderBy(desc(providerProfiles.verified), desc(providerProfiles.completedCount))
    const [orgNames, ratings] = await Promise.all([
      this.orgNameMap(rows.map((r) => r.orgId)),
      this.ratingMap(rows.map((r) => r.userId)),
    ])
    const items = rows.map((r) =>
      // 운영자 뷰: 비활성 포함, 연락처 노출.
      this.toProviderDto(r, orgNames.get(r.orgId) ?? '', {
        contact: true,
        rating: ratings.get(r.userId) ?? EMPTY_RATING,
      })
    )
    return { items, total: items.length }
  }

  async adminUpdateProvider(
    user: AuthUser,
    id: string,
    input: AdminUpdateProviderInput
  ): Promise<ProviderProfileDto> {
    await this.assertAdmin(user)
    const parsed = adminUpdateProviderSchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const data = parsed.data
    if (!UUID_RE.test(id)) throw new NotFoundException('전문가를 찾을 수 없습니다')

    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('전문가를 찾을 수 없습니다')

    const [updated] = await this.dbs.db
      .update(providerProfiles)
      .set({
        verified: data.verified ?? row.verified,
        active: data.active ?? row.active,
        updatedAt: new Date(),
      })
      .where(eq(providerProfiles.id, row.id))
      .returning()

    const changes: string[] = []
    if (data.verified !== undefined && data.verified !== row.verified) {
      changes.push(data.verified ? '검증 부여' : '검증 해제')
    }
    if (data.active !== undefined && data.active !== row.active) {
      changes.push(data.active ? '활성화' : '비활성화')
    }
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'provider.admin_updated',
      targetType: 'provider_profile',
      targetId: row.id,
      metadata: {
        summary: `전문가 모더레이션: ${row.displayName} — ${changes.length > 0 ? changes.join(', ') : '변경 없음'}`,
      },
    })

    const orgName = await this.orgName(updated!.orgId)
    const rating = await this.ratingFor(updated!.userId)
    return this.toProviderDto(updated!, orgName, { contact: true, rating })
  }

  // ── 내부: 권한·관계 ──────────────────────────────────────────────────────────────

  /**
   * 운영자(broker) = 가장 오래된(첫) organization 소속 + member.manage(owner/admin).
   * inquiries 의 visibleSiteScope 전례(첫 org member = 플랫폼 운영자)를 따른다.
   */
  private async isPlatformAdmin(user: AuthUser): Promise<boolean> {
    if (user.role !== 'owner' && user.role !== 'admin') return false
    const firstRows = await this.dbs.db
      .select({ id: organizations.id })
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1)
    return firstRows[0]?.id === user.orgId
  }

  private async assertAdmin(user: AuthUser): Promise<void> {
    if (!(await this.isPlatformAdmin(user))) {
      throw new ForbiddenException('운영자 권한이 필요합니다')
    }
  }

  private relationFor(
    user: AuthUser,
    row: RequestRow,
    admin: boolean,
    hasProposed: boolean
  ): ViewerRelation {
    if (row.requesterOrgId === user.orgId) return 'requester'
    if (row.assignedProviderUserId === user.userId || hasProposed) return 'provider'
    if (admin) return 'admin'
    return 'none'
  }

  private async assertCanUseThread(
    user: AuthUser,
    row: RequestRow
  ): Promise<{
    admin: boolean
    isRequester: boolean
    isProvider: boolean
    authorRole: ParticipantRole
  }> {
    const admin = await this.isPlatformAdmin(user)
    const isRequester = row.requesterOrgId === user.orgId
    const isProvider = row.assignedProviderUserId === user.userId
    if (!isRequester && !isProvider && !admin) {
      throw new NotFoundException('의뢰를 찾을 수 없습니다')
    }
    return {
      admin,
      isRequester,
      isProvider,
      authorRole: isRequester ? 'requester' : isProvider ? 'provider' : 'admin',
    }
  }

  private isTerminal(status: string): boolean {
    return status === 'completed' || status === 'cancelled'
  }

  private async transition(
    row: RequestRow,
    status: ServiceRequestStatus,
    extra: Partial<RequestRow> = {}
  ): Promise<RequestRow> {
    const [updated] = await this.dbs.db
      .update(serviceRequests)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(serviceRequests.id, row.id))
      .returning()
    return updated!
  }

  private async incrementProviderCompleted(row: RequestRow): Promise<void> {
    if (!row.assignedProviderUserId) return
    await this.dbs.db
      .update(providerProfiles)
      .set({
        completedCount: sql`${providerProfiles.completedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(providerProfiles.userId, row.assignedProviderUserId))
  }

  private async findRequestOr404(id: string): Promise<RequestRow> {
    if (!UUID_RE.test(id)) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('의뢰를 찾을 수 없습니다')
    return row
  }

  private async findAttachmentOr404(
    requestId: string,
    attachmentId: string
  ): Promise<AttachmentRow> {
    if (!UUID_RE.test(attachmentId)) throw new NotFoundException('첨부 파일을 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(requestAttachments)
      .where(
        and(eq(requestAttachments.id, attachmentId), eq(requestAttachments.requestId, requestId))
      )
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('첨부 파일을 찾을 수 없습니다')
    return row
  }

  private async claimableAttachmentsForMessage(
    user: AuthUser,
    requestId: string,
    ids: string[]
  ): Promise<AttachmentRow[]> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return []
    if (unique.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException(`메시지당 첨부는 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개입니다`)
    }

    const rows = await this.dbs.db
      .select()
      .from(requestAttachments)
      .where(
        and(
          inArray(requestAttachments.id, unique),
          eq(requestAttachments.requestId, requestId),
          eq(requestAttachments.uploaderUserId, user.userId),
          isNull(requestAttachments.messageId)
        )
      )
      .orderBy(asc(requestAttachments.createdAt))

    if (rows.length !== unique.length) {
      throw new BadRequestException('첨부 파일이 없거나 이미 다른 메시지에 연결되었습니다')
    }
    return rows
  }

  private async attachmentsForMessages(
    messageIds: string[]
  ): Promise<Map<string, RequestAttachmentDto[]>> {
    const map = new Map<string, RequestAttachmentDto[]>()
    if (messageIds.length === 0) return map
    const rows = await this.dbs.db
      .select()
      .from(requestAttachments)
      .where(inArray(requestAttachments.messageId, messageIds))
      .orderBy(asc(requestAttachments.createdAt))
    for (const row of rows) {
      if (!row.messageId) continue
      const list = map.get(row.messageId) ?? []
      list.push(this.toAttachmentDto(row))
      map.set(row.messageId, list)
    }
    return map
  }

  private async findProposalOr404(requestId: string, proposalId: string): Promise<ProposalRow> {
    if (!UUID_RE.test(proposalId)) throw new NotFoundException('제안을 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(requestProposals)
      .where(and(eq(requestProposals.id, proposalId), eq(requestProposals.requestId, requestId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('제안을 찾을 수 없습니다')
    return row
  }

  private async findMessageForFlagOr404(requestId: string, messageId: string): Promise<MessageRow> {
    if (!UUID_RE.test(messageId)) throw new NotFoundException('메시지를 찾을 수 없습니다')
    const rows = await this.dbs.db
      .select()
      .from(requestMessages)
      .where(and(eq(requestMessages.id, messageId), eq(requestMessages.requestId, requestId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('메시지를 찾을 수 없습니다')
    if (row.kind === 'system') {
      throw new BadRequestException('시스템 메시지는 이의제기 대상이 아닙니다')
    }
    return row
  }

  private composeDisputeNote(
    existing: string | null,
    user: AuthUser,
    note: string,
    message: MessageRow | null
  ): string {
    const target = message
      ? [
          `대상 메시지: ${message.authorName} (${message.authorRole})`,
          `작성 시각: ${new Date(message.createdAt).toISOString()}`,
          `내용: ${message.body.slice(0, 240)}`,
        ].join('\n')
      : '대상: 의뢰 전체'
    const entry = [`접수자: ${user.name}`, target, `사유: ${note}`].join('\n')
    return existing ? `${existing}\n\n---\n${entry}` : entry
  }

  private async notifyPlatformAdmins(row: RequestRow, actor: AuthUser): Promise<void> {
    const firstRows = await this.dbs.db
      .select({ id: organizations.id })
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1)
    const firstOrgId = firstRows[0]?.id
    if (!firstOrgId) return

    const admins = await this.dbs.db
      .select({ id: users.id, orgId: users.orgId })
      .from(users)
      .where(and(eq(users.orgId, firstOrgId), inArray(users.role, ['owner', 'admin'])))
    for (const admin of admins) {
      await this.notifications.notify({
        userId: admin.id,
        orgId: admin.orgId,
        type: 'request_flagged',
        title: '분쟁 큐에 새 이의제기가 접수되었습니다',
        body: `"${row.title}" 의뢰를 검토해 주세요.`,
        requestId: row.id,
        actorUserId: actor.userId,
      })
    }
  }

  private async activeProfileOf(userId: string): Promise<ProviderRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(providerProfiles)
      .where(and(eq(providerProfiles.userId, userId), eq(providerProfiles.active, true)))
      .limit(1)
    return rows[0] ?? null
  }

  /** 정책 slug 생성 — 이름에서 유도, 조직 내 충돌 시 접미사(auth.uniqueOrgSlug 전례). */
  private async uniquePolicySlug(orgId: string, name: string): Promise<string> {
    const derived = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
    const base = derived.length >= 2 ? derived : 'policy'
    let slug = base
    for (let i = 2; i < 1000; i++) {
      const hit = await this.dbs.db
        .select({ id: policies.id })
        .from(policies)
        .where(and(eq(policies.orgId, orgId), eq(policies.slug, slug)))
        .limit(1)
      if (!hit[0]) return slug
      slug = `${base}-${i}`.slice(0, 64)
    }
    throw new ConflictException('정책 slug 를 생성할 수 없습니다')
  }

  // ── 내부: 카운트·맵 ──────────────────────────────────────────────────────────────

  /** 의뢰별 제안/메시지 수 — 목록 N+1 방지용 일괄 집계. */
  private async countsFor(ids: string[]): Promise<Map<string, RequestCounts>> {
    const map = new Map<string, RequestCounts>()
    if (ids.length === 0) return map
    for (const id of ids) map.set(id, { proposalCount: 0, messageCount: 0 })

    const [proposals, messages] = await Promise.all([
      this.dbs.db
        .select({ id: requestProposals.requestId, c: sql<number>`count(*)::int` })
        .from(requestProposals)
        .where(inArray(requestProposals.requestId, ids))
        .groupBy(requestProposals.requestId),
      this.dbs.db
        .select({ id: requestMessages.requestId, c: sql<number>`count(*)::int` })
        .from(requestMessages)
        .where(inArray(requestMessages.requestId, ids))
        .groupBy(requestMessages.requestId),
    ])
    for (const p of proposals) {
      const entry = map.get(p.id)
      if (entry) entry.proposalCount = Number(p.c)
    }
    for (const m of messages) {
      const entry = map.get(m.id)
      if (entry) entry.messageCount = Number(m.c)
    }
    return map
  }

  /** 뷰어가 제안을 낸 의뢰 → 제안 id 맵(목록에서 myProposalId 채우기용). */
  private async myProposalMap(userId: string, ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (ids.length === 0) return map
    const rows = await this.dbs.db
      .select({ id: requestProposals.id, requestId: requestProposals.requestId })
      .from(requestProposals)
      .where(
        and(eq(requestProposals.providerUserId, userId), inArray(requestProposals.requestId, ids))
      )
    for (const r of rows) map.set(r.requestId, r.id)
    return map
  }

  private async myProposalId(userId: string, requestId: string): Promise<string | null> {
    const rows = await this.dbs.db
      .select({ id: requestProposals.id })
      .from(requestProposals)
      .where(
        and(eq(requestProposals.providerUserId, userId), eq(requestProposals.requestId, requestId))
      )
      .limit(1)
    return rows[0]?.id ?? null
  }

  /** providerUserId → 전문가 요약(카드). */
  private async providerSummaryMap(userIds: string[]): Promise<Map<string, ProposalProviderDto>> {
    const map = new Map<string, ProposalProviderDto>()
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return map
    const [rows, ratings] = await Promise.all([
      this.dbs.db.select().from(providerProfiles).where(inArray(providerProfiles.userId, unique)),
      this.ratingMap(unique),
    ])
    for (const r of rows) {
      const rating = ratings.get(r.userId) ?? EMPTY_RATING
      map.set(r.userId, {
        headline: r.headline,
        verified: r.verified,
        completedCount: r.completedCount,
        avgRating: rating.avgRating,
        reviewCount: rating.reviewCount,
      })
    }
    return map
  }

  /** providerUserId → 평균 별점·후기 수. 별점은 소수 1자리 반올림. */
  private async ratingMap(userIds: string[]): Promise<Map<string, RatingAgg>> {
    const map = new Map<string, RatingAgg>()
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return map
    const rows = await this.dbs.db
      .select({
        userId: providerReviews.providerUserId,
        avg: sql<number>`avg(${providerReviews.rating})`,
        c: sql<number>`count(*)::int`,
      })
      .from(providerReviews)
      .where(inArray(providerReviews.providerUserId, unique))
      .groupBy(providerReviews.providerUserId)
    for (const r of rows) {
      const count = Number(r.c)
      map.set(r.userId, {
        avgRating: count > 0 ? Math.round(Number(r.avg) * 10) / 10 : null,
        reviewCount: count,
      })
    }
    return map
  }

  private async ratingFor(userId: string): Promise<RatingAgg> {
    return (await this.ratingMap([userId])).get(userId) ?? EMPTY_RATING
  }

  /** 전문가의 최근 후기(단건 조회용). */
  private async reviewsForProvider(userId: string, limit = 20): Promise<ProviderReviewDto[]> {
    const rows = await this.dbs.db
      .select({
        review: providerReviews,
        requestTitle: serviceRequests.title,
      })
      .from(providerReviews)
      .leftJoin(serviceRequests, eq(providerReviews.requestId, serviceRequests.id))
      .where(eq(providerReviews.providerUserId, userId))
      .orderBy(desc(providerReviews.createdAt))
      .limit(limit)
    return rows.map((r) => this.toReviewDto(r.review, r.requestTitle ?? ''))
  }

  private async hasReviewFor(requestId: string): Promise<boolean> {
    const rows = await this.dbs.db
      .select({ id: providerReviews.id })
      .from(providerReviews)
      .where(eq(providerReviews.requestId, requestId))
      .limit(1)
    return rows.length > 0
  }

  private async orgName(orgId: string): Promise<string> {
    const rows = await this.dbs.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    return rows[0]?.name ?? ''
  }

  private async orgNameMap(orgIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const unique = [...new Set(orgIds)]
    if (unique.length === 0) return map
    const rows = await this.dbs.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, unique))
    for (const r of rows) map.set(r.id, r.name)
    return map
  }

  // ── 내부: 쿼리 정규화 ────────────────────────────────────────────────────────────

  private normalizeScope(value: unknown): 'mine' | 'assigned' | 'proposed' {
    if (value === 'assigned' || value === 'proposed') return value
    return 'mine'
  }

  private normalizeStatus(value: unknown): ServiceRequestStatus | undefined {
    if (value == null || value === '' || value === 'all') return undefined
    if (typeof value === 'string' && STATUS_SET.has(value)) {
      return value as ServiceRequestStatus
    }
    throw new BadRequestException('의뢰 status 값이 올바르지 않습니다')
  }

  private normalizeFlagged(value: unknown): boolean | undefined {
    if (value == null || value === '' || value === 'all') return undefined
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    throw new BadRequestException('flagged 값이 올바르지 않습니다')
  }

  private normalizeType(value: unknown): ServiceRequestType | undefined {
    if (value == null || value === '' || value === 'all') return undefined
    if (typeof value === 'string' && TYPE_SET.has(value)) {
      return value as ServiceRequestType
    }
    throw new BadRequestException('의뢰 type 값이 올바르지 않습니다')
  }

  private normalizePolicyType(value: unknown): PolicyType | undefined {
    if (value == null || value === '' || value === 'all') return undefined
    if (typeof value === 'string' && POLICY_TYPE_SET.has(value)) {
      return value as PolicyType
    }
    throw new BadRequestException('policyType 값이 올바르지 않습니다')
  }

  // ── 내부: 직렬화 ────────────────────────────────────────────────────────────────

  /** 단건 경로용 — 의뢰자 조직명을 즉석 조회해 채운 DTO. */
  private async toRequestDtoWithNames(
    row: RequestRow,
    viewerRelation: ViewerRelation,
    opts: {
      counts?: RequestCounts
      myProposalId?: string | null
      hideRequesterName?: boolean
      adminNote?: boolean
      hasReview?: boolean
    } = {}
  ): Promise<ServiceRequestDto> {
    const requesterOrgName = await this.orgName(row.requesterOrgId)
    return this.toRequestDto(row, viewerRelation, { ...opts, requesterOrgName })
  }

  private toRequestDto(
    row: RequestRow,
    viewerRelation: ViewerRelation,
    opts: {
      requesterOrgName?: string
      counts?: RequestCounts
      myProposalId?: string | null
      hideRequesterName?: boolean
      adminNote?: boolean
      hasReview?: boolean
    } = {}
  ): ServiceRequestDto {
    const showDispute = viewerRelation !== 'guest' && viewerRelation !== 'none'
    return {
      id: row.id,
      requesterOrgId: row.requesterOrgId,
      requesterOrgName: opts.requesterOrgName ?? '',
      requesterName: opts.hideRequesterName ? null : row.requesterName,
      title: row.title,
      description: row.description,
      serviceType: row.serviceType as ServiceRequestType,
      policyType: row.policyType as PolicyType,
      jurisdiction: row.jurisdiction,
      budgetMin: row.budgetMin,
      budgetMax: row.budgetMax,
      deadline: row.deadline ? new Date(row.deadline).toISOString().slice(0, 10) : null,
      status: row.status as ServiceRequestStatus,
      visibility: row.visibility as RequestVisibility,
      assignedProviderUserId: row.assignedProviderUserId,
      assignedProviderName: row.assignedProviderName,
      escrowStatus: row.escrowStatus as EscrowStatus,
      escrowAmount: row.escrowAmount,
      flagged: showDispute ? row.flagged : false,
      disputeNote: showDispute ? row.disputeNote : null,
      proposalCount: opts.counts?.proposalCount ?? 0,
      messageCount: opts.counts?.messageCount ?? 0,
      adminNote: opts.adminNote ? row.adminNote : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
      viewerRelation,
      myProposalId: opts.myProposalId ?? null,
      hasReview: opts.hasReview ?? false,
    }
  }

  private toProposalDto(
    row: ProposalRow,
    provider: ProposalProviderDto | null,
    opts: { providerOrgName: string }
  ): ProposalDto {
    return {
      id: row.id,
      requestId: row.requestId,
      providerUserId: row.providerUserId,
      providerName: row.providerName,
      providerOrgName: opts.providerOrgName,
      message: row.message,
      quotedAmount: row.quotedAmount,
      estimatedDays: row.estimatedDays,
      status: row.status as ProposalStatus,
      provider,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  }

  private toMessageDto(
    row: MessageRow,
    attachments: RequestAttachmentDto[] = []
  ): RequestMessageDto {
    return {
      id: row.id,
      requestId: row.requestId,
      authorUserId: row.authorUserId ?? '',
      authorName: row.authorName,
      authorRole: row.authorRole as ParticipantRole,
      kind: row.kind as MessageKind,
      body: row.body,
      attachments,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }

  private toAttachmentDto(row: AttachmentRow): RequestAttachmentDto {
    return {
      id: row.id,
      requestId: row.requestId,
      messageId: row.messageId,
      uploaderUserId: row.uploaderUserId,
      uploaderName: row.uploaderName,
      uploaderRole: row.uploaderRole as ParticipantRole,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }

  private toProviderDto(
    row: ProviderRow,
    orgName: string,
    opts: { contact: boolean; rating: RatingAgg; reviews?: ProviderReviewDto[] }
  ): ProviderProfileDto {
    return {
      id: row.id,
      userId: row.userId,
      orgId: row.orgId,
      orgName,
      displayName: row.displayName,
      headline: row.headline,
      bio: row.bio,
      specialties: splitCsv(row.specialties),
      jurisdictions: row.jurisdictions,
      hourlyRate: row.hourlyRate,
      contact: opts.contact ? row.contact : null,
      verified: row.verified,
      active: row.active,
      completedCount: row.completedCount,
      avgRating: opts.rating.avgRating,
      reviewCount: opts.rating.reviewCount,
      reviews: opts.reviews,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  }

  private toReviewDto(row: ReviewRow, requestTitle: string): ProviderReviewDto {
    return {
      id: row.id,
      providerUserId: row.providerUserId,
      requestId: row.requestId,
      requestTitle,
      reviewerName: row.reviewerName,
      rating: row.rating,
      comment: row.comment,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }
}
