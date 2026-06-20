import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { PlanService } from '../common/plan.service'
import { DatabaseService } from '../db/database.service'
import {
  notifications,
  organizations,
  policies,
  policyVersions,
  providerProfiles,
  users,
} from '../db/schema'
import { NotificationsService } from '../notifications/notifications.service'
import { PoliciesService } from '../policies/policies.service'
import { VersionsService } from '../policies/versions.service'

import { BrokerageService } from './brokerage.service'

import type { AttachmentStorageService } from './attachment-storage.service'
import type { AuthUser } from '../common/request-context'
import type { AppConfig } from '../config'
import type { CreateServiceRequestInput } from '@termsdesk/shared'

const baseConfig = (dir: string): AppConfig => ({
  mode: 'saas',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: dir,
  jwtSecret: 'test',
  seedAdminEmail: 'admin@example.com',
  seedAdminPassword: 'password',
  publicCacheTtl: 60,
  allowSignup: true,
  googleClientId: null,
  allowDemo: false,
  inquiryAllowedOrigins: [],
  attachmentStorage: {
    bucket: null,
    region: 'ap-northeast-2',
    endpoint: null,
    forcePathStyle: false,
    maxBytes: 10 * 1024 * 1024,
  },
})

const requestInput = (
  over: Partial<CreateServiceRequestInput> = {}
): CreateServiceRequestInput => ({
  title: '개인정보처리방침 개정 검토 의뢰',
  description: '서비스 개편으로 수집 항목이 바뀌어 개정·검토가 필요합니다. 자문 부탁드립니다.',
  serviceType: 'review',
  policyType: 'privacy',
  jurisdiction: 'KR',
  budgetMin: 500_000,
  budgetMax: 1_500_000,
  visibility: 'public',
  ...over,
})

const userOf = (orgId: string, over: Partial<AuthUser> = {}): AuthUser => ({
  userId: randomUUID(),
  orgId,
  role: 'admin',
  name: '담당자',
  email: 'user@example.com',
  ...over,
})

describe('BrokerageService', () => {
  let dir: string
  let dbs: DatabaseService
  let audit: AuditService
  let service: BrokerageService

  const insertOrg = async (name: string, slug: string, createdAt: Date) => {
    const [row] = await dbs.db.insert(organizations).values({ name, slug, createdAt }).returning()
    return row!
  }

  const makeProvider = async (
    userId: string,
    orgId: string,
    over: Record<string, unknown> = {}
  ) => {
    const [row] = await dbs.db
      .insert(providerProfiles)
      .values({
        userId,
        orgId,
        displayName: '김전문',
        headline: '개인정보·약관 10년',
        bio: '스타트업 약관/개인정보처리방침 작성·검토를 다수 수행했습니다.',
        specialties: 'privacy,terms',
        jurisdictions: 'KR',
        active: true,
        ...over,
      })
      .returning()
    return row!
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-brokerage-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    audit = new AuditService(dbs)
    const plans = new PlanService(dbs)
    const policiesService = new PoliciesService(dbs, audit, plans)
    const versionsService = new VersionsService(dbs, policiesService, audit)
    const notify = new NotificationsService(dbs)
    const storage = {
      isConfigured: () => true,
      maxBytes: () => 10 * 1024 * 1024,
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => ({
        buffer: Buffer.from('stored'),
        contentType: 'text/plain',
        contentLength: 6,
      })),
    } as unknown as AttachmentStorageService
    service = new BrokerageService(dbs, audit, policiesService, versionsService, notify, storage)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('의뢰 생성은 의뢰자 관계로 직렬화되고 조직명·관계를 채운다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const requester = userOf(org.id, { name: '의뢰자' })

    const created = await service.createRequest(requester, requestInput())
    expect(created.status).toBe('open')
    expect(created.viewerRelation).toBe('requester')
    expect(created.requesterOrgName).toBe('Acme')
    expect(created.requesterName).toBe('의뢰자')
    expect(created.proposalCount).toBe(0)

    const events = await audit.list(org.id)
    expect(events.find((e) => e.action === 'request.created')?.targetId).toBe(created.id)
  })

  it('완료 산출물을 약관 초안 버전으로 가져온다(E2E 전체 흐름)', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)

    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '개인정보처리방침 개정안을 2주 내 작성·검토해 드리겠습니다. 레퍼런스 다수 보유.',
      quotedAmount: 1_000_000,
      estimatedDays: 14,
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    await service.startRequest(provider, created.id)
    await service.postMessage(provider, created.id, {
      kind: 'delivery',
      body: '제1조(목적) 본 방침은 ... 개정 산출물 전문입니다.',
    })

    const result = await service.importToPolicy(requester, created.id, {})
    expect(result.versionLabel).toBe('v1')

    const pol = await dbs.db.select().from(policies).where(eq(policies.id, result.policyId))
    expect(pol[0]?.orgId).toBe(reqOrg.id)
    expect(pol[0]?.type).toBe('privacy')
    const ver = await dbs.db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.id, result.versionId))
    expect(ver[0]?.body).toContain('개정 산출물 전문입니다')
    expect(ver[0]?.status).toBe('draft')
  })

  it('가져오기는 산출물(제출본)이 없으면 거부한다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const requester = userOf(org.id)
    const created = await service.createRequest(requester, requestInput())
    await expect(service.importToPolicy(requester, created.id, {})).rejects.toThrow()
  })

  it('완료 의뢰 전문가 평가가 평균 별점·hasReview 에 반영된다(E2E)', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    const profile = await makeProvider(provider.userId, provOrg.id)

    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '검토를 맡아 성실히 진행하겠습니다. 충분한 경험이 있습니다. 감사합니다.',
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    await service.startRequest(provider, created.id)
    await service.postMessage(provider, created.id, {
      kind: 'delivery',
      body: '산출물 제출본입니다.',
    })
    await service.completeRequest(requester, created.id)

    const review = await service.submitReview(requester, created.id, {
      rating: 5,
      comment: '꼼꼼하고 빠른 검토였습니다.',
    })
    expect(review.rating).toBe(5)

    // 의뢰당 1회 — 중복 평가 거부.
    await expect(service.submitReview(requester, created.id, { rating: 4 })).rejects.toThrow()

    // 전문가 단건 조회에 평균 별점·후기 반영.
    const dto = await service.getProvider(requester, profile.id)
    expect(dto.avgRating).toBe(5)
    expect(dto.reviewCount).toBe(1)
    expect(dto.reviews?.length).toBe(1)

    // 상세에 hasReview 반영.
    const detail = await service.getRequest(requester, created.id)
    expect(detail.request.hasReview).toBe(true)
  })

  it('미완료 의뢰는 평가할 수 없다', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const requester = userOf(org.id)
    const created = await service.createRequest(requester, requestInput())
    await expect(service.submitReview(requester, created.id, { rating: 5 })).rejects.toThrow()
  })

  it('제안 제출 시 의뢰자에게 알림이 생성된다', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    await service.submitProposal(provider, created.id, {
      message: '제안드립니다. 충분한 경험으로 성실히 도와드리겠습니다. 감사합니다.',
    })

    const notes = await dbs.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, requester.userId))
    expect(notes.length).toBe(1)
    expect(notes[0]?.type).toBe('proposal_received')
    expect(notes[0]?.requestId).toBe(created.id)
  })

  it('모의 에스크로: 수락 시 보증, 완료 시 정산', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '견적과 함께 제안드립니다. 성실히 진행하겠습니다. 감사합니다.',
      quotedAmount: 1_200_000,
    })
    const matched = await service.acceptProposal(requester, created.id, proposal.id)
    expect(matched.escrowStatus).toBe('held')
    expect(matched.escrowAmount).toBe(1_200_000)

    await service.startRequest(provider, created.id)
    await service.postMessage(provider, created.id, {
      kind: 'delivery',
      body: '산출물 제출본입니다.',
    })
    const done = await service.completeRequest(requester, created.id)
    expect(done.escrowStatus).toBe('released')
  })

  it('모의 에스크로: 보증 중 취소 시 환불', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '제안드립니다. 잘 부탁드립니다. 감사합니다.',
      quotedAmount: 800_000,
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    const cancelled = await service.cancelRequest(requester, created.id)
    expect(cancelled.escrowStatus).toBe('refunded')
  })

  it('검수 반려는 delivered 산출물을 in_progress 로 되돌리고 전문가에게 알린다', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '검수 반려 대응까지 포함해 작업하겠습니다. 잘 부탁드립니다.',
      quotedAmount: 900_000,
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    await service.startRequest(provider, created.id)
    await service.postMessage(provider, created.id, {
      kind: 'delivery',
      body: '초기 산출물 제출본입니다.',
    })

    const revised = await service.requestRevision(requester, created.id, {
      note: '환불 조항의 근거와 예외 문구를 보강해 주세요.',
    })
    expect(revised.status).toBe('in_progress')

    const detail = await service.getRequest(requester, created.id)
    expect(detail.messages.some((m) => m.body.includes('재작업 요청'))).toBe(true)
    const notes = await dbs.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, provider.userId))
    expect(notes.some((n) => n.type === 'revision_requested')).toBe(true)
  })

  it('참고자료 첨부는 업로드 후 메시지에 연결되어 참여자 상세에 노출된다', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '첨부 자료를 확인하고 범위를 잡겠습니다. 잘 부탁드립니다.',
    })
    await service.acceptProposal(requester, created.id, proposal.id)

    const attachment = await service.uploadAttachment(requester, created.id, {
      originalname: '검토 참고자료.pdf',
      mimetype: 'application/pdf',
      size: 7,
      buffer: Buffer.from('pdfdata'),
    })
    expect(attachment.messageId).toBeNull()
    expect(attachment.fileName).toBe('검토 참고자료.pdf')

    const message = await service.postMessage(requester, created.id, {
      kind: 'message',
      body: '첨부한 현행 약관을 기준으로 검토해 주세요.',
      attachmentIds: [attachment.id],
    })
    expect(message.attachments).toHaveLength(1)
    expect(message.attachments[0]?.messageId).toBe(message.id)

    const detail = await service.getRequest(provider, created.id)
    const savedMessage = detail.messages.find((m) => m.id === message.id)
    expect(savedMessage?.attachments[0]?.fileName).toBe('검토 참고자료.pdf')

    await expect(
      service.postMessage(requester, created.id, {
        kind: 'message',
        body: '같은 첨부는 재사용할 수 없습니다.',
        attachmentIds: [attachment.id],
      })
    ).rejects.toThrow('이미 다른 메시지')
  })

  it('참여자 이의제기는 분쟁 큐에 올리고 운영자·상대 참여자에게 알린다', async () => {
    const brokerOrg = await insertOrg('운영사', 'broker-co', new Date('2026-01-01T00:00:00Z'))
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-02T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-03T00:00:00Z'))
    const operator = userOf(brokerOrg.id, {
      role: 'owner',
      name: '운영자',
      email: 'operator@example.com',
    })
    await dbs.db.insert(users).values({
      id: operator.userId,
      orgId: brokerOrg.id,
      email: operator.email,
      name: operator.name,
      role: operator.role,
    })
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '검토 범위를 명확히 하여 진행하겠습니다. 잘 부탁드립니다.',
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    await service.startRequest(provider, created.id)
    const message = await service.postMessage(provider, created.id, {
      kind: 'message',
      body: '합의 범위 외 추가 작업은 별도 견적이 필요합니다.',
    })

    const flagged = await service.flagRequest(requester, created.id, {
      messageId: message.id,
      note: '합의된 범위와 다르게 추가 견적을 요구합니다.',
    })
    expect(flagged.flagged).toBe(true)
    expect(flagged.disputeNote).toContain('합의된 범위')
    expect(flagged.disputeNote).toContain('대상 메시지')

    const queue = await service.adminListRequests(operator, { flagged: 'true' })
    expect(queue.total).toBe(1)
    expect(queue.items[0]?.id).toBe(created.id)

    const operatorNotes = await dbs.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, operator.userId))
    expect(operatorNotes.some((n) => n.type === 'request_flagged')).toBe(true)
    const providerNotes = await dbs.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, provider.userId))
    expect(providerNotes.some((n) => n.type === 'request_flagged')).toBe(true)
  })

  it('운영자는 분쟁 의뢰의 보증금을 정산 결정하고 완료 이력을 반영한다', async () => {
    const brokerOrg = await insertOrg('운영사', 'broker-co', new Date('2026-01-01T00:00:00Z'))
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-02T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-03T00:00:00Z'))
    const operator = userOf(brokerOrg.id, { role: 'owner', name: '운영자' })
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '견적 포함 제안입니다. 분쟁 시 운영자 중재 기준을 따르겠습니다.',
      quotedAmount: 1_100_000,
    })
    await service.acceptProposal(requester, created.id, proposal.id)
    await service.flagRequest(requester, created.id, {
      note: '진행 일정에 대한 이견이 있어 운영자 검토가 필요합니다.',
    })

    const resolved = await service.adminUpdateRequest(operator, created.id, {
      escrowDecision: 'release',
      disputeNote: '산출 범위 이행 확인. 전문가 정산 결정.',
    })
    expect(resolved.status).toBe('completed')
    expect(resolved.escrowStatus).toBe('released')
    expect(resolved.flagged).toBe(false)

    const profileRows = await dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, provider.userId))
    expect(profileRows[0]?.completedCount).toBe(1)
  })

  it('운영자 강제 취소는 보증 중 모의 에스크로를 환불 처리한다', async () => {
    const brokerOrg = await insertOrg('운영사', 'broker-co', new Date('2026-01-01T00:00:00Z'))
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-02T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-03T00:00:00Z'))
    const operator = userOf(brokerOrg.id, { role: 'owner', name: '운영자' })
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '전문가' })
    await makeProvider(provider.userId, provOrg.id)
    const created = await service.createRequest(requester, requestInput())
    const proposal = await service.submitProposal(provider, created.id, {
      message: '견적 포함 제안입니다. 성실히 진행하겠습니다. 잘 부탁드립니다.',
      quotedAmount: 700_000,
    })
    await service.acceptProposal(requester, created.id, proposal.id)

    const cancelled = await service.adminUpdateRequest(operator, created.id, {
      status: 'cancelled',
      flagged: false,
      disputeNote: '중재 결과 환불 처리',
    })
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.escrowStatus).toBe('refunded')
    expect(cancelled.flagged).toBe(false)
  })

  it('비참여 전문가는 open 의뢰를 guest 로 열람한다(제안 진입점, 의뢰자명 가림)', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const created = await service.createRequest(requester, requestInput())

    const viewer = userOf(provOrg.id, { name: '구경꾼' })
    const detail = await service.getRequest(viewer, created.id)
    expect(detail.request.viewerRelation).toBe('guest')
    expect(detail.request.requesterName).toBeNull()
    expect(detail.proposals).toHaveLength(0)
  })

  it('비참여자는 open 이 아닌 의뢰를 볼 수 없다(404)', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const created = await service.createRequest(requester, requestInput())
    await service.cancelRequest(requester, created.id)

    const viewer = userOf(provOrg.id)
    await expect(service.getRequest(viewer, created.id)).rejects.toThrow(NotFoundException)
  })

  it('마켓: 공개 open 의뢰만 노출, 비참여 전문가에겐 의뢰자 이름을 가린다', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    await service.createRequest(requester, requestInput())
    await service.createRequest(
      requester,
      requestInput({ title: '비공개 의뢰', visibility: 'private' })
    )

    const viewer = userOf(provOrg.id)
    const market = await service.marketplace(viewer)
    expect(market.total).toBe(1)
    expect(market.items[0]?.requesterName).toBeNull()
    expect(market.items[0]?.viewerRelation).toBe('guest')
  })

  it('제안: 활성 프로필 필요·자기 조직 의뢰 불가·open 상태만', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const request = await service.createRequest(requester, requestInput())

    // 프로필 없는 사용자는 제안 불가.
    const noProfile = userOf(provOrg.id, { name: '미등록' })
    await expect(
      service.submitProposal(noProfile, request.id, {
        message: '검토 도와드리겠습니다. 연락 주세요.',
      })
    ).rejects.toBeInstanceOf(ForbiddenException)

    // 자기 조직 의뢰엔 제안 불가(의뢰자가 전문가 프로필을 가져도).
    await makeProvider(requester.userId, reqOrg.id)
    await expect(
      service.submitProposal(requester, request.id, {
        message: '자기 의뢰엔 제안 불가합니다. 테스트.',
      })
    ).rejects.toBeInstanceOf(ForbiddenException)

    // 활성 전문가가 타 조직 의뢰에 제안.
    const provider = userOf(provOrg.id, { name: '김전문' })
    await makeProvider(provider.userId, provOrg.id)
    const proposal = await service.submitProposal(provider, request.id, {
      message: '개정 검토·자문 가능합니다. 산출물은 5영업일 내 드리겠습니다.',
      quotedAmount: 1_000_000,
      estimatedDays: 5,
    })
    expect(proposal.status).toBe('submitted')
    expect(proposal.provider?.headline).toBe('개인정보·약관 10년')
  })

  it('수락 → 나머지 reject + matched + 배정 + 시스템 메시지, 라이프사이클 전이', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const otherOrg = await insertOrg('전문가사2', 'prov2-co', new Date('2026-01-03T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '김전문' })
    const other = userOf(otherOrg.id, { name: '이전문' })
    await makeProvider(provider.userId, provOrg.id)
    await makeProvider(other.userId, otherOrg.id)

    const request = await service.createRequest(requester, requestInput())
    const winning = await service.submitProposal(provider, request.id, {
      message: '제안드립니다. 개정 검토 5영업일 내 산출물 제공합니다.',
    })
    await service.submitProposal(other, request.id, {
      message: '저도 제안드립니다. 약관 검토 경험 풍부합니다. 잘 부탁드립니다.',
    })

    const matched = await service.acceptProposal(requester, request.id, winning.id)
    expect(matched.status).toBe('matched')
    expect(matched.assignedProviderUserId).toBe(provider.userId)

    // 배정 전문가만 진행 시작.
    await expect(service.startRequest(other, request.id)).rejects.toBeInstanceOf(NotFoundException)
    const started = await service.startRequest(provider, request.id)
    expect(started.status).toBe('in_progress')

    // 산출물 제출(delivery) → delivered, 그 후 의뢰자가 완료 → completed + 전문가 완료수 증가.
    await service.postMessage(provider, request.id, {
      body: '검토 완료된 개정안 초안을 첨부합니다. 확인 부탁드립니다.',
      kind: 'delivery',
    })
    const completed = await service.completeRequest(requester, request.id)
    expect(completed.status).toBe('completed')
    expect(completed.closedAt).not.toBeNull()

    const detail = await service.getRequest(requester, request.id)
    expect(detail.proposals.find((p) => p.id === winning.id)?.status).toBe('accepted')
    expect(detail.proposals.filter((p) => p.status === 'rejected')).toHaveLength(1)
    // 수락 시 시스템 메시지 1 + delivery 1.
    expect(detail.messages.some((m) => m.kind === 'system')).toBe(true)
    expect(detail.messages.some((m) => m.kind === 'delivery')).toBe(true)

    const profileRows = await dbs.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, provider.userId))
    expect(profileRows[0]?.completedCount).toBe(1)
  })

  it('상세 접근: 비참여자는 open 을 guest 로(제안·의뢰자명 가림), 전문가는 본인 제안만', async () => {
    const reqOrg = await insertOrg('의뢰사', 'req-co', new Date('2026-01-01T00:00:00Z'))
    const provOrg = await insertOrg('전문가사', 'prov-co', new Date('2026-01-02T00:00:00Z'))
    const otherOrg = await insertOrg('전문가사2', 'prov2-co', new Date('2026-01-03T00:00:00Z'))
    const requester = userOf(reqOrg.id, { name: '의뢰자' })
    const provider = userOf(provOrg.id, { name: '김전문' })
    const other = userOf(otherOrg.id, { name: '이전문' })
    await makeProvider(provider.userId, provOrg.id)
    await makeProvider(other.userId, otherOrg.id)

    const request = await service.createRequest(requester, requestInput())
    await service.submitProposal(provider, request.id, {
      message: '제안 A 입니다. 개정 검토를 도와드리겠습니다. 감사합니다.',
    })
    await service.submitProposal(other, request.id, {
      message: '제안 B 입니다. 저도 검토 가능합니다. 잘 부탁드립니다. 감사합니다.',
    })

    // 비참여 제3자라도 open 의뢰는 guest 로 열람(제안 진입점) — 단 다른 제안·의뢰자명은 가려진다.
    const outsider = userOf(
      (await insertOrg('무관사', 'none-co', new Date('2026-01-04T00:00:00Z'))).id
    )
    const outsiderView = await service.getRequest(outsider, request.id)
    expect(outsiderView.request.viewerRelation).toBe('guest')
    expect(outsiderView.request.requesterName).toBeNull()
    expect(outsiderView.proposals).toHaveLength(0)

    // 의뢰자는 전체 제안, 전문가는 본인 제안만.
    const requesterView = await service.getRequest(requester, request.id)
    expect(requesterView.proposals).toHaveLength(2)
    const providerView = await service.getRequest(provider, request.id)
    expect(providerView.proposals).toHaveLength(1)
    expect(providerView.proposals[0]?.providerUserId).toBe(provider.userId)
  })

  it('운영자(첫 조직 owner/admin)만 모더레이션, 그 외는 403', async () => {
    const first = await insertOrg('운영사', 'broker-co', new Date('2026-01-01T00:00:00Z'))
    const second = await insertOrg('일반사', 'tenant-co', new Date('2026-01-02T00:00:00Z'))
    const operator = userOf(first.id, { role: 'owner', name: '운영자' })
    const tenant = userOf(second.id, { role: 'admin', name: '테넌트' })

    await service.createRequest(tenant, requestInput())

    await expect(service.adminListRequests(tenant)).rejects.toBeInstanceOf(ForbiddenException)
    const adminView = await service.adminListRequests(operator)
    expect(adminView.total).toBe(1)
    expect(adminView.items[0]?.adminNote).toBeNull()

    const target = adminView.items[0]!
    const moderated = await service.adminUpdateRequest(operator, target.id, {
      status: 'cancelled',
      adminNote: '중복 의뢰로 취소',
    })
    expect(moderated.status).toBe('cancelled')
    expect(moderated.adminNote).toBe('중복 의뢰로 취소')
  })

  it('전문가 프로필 upsert 는 verified 를 보존하고 목록은 검증·완료수로 정렬', async () => {
    const org = await insertOrg('전문가사', 'prov-co', new Date('2026-01-01T00:00:00Z'))
    const user = userOf(org.id, { name: '김전문' })

    const created = await service.upsertProvider(user, {
      displayName: '김전문',
      headline: '약관 전문',
      bio: '스타트업 약관·개인정보처리방침 다수 작성 경험이 있습니다. 잘 부탁드립니다.',
      specialties: ['privacy'],
      jurisdictions: 'KR',
      active: true,
    })
    expect(created.verified).toBe(false)
    expect(created.contact).toBeNull()

    // 운영자 검증 부여 후 본인 upsert 가 verified 를 덮지 않는다.
    const broker = userOf(org.id, { role: 'owner' })
    await service.adminUpdateProvider(broker, created.id, { verified: true })
    const reupserted = await service.upsertProvider(user, {
      displayName: '김전문',
      headline: '약관 전문(수정)',
      bio: '약관·개인정보 작성/검토 경험을 더 보강했습니다. 연락 주시면 빠르게 회신합니다.',
      specialties: ['privacy', 'terms'],
      jurisdictions: 'KR',
      active: true,
    })
    expect(reupserted.verified).toBe(true)

    const list = await service.listProviders(user)
    expect(list.items[0]?.contact).toBeNull()
    expect(list.items.find((p) => p.id === created.id)?.verified).toBe(true)
  })

  it('잘못된 status 쿼리는 400, 미존재 의뢰는 404', async () => {
    const org = await insertOrg('Acme', 'acme', new Date('2026-01-01T00:00:00Z'))
    const user = userOf(org.id)
    await expect(service.listRequests(user, { status: 'nope' })).rejects.toThrow('status')
    await expect(service.getRequest(user, randomUUID())).rejects.toBeInstanceOf(NotFoundException)
  })
})
