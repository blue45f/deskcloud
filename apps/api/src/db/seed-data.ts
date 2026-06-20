import { computeContentHash } from '@termsdesk/shared'
import { eq, sql } from 'drizzle-orm'

import { hashApiKey, hashPassword, randomUUID } from '../common/crypto'

import { DatabaseService } from './database.service'
import {
  apiKeys,
  auditEvents,
  consentReceipts,
  organizations,
  policies,
  policyVersions,
  providerProfiles,
  requestMessages,
  requestProposals,
  serviceRequests,
  users,
} from './schema'

import type { AppConfig } from '../config'

/** 데모용 공개(publishable) API 키 — 셀프호스트 데모에서 SDK/데모 페이지가 사용. 운영에서 교체. */
export const DEMO_API_KEY = 'tdk_demo_publishable_key_change_me'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

const TERMS_V1 = `제1조 (목적)
이 약관은 Acme(이하 "회사")가 제공하는 서비스의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (이용계약의 성립)
이용계약은 이용자가 약관에 동의하고 회사가 이를 승낙함으로써 성립합니다.

제3조 (서비스의 제공)
회사는 연중무휴, 1일 24시간 서비스를 제공함을 원칙으로 합니다.`

const TERMS_V2 = `제1조 (목적)
이 약관은 Acme(이하 "회사")가 제공하는 서비스의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (이용계약의 성립)
이용계약은 이용자가 약관에 동의하고 회사가 이를 승낙함으로써 성립합니다.

제3조 (서비스의 제공)
회사는 연중무휴, 1일 24시간 서비스를 제공함을 원칙으로 합니다.
다만, 시스템 점검 등 운영상 필요한 경우 서비스 제공을 일시 중단할 수 있습니다.

제4조 (게시물의 관리)
회사는 이용자가 게시한 콘텐츠가 관련 법령에 위반되는 경우 사전 통지 없이 삭제할 수 있습니다.`

const PRIVACY_V1 = `1. 수집하는 개인정보 항목
회사는 회원가입, 서비스 제공을 위해 아래의 개인정보를 수집합니다.
- 필수: 이메일, 비밀번호
- 선택: 휴대전화번호

2. 개인정보의 보유 및 이용기간
회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보관할 수 있습니다.

3. 개인정보의 파기
보유기간이 경과한 개인정보는 지체 없이 파기합니다.`

const MARKETING_V1 = `광고성 정보 수신 동의
회사는 이벤트·혜택 등 광고성 정보를 이메일 및 앱 푸시로 발송할 수 있습니다.
본 동의는 선택사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다.
수신 동의는 마이페이지에서 언제든지 철회할 수 있습니다.`

const REFUND_DRAFT = `환불 정책 (초안)
디지털 콘텐츠는 구매 후 7일 이내, 미사용에 한해 환불이 가능합니다.
(법무 검토 중 — 미게시 초안)`

export interface SeedResult {
  seeded: boolean
  orgId?: string
}

/** 멱등 시드 — 조직/관리자 보장 + (데모) 비어 있으면 샘플 데이터 채움. */
export async function runSeed(
  dbs: DatabaseService,
  cfg: AppConfig,
  opts: { demo: boolean }
): Promise<SeedResult> {
  const existingOrg = await dbs.db.select().from(organizations).limit(1)
  let orgId: string
  if (existingOrg[0]) {
    orgId = existingOrg[0].id
  } else {
    orgId = randomUUID()
    await dbs.db.insert(organizations).values({ id: orgId, name: 'Acme', slug: 'acme' })
  }

  // 관리자(owner) 보장
  const adminEmail = cfg.seedAdminEmail.toLowerCase()
  const existingAdmin = await dbs.db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1)
  if (!existingAdmin[0]) {
    await dbs.db.insert(users).values({
      id: randomUUID(),
      orgId,
      email: adminEmail,
      name: '관리자',
      role: 'owner',
      passwordHash: hashPassword(cfg.seedAdminPassword),
    })
  }

  if (!opts.demo) return { seeded: false, orgId }

  // 이미 정책이 있으면 데모 시드 건너뜀
  const policyCount = await dbs.db.select({ c: sql<number>`count(*)` }).from(policies)
  if (Number(policyCount[0]?.c ?? 0) > 0) return { seeded: false, orgId }

  // 추가 멤버(역할 시연)
  const editorId = randomUUID()
  const publisherId = randomUUID()
  await dbs.db.insert(users).values([
    {
      id: editorId,
      orgId,
      email: 'editor@acme.test',
      name: '김편집',
      role: 'editor',
      passwordHash: hashPassword('termsdesk-demo'),
    },
    {
      id: publisherId,
      orgId,
      email: 'publisher@acme.test',
      name: '이게시',
      role: 'publisher',
      passwordHash: hashPassword('termsdesk-demo'),
    },
  ])

  // ── 이용약관: v1(보관) → v2(현재) ──
  const termsId = randomUUID()
  await dbs.db.insert(policies).values({
    id: termsId,
    orgId,
    slug: 'terms-of-service',
    name: '이용약관',
    type: 'terms',
    jurisdiction: 'KR',
    description: '서비스 이용에 관한 기본 약관',
  })
  const termsV1Id = randomUUID()
  const termsV2Id = randomUUID()
  const termsV1Hash = await computeContentHash(TERMS_V1)
  const termsV2Hash = await computeContentHash(TERMS_V2)
  await dbs.db.insert(policyVersions).values([
    {
      id: termsV1Id,
      orgId,
      policyId: termsId,
      versionNumber: 1,
      versionLabel: 'v1',
      title: '이용약관 v1',
      body: TERMS_V1,
      contentHash: termsV1Hash,
      status: 'archived',
      locale: 'ko',
      changeSummary: '최초 제정',
      effectiveAt: daysAgo(180),
      createdBy: editorId,
      publishedBy: publisherId,
      createdAt: daysAgo(185),
      publishedAt: daysAgo(180),
      archivedAt: daysAgo(30),
    },
    {
      id: termsV2Id,
      orgId,
      policyId: termsId,
      versionNumber: 2,
      versionLabel: 'v2',
      title: '이용약관 v2',
      body: TERMS_V2,
      contentHash: termsV2Hash,
      status: 'published',
      locale: 'ko',
      requiresReconsent: true,
      changeSummary: '서비스 중단 사유 및 게시물 관리(제4조) 조항 추가',
      effectiveAt: daysAgo(30),
      createdBy: editorId,
      publishedBy: publisherId,
      createdAt: daysAgo(40),
      publishedAt: daysAgo(30),
    },
  ])
  await dbs.db.update(policies).set({ currentVersionId: termsV2Id }).where(eq(policies.id, termsId))

  // ── 개인정보처리방침: v1(현재) ──
  const privacyId = randomUUID()
  await dbs.db.insert(policies).values({
    id: privacyId,
    orgId,
    slug: 'privacy-policy',
    name: '개인정보처리방침',
    type: 'privacy',
    jurisdiction: 'KR',
    description: '개인정보 수집·이용·파기에 관한 방침',
  })
  const privacyV1Id = randomUUID()
  const privacyHash = await computeContentHash(PRIVACY_V1)
  await dbs.db.insert(policyVersions).values({
    id: privacyV1Id,
    orgId,
    policyId: privacyId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: '개인정보처리방침 v1',
    body: PRIVACY_V1,
    contentHash: privacyHash,
    status: 'published',
    locale: 'ko',
    changeSummary: '최초 제정',
    effectiveAt: daysAgo(90),
    createdBy: editorId,
    publishedBy: publisherId,
    createdAt: daysAgo(95),
    publishedAt: daysAgo(90),
  })
  await dbs.db
    .update(policies)
    .set({ currentVersionId: privacyV1Id })
    .where(eq(policies.id, privacyId))

  // ── 마케팅 수신 동의: v1(현재) ──
  const marketingId = randomUUID()
  await dbs.db.insert(policies).values({
    id: marketingId,
    orgId,
    slug: 'marketing-consent',
    name: '마케팅 정보 수신 동의',
    type: 'marketing',
    jurisdiction: 'KR',
    description: '광고성 정보 수신에 대한 선택 동의',
  })
  const marketingV1Id = randomUUID()
  const marketingHash = await computeContentHash(MARKETING_V1)
  await dbs.db.insert(policyVersions).values({
    id: marketingV1Id,
    orgId,
    policyId: marketingId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: '마케팅 수신 동의 v1',
    body: MARKETING_V1,
    contentHash: marketingHash,
    status: 'published',
    locale: 'ko',
    effectiveAt: daysAgo(60),
    createdBy: editorId,
    publishedBy: publisherId,
    createdAt: daysAgo(62),
    publishedAt: daysAgo(60),
  })
  await dbs.db
    .update(policies)
    .set({ currentVersionId: marketingV1Id })
    .where(eq(policies.id, marketingId))

  // ── 환불정책: 미게시 초안 ──
  const refundId = randomUUID()
  await dbs.db.insert(policies).values({
    id: refundId,
    orgId,
    slug: 'refund-policy',
    name: '환불·취소 정책',
    type: 'refund',
    jurisdiction: 'KR',
    description: '환불 조건(법무 검토 중)',
  })
  await dbs.db.insert(policyVersions).values({
    id: randomUUID(),
    orgId,
    policyId: refundId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: '환불정책 v1 (초안)',
    body: REFUND_DRAFT,
    status: 'draft',
    locale: 'ko',
    changeSummary: '초안 작성',
    createdBy: editorId,
    createdAt: daysAgo(5),
  })

  // ── 동의 영수증 (다양한 대상/버전) ──
  const subjects = ['user_1001', 'user_1002', 'user_1003', 'user_2050', 'user_2051']
  const receiptRows: (typeof consentReceipts.$inferInsert)[] = []
  // 현재 약관(v2)에 동의한 대상들
  for (const [i, s] of subjects.entries()) {
    receiptRows.push({
      id: randomUUID(),
      orgId,
      policyId: termsId,
      policyVersionId: termsV2Id,
      contentHash: termsV2Hash,
      subjectRef: s,
      decision: 'accepted',
      method: 'checkbox_clickwrap',
      locale: 'ko',
      evidence: {
        ip: `203.0.113.${10 + i}`,
        userAgent: 'Mozilla/5.0',
        buttonLabel: '동의하고 계속',
      },
      createdAt: daysAgo(28 - i),
    })
    receiptRows.push({
      id: randomUUID(),
      orgId,
      policyId: privacyId,
      policyVersionId: privacyV1Id,
      contentHash: privacyHash,
      subjectRef: s,
      decision: 'accepted',
      method: 'checkbox_clickwrap',
      locale: 'ko',
      evidence: { ip: `203.0.113.${10 + i}`, userAgent: 'Mozilla/5.0' },
      createdAt: daysAgo(28 - i),
    })
  }
  // 구버전(v1) 약관에만 동의한 대상 → 재동의 필요 상태 시연
  receiptRows.push({
    id: randomUUID(),
    orgId,
    policyId: termsId,
    policyVersionId: termsV1Id,
    contentHash: termsV1Hash,
    subjectRef: 'user_3090',
    decision: 'accepted',
    method: 'checkbox_clickwrap',
    locale: 'ko',
    evidence: { ip: '203.0.113.90', userAgent: 'Mozilla/5.0' },
    createdAt: daysAgo(120),
  })
  // 마케팅 동의: 일부만
  receiptRows.push({
    id: randomUUID(),
    orgId,
    policyId: marketingId,
    policyVersionId: marketingV1Id,
    contentHash: marketingHash,
    subjectRef: 'user_1001',
    decision: 'accepted',
    method: 'checkbox_clickwrap',
    locale: 'ko',
    createdAt: daysAgo(20),
  })
  receiptRows.push({
    id: randomUUID(),
    orgId,
    policyId: marketingId,
    policyVersionId: marketingV1Id,
    contentHash: marketingHash,
    subjectRef: 'user_1002',
    decision: 'declined',
    method: 'checkbox_clickwrap',
    locale: 'ko',
    createdAt: daysAgo(19),
  })
  await dbs.db.insert(consentReceipts).values(receiptRows)

  // ── 데모 API 키(publishable) ──
  await dbs.db.insert(apiKeys).values({
    id: randomUUID(),
    orgId,
    name: 'Demo (publishable)',
    keyPrefix: DEMO_API_KEY.slice(0, 11),
    keyHash: hashApiKey(DEMO_API_KEY),
    scopes: 'read:current,write:consent',
  })

  // ── 감사 로그 시드 ──
  await dbs.db.insert(auditEvents).values([
    {
      id: randomUUID(),
      orgId,
      actorName: '이게시',
      action: 'version.published',
      targetType: 'policy_version',
      targetId: termsV2Id,
      metadata: { summary: '게시: 이용약관 v2 · 재동의 필요' },
      createdAt: daysAgo(30),
    },
    {
      id: randomUUID(),
      orgId,
      actorName: '이게시',
      action: 'version.published',
      targetType: 'policy_version',
      targetId: privacyV1Id,
      metadata: { summary: '게시: 개인정보처리방침 v1' },
      createdAt: daysAgo(90),
    },
    {
      id: randomUUID(),
      orgId,
      actorName: '김편집',
      action: 'version.created',
      targetType: 'policy_version',
      targetId: refundId,
      metadata: { summary: '초안 작성: 환불·취소 정책 v1' },
      createdAt: daysAgo(5),
    },
  ])

  // ── 대량 샘플: 정책 6종 추가(각 게시 버전) ──
  const seededRefs: { policyId: string; versionId: string; hash: string; slug: string }[] = [
    { policyId: termsId, versionId: termsV2Id, hash: termsV2Hash, slug: 'terms-of-service' },
    { policyId: privacyId, versionId: privacyV1Id, hash: privacyHash, slug: 'privacy-policy' },
    {
      policyId: marketingId,
      versionId: marketingV1Id,
      hash: marketingHash,
      slug: 'marketing-consent',
    },
  ]
  const morePolicies: { slug: string; name: string; type: string }[] = [
    { slug: 'location-info', name: '위치정보 이용약관', type: 'custom' },
    { slug: 'youth-protection', name: '청소년보호정책', type: 'custom' },
    { slug: 'efinance-terms', name: '전자금융거래 이용약관', type: 'terms' },
    { slug: 'third-party-consent', name: '개인정보 제3자 제공 동의', type: 'privacy' },
    { slug: 'cookie-policy', name: '쿠키 정책', type: 'cookie' },
    { slug: 'payment-agency', name: '결제대행 서비스 약관', type: 'terms' },
  ]
  for (const [i, p] of morePolicies.entries()) {
    const pid = randomUUID()
    const vid = randomUUID()
    const body = `${p.name}\n\n제1조 (목적)\n본 ${p.name}은 서비스 이용과 관련한 사항을 정함을 목적으로 합니다.\n\n제2조 (적용범위)\n회사가 제공하는 서비스 전반에 적용됩니다.\n\n제3조 (개정)\n관련 법령 및 내부 정책 변경 시 본 문서는 개정될 수 있으며, 변경 시 사전 고지합니다.`
    const hash = await computeContentHash(body)
    await dbs.db.insert(policies).values({
      id: pid,
      orgId,
      slug: p.slug,
      name: p.name,
      type: p.type,
      jurisdiction: 'KR',
      description: `${p.name} (샘플)`,
    })
    await dbs.db.insert(policyVersions).values({
      id: vid,
      orgId,
      policyId: pid,
      versionNumber: 1,
      versionLabel: 'v1',
      title: `${p.name} v1`,
      body,
      contentHash: hash,
      status: 'published',
      locale: 'ko',
      changeSummary: '최초 제정',
      effectiveAt: daysAgo(70 - i * 5),
      createdBy: editorId,
      publishedBy: publisherId,
      createdAt: daysAgo(75 - i * 5),
      publishedAt: daysAgo(70 - i * 5),
    })
    await dbs.db.update(policies).set({ currentVersionId: vid }).where(eq(policies.id, pid))
    seededRefs.push({ policyId: pid, versionId: vid, hash, slug: p.slug })
  }

  // ── 동적 약관 샘플: {{변수}} 치환 데모 (URL 파라미터·임베드 가이드용) ──
  const dynamicId = randomUUID()
  const dynamicV1Id = randomUUID()
  const DYNAMIC_BODY = `{{company_name}} 서비스 이용약관

제1조 (목적)
이 약관은 {{company_name}}(이하 "회사")가 제공하는 {{service_name}} 서비스의 이용 조건을 규정합니다.

제2조 (계약의 효력)
본 약관은 {{effective_date}}부터 시행됩니다. 문의처: {{contact_email}}.

제3조 (준거법)
본 약관의 해석 및 분쟁은 {{governing_law}}을(를) 준거법으로 합니다.

제4조 (요금제)
이용자는 {{plan}} 요금제 조건에 따라 서비스를 이용합니다.`
  const dynamicHash = await computeContentHash(DYNAMIC_BODY)
  await dbs.db.insert(policies).values({
    id: dynamicId,
    orgId,
    slug: 'service-agreement',
    name: '서비스 이용약관(동적)',
    type: 'terms',
    jurisdiction: 'KR',
    description: 'URL 파라미터·임베드 변수 치환 데모 — {{company_name}} 등',
  })
  await dbs.db.insert(policyVersions).values({
    id: dynamicV1Id,
    orgId,
    policyId: dynamicId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: '서비스 이용약관(동적) v1',
    body: DYNAMIC_BODY,
    contentHash: dynamicHash,
    status: 'published',
    locale: 'ko',
    changeSummary: '최초 제정 · 변수 치환 데모',
    effectiveAt: daysAgo(30),
    createdBy: editorId,
    publishedBy: publisherId,
    createdAt: daysAgo(33),
    publishedAt: daysAgo(30),
  })
  await dbs.db
    .update(policies)
    .set({ currentVersionId: dynamicV1Id })
    .where(eq(policies.id, dynamicId))
  seededRefs.push({
    policyId: dynamicId,
    versionId: dynamicV1Id,
    hash: dynamicHash,
    slug: 'service-agreement',
  })

  // ── 대량 샘플: 멤버 5명 추가 ──
  const moreMembers = [
    { email: 'legal@acme.test', name: '박법무', role: 'admin' },
    { email: 'ops1@acme.test', name: '최운영', role: 'editor' },
    { email: 'ops2@acme.test', name: '정퍼블', role: 'publisher' },
    { email: 'view1@acme.test', name: '한뷰어', role: 'viewer' },
    { email: 'view2@acme.test', name: '오감사', role: 'viewer' },
  ]
  await dbs.db.insert(users).values(
    moreMembers.map((m) => ({
      id: randomUUID(),
      orgId,
      email: m.email,
      name: m.name,
      role: m.role,
      passwordHash: hashPassword('termsdesk-demo'),
    }))
  )

  // ── 대량 샘플: 동의 영수증 ~190건 (다양한 대상/결정/방식/날짜) ──
  const decisions = ['accepted', 'accepted', 'accepted', 'accepted', 'declined', 'withdrawn']
  const methods = ['checkbox_clickwrap', 'api', 'sso', 'import']
  const bulk: (typeof consentReceipts.$inferInsert)[] = []
  for (let s = 0; s < 140; s++) {
    const subj = `user_${4000 + s}`
    const p = seededRefs[s % seededRefs.length]!
    bulk.push({
      id: randomUUID(),
      orgId,
      policyId: p.policyId,
      policyVersionId: p.versionId,
      contentHash: p.hash,
      subjectRef: subj,
      decision: decisions[s % decisions.length]!,
      method: methods[s % methods.length]!,
      locale: 'ko',
      evidence: { ip: `203.0.113.${(s % 250) + 1}`, userAgent: 'Mozilla/5.0' },
      createdAt: daysAgo(s % 60),
    })
    if (s % 3 === 0) {
      const p2 = seededRefs[(s + 1) % seededRefs.length]!
      bulk.push({
        id: randomUUID(),
        orgId,
        policyId: p2.policyId,
        policyVersionId: p2.versionId,
        contentHash: p2.hash,
        subjectRef: subj,
        decision: 'accepted',
        method: 'checkbox_clickwrap',
        locale: 'ko',
        evidence: { ip: `203.0.113.${(s % 250) + 1}` },
        createdAt: daysAgo(s % 60),
      })
    }
  }
  for (let i = 0; i < bulk.length; i += 50) {
    await dbs.db.insert(consentReceipts).values(bulk.slice(i, i + 50))
  }

  // ── 대량 샘플: 감사 로그(추가 게시 이력) ──
  await dbs.db.insert(auditEvents).values(
    seededRefs.slice(3).map((p, i) => ({
      id: randomUUID(),
      orgId,
      actorName: '이게시',
      action: 'version.published',
      targetType: 'policy_version',
      targetId: p.versionId,
      metadata: { summary: `게시: ${p.slug} v1` },
      createdAt: daysAgo(70 - i * 5),
    }))
  )

  // ── 약관 의뢰 중계(Brokerage) 샘플 ──
  await seedBrokerage(dbs, orgId)

  return { seeded: true, orgId }
}

/**
 * 약관 의뢰 중계 데모 데이터 — 의뢰자(Acme)와 별도 조직의 전문가들을 잇는 마켓플레이스를
 * 비어 보이지 않게 채운다. 전문가는 자기 조직 의뢰에 제안할 수 없으므로(서비스 규칙), 의뢰자
 * 조직(Acme)과 분리된 전문가 조직을 만든다. 금액은 메타데이터일 뿐 자금 이동은 없다.
 * 멱등성: serviceRequests 가 이미 있으면 통째로 건너뛴다.
 */
async function seedBrokerage(dbs: DatabaseService, requesterOrgId: string): Promise<void> {
  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(serviceRequests)
  if (Number(existing[0]?.c ?? 0) > 0) return

  // ── 전문가 조직 + 사용자(크로스-조직, 제안 가능) ──
  const providerOrgs = [
    { slug: 'lawfirm-jeong', name: '정&파트너스 법률사무소' },
    { slug: 'privacy-lab', name: '프라이버시랩 컨설팅' },
    { slug: 'global-terms', name: '글로벌텀스 번역' },
  ]
  const orgIdBySlug = new Map<string, string>()
  await dbs.db.insert(organizations).values(
    providerOrgs.map((o) => {
      const id = randomUUID()
      orgIdBySlug.set(o.slug, id)
      return { id, name: o.name, slug: o.slug }
    })
  )

  const providerSeeds = [
    {
      orgSlug: 'lawfirm-jeong',
      email: 'jeong@lawfirm-jeong.test',
      name: '정태현 변호사',
      role: 'owner',
      headline: '약관·개인정보 전문 변호사 · 12년',
      bio: 'SaaS·핀테크 약관과 개인정보처리방침을 200건 이상 자문했습니다. 전자금융거래법·개인정보보호법 검토에 강점이 있습니다.',
      specialties: ['이용약관', '개인정보', '전자금융', '핀테크'],
      jurisdictions: 'KR',
      hourlyRate: 250_000,
      contact: 'jeong@lawfirm-jeong.test',
      verified: true,
      active: true,
      completedCount: 27,
    },
    {
      orgSlug: 'privacy-lab',
      email: 'seo@privacy-lab.test',
      name: '서지은 컨설턴트',
      role: 'owner',
      headline: '개인정보 컴플라이언스 · GDPR/PIPA',
      bio: '국내외 개인정보 규제(PIPA·GDPR) 대응과 동의 설계를 전문으로 합니다. 마케팅 수신 동의·쿠키 정책 정비 경험이 풍부합니다.',
      specialties: ['개인정보', 'GDPR', '쿠키', '마케팅동의'],
      jurisdictions: 'KR,EU',
      hourlyRate: 180_000,
      contact: 'seo@privacy-lab.test',
      verified: true,
      active: true,
      completedCount: 11,
    },
    {
      orgSlug: 'global-terms',
      email: 'lee@global-terms.test',
      name: '이수민 번역가',
      role: 'owner',
      headline: '약관·정책 전문 영한/한영 번역',
      bio: '법률·약관 문서 현지화 8년. 글로벌 출시용 영문 약관과 다국어 개인정보처리방침을 다룹니다. (신규 등록, 검증 대기)',
      specialties: ['번역', '영문약관', '현지화'],
      jurisdictions: 'KR,US',
      hourlyRate: 90_000,
      contact: null,
      verified: false,
      active: true,
      completedCount: 0,
    },
  ]

  const providerUserIdBySlug = new Map<string, string>()
  await dbs.db.insert(users).values(
    providerSeeds.map((p) => {
      const id = randomUUID()
      providerUserIdBySlug.set(p.orgSlug, id)
      return {
        id,
        orgId: orgIdBySlug.get(p.orgSlug)!,
        email: p.email,
        name: p.name,
        role: p.role,
        passwordHash: hashPassword('termsdesk-demo'),
      }
    })
  )

  await dbs.db.insert(providerProfiles).values(
    providerSeeds.map((p, i) => ({
      id: randomUUID(),
      userId: providerUserIdBySlug.get(p.orgSlug)!,
      orgId: orgIdBySlug.get(p.orgSlug)!,
      displayName: p.name,
      headline: p.headline,
      bio: p.bio,
      specialties: p.specialties.join(','),
      jurisdictions: p.jurisdictions,
      hourlyRate: p.hourlyRate,
      contact: p.contact,
      verified: p.verified,
      active: p.active,
      completedCount: p.completedCount,
      createdAt: daysAgo(150 - i * 20),
      updatedAt: daysAgo(2),
    }))
  )

  const jeongUserId = providerUserIdBySlug.get('lawfirm-jeong')!
  const jeongOrgId = orgIdBySlug.get('lawfirm-jeong')!
  const seoUserId = providerUserIdBySlug.get('privacy-lab')!
  const seoOrgId = orgIdBySlug.get('privacy-lab')!
  const leeUserId = providerUserIdBySlug.get('global-terms')!
  const leeOrgId = orgIdBySlug.get('global-terms')!

  // 의뢰자(Acme) 담당자 스냅샷 — 의뢰별로 약간 다른 담당자.
  const requesterName = '관리자'

  // ── 의뢰 6건(상태 다양: open 3 / matched / in_progress / delivered / completed) ──
  type ReqSeed = {
    id: string
    title: string
    description: string
    serviceType: string
    policyType: string
    budgetMin: number | null
    budgetMax: number | null
    deadlineDays: number | null
    status: string
    visibility: string
    assigned?: { userId: string; orgId: string; name: string } | null
    acceptedProposalId?: string | null
    createdDays: number
    closedDays?: number | null
  }

  const matchedProposalId = randomUUID()
  const inProgressProposalId = randomUUID()
  const deliveredProposalId = randomUUID()
  const completedProposalId = randomUUID()

  const requests: ReqSeed[] = [
    {
      id: randomUUID(),
      title: '신규 SaaS 이용약관 초안 작성',
      description:
        '구독형 협업 도구를 출시 예정입니다. 이용약관 초안을 새로 작성해 주실 전문가를 찾습니다. 유료 구독·환불·콘텐츠 관리 조항이 필요합니다.',
      serviceType: 'draft',
      policyType: 'terms',
      budgetMin: 1_500_000,
      budgetMax: 3_000_000,
      deadlineDays: -21,
      status: 'open',
      visibility: 'public',
      createdDays: 4,
    },
    {
      id: randomUUID(),
      title: '개인정보처리방침 GDPR 대응 검토',
      description:
        'EU 사용자 대상 서비스로 확장하면서 기존 개인정보처리방침의 GDPR 적합성 검토가 필요합니다. 부족한 조항과 개선안을 받고 싶습니다.',
      serviceType: 'review',
      policyType: 'privacy',
      budgetMin: 800_000,
      budgetMax: 1_500_000,
      deadlineDays: -14,
      status: 'open',
      visibility: 'public',
      createdDays: 6,
    },
    {
      id: randomUUID(),
      title: '마케팅 수신 동의 문구 정비(비공개)',
      description:
        '이메일·앱 푸시 마케팅 동의 문구를 최신 가이드에 맞게 다듬고 싶습니다. 특정 전문가와 직접 진행 예정이라 비공개로 등록합니다.',
      serviceType: 'update',
      policyType: 'marketing',
      budgetMin: 300_000,
      budgetMax: 600_000,
      deadlineDays: -10,
      status: 'open',
      visibility: 'private',
      createdDays: 3,
    },
    {
      id: randomUUID(),
      title: '전자금융거래 약관 개정',
      description:
        '결제 기능 추가에 따라 전자금융거래 이용약관 개정이 필요합니다. 관련 법령 반영과 조항 보강을 부탁드립니다.',
      serviceType: 'update',
      policyType: 'terms',
      budgetMin: 1_000_000,
      budgetMax: 2_000_000,
      deadlineDays: -7,
      status: 'matched',
      visibility: 'public',
      assigned: { userId: jeongUserId, orgId: jeongOrgId, name: '정태현 변호사' },
      acceptedProposalId: matchedProposalId,
      createdDays: 18,
    },
    {
      id: randomUUID(),
      title: '쿠키 정책 신규 작성 및 배너 문구',
      description:
        '웹사이트 쿠키 정책을 새로 만들고 동의 배너 문구까지 함께 작성하려 합니다. 카테고리별 쿠키 설명이 포함되면 좋겠습니다.',
      serviceType: 'draft',
      policyType: 'cookie',
      budgetMin: 500_000,
      budgetMax: 1_000_000,
      deadlineDays: 3,
      status: 'in_progress',
      visibility: 'public',
      assigned: { userId: seoUserId, orgId: seoOrgId, name: '서지은 컨설턴트' },
      acceptedProposalId: inProgressProposalId,
      createdDays: 25,
    },
    {
      id: randomUUID(),
      title: '영문 이용약관 번역(현지화)',
      description:
        '국문 이용약관을 미국 출시용 영문으로 번역·현지화하려 합니다. 법률 용어 정확도와 자연스러운 표현 모두 중요합니다.',
      serviceType: 'translate',
      policyType: 'terms',
      budgetMin: 700_000,
      budgetMax: 1_200_000,
      deadlineDays: -2,
      status: 'delivered',
      visibility: 'public',
      assigned: { userId: leeUserId, orgId: leeOrgId, name: '이수민 번역가' },
      acceptedProposalId: deliveredProposalId,
      createdDays: 30,
    },
    {
      id: randomUUID(),
      title: '청소년보호정책 신규 작성(완료)',
      description:
        '커뮤니티 기능 도입에 따라 청소년보호정책을 새로 작성했습니다. 전문가 자문으로 마무리한 완료 건입니다.',
      serviceType: 'draft',
      policyType: 'custom',
      budgetMin: 400_000,
      budgetMax: 800_000,
      deadlineDays: -25,
      status: 'completed',
      visibility: 'public',
      assigned: { userId: jeongUserId, orgId: jeongOrgId, name: '정태현 변호사' },
      acceptedProposalId: completedProposalId,
      createdDays: 60,
      closedDays: 20,
    },
  ]

  await dbs.db.insert(serviceRequests).values(
    requests.map((r) => ({
      id: r.id,
      requesterOrgId,
      requesterUserId: null,
      requesterName,
      title: r.title,
      description: r.description,
      serviceType: r.serviceType,
      policyType: r.policyType,
      jurisdiction: 'KR',
      budgetMin: r.budgetMin,
      budgetMax: r.budgetMax,
      deadline: r.deadlineDays == null ? null : daysAgo(r.deadlineDays),
      status: r.status,
      visibility: r.visibility,
      acceptedProposalId: r.acceptedProposalId ?? null,
      assignedProviderUserId: r.assigned?.userId ?? null,
      assignedProviderOrgId: r.assigned?.orgId ?? null,
      assignedProviderName: r.assigned?.name ?? null,
      createdAt: daysAgo(r.createdDays),
      updatedAt: daysAgo(Math.max(0, r.createdDays - 2)),
      closedAt: r.closedDays == null ? null : daysAgo(r.closedDays),
    }))
  )

  // 인덱스 2 = 비공개 open 의뢰(마켓 비노출 · 제안 없음) — 의도적으로 참조하지 않음.
  const openDraft = requests[0]!
  const openGdpr = requests[1]!
  const matchedReq = requests[3]!
  const inProgressReq = requests[4]!
  const deliveredReq = requests[5]!
  const completedReq = requests[6]!

  // ── 제안 ──
  // open 의뢰: 여러 전문가가 검토 대기 제안. 진행/완료 의뢰: 수락(accepted) 제안 1건씩.
  await dbs.db.insert(requestProposals).values([
    // 신규 SaaS 약관 작성 — 제안 3건(검토 대기)
    {
      id: randomUUID(),
      requestId: openDraft.id,
      providerUserId: jeongUserId,
      providerOrgId: jeongOrgId,
      providerName: '정태현 변호사',
      message:
        'SaaS 구독 약관을 다수 작성해 본 경험으로 환불·자동결제·콘텐츠 관리 조항까지 빠짐없이 담아 초안을 작성하겠습니다.',
      quotedAmount: 2_600_000,
      estimatedDays: 14,
      status: 'submitted',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: randomUUID(),
      requestId: openDraft.id,
      providerUserId: seoUserId,
      providerOrgId: seoOrgId,
      providerName: '서지은 컨설턴트',
      message:
        '약관 본문과 함께 개인정보 동의 흐름까지 연계해 검토해 드릴 수 있습니다. 컴플라이언스 관점을 더하겠습니다.',
      quotedAmount: 2_200_000,
      estimatedDays: 18,
      status: 'submitted',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: randomUUID(),
      requestId: openDraft.id,
      providerUserId: leeUserId,
      providerOrgId: leeOrgId,
      providerName: '이수민 번역가',
      message:
        '국문 작성 후 글로벌 출시를 고려하신다면 영문 버전까지 함께 준비해 드릴 수 있습니다.',
      quotedAmount: 1_800_000,
      estimatedDays: 21,
      status: 'submitted',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    // GDPR 검토 — 제안 2건(검토 대기)
    {
      id: randomUUID(),
      requestId: openGdpr.id,
      providerUserId: seoUserId,
      providerOrgId: seoOrgId,
      providerName: '서지은 컨설턴트',
      message:
        'PIPA·GDPR 양쪽을 모두 다뤄 본 경험으로 누락 조항과 개선안을 항목별로 정리해 드리겠습니다.',
      quotedAmount: 1_200_000,
      estimatedDays: 10,
      status: 'submitted',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: randomUUID(),
      requestId: openGdpr.id,
      providerUserId: jeongUserId,
      providerOrgId: jeongOrgId,
      providerName: '정태현 변호사',
      message: '국내 개인정보보호법 관점에서 GDPR 갭 분석과 함께 법적 리스크를 짚어 드리겠습니다.',
      quotedAmount: 1_400_000,
      estimatedDays: 12,
      status: 'submitted',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    // 전자금융 약관 개정(matched) — 수락 제안 + 미선정 1건
    {
      id: matchedProposalId,
      requestId: matchedReq.id,
      providerUserId: jeongUserId,
      providerOrgId: jeongOrgId,
      providerName: '정태현 변호사',
      message:
        '전자금융거래법 개정 사항을 반영해 결제·정산 관련 조항을 보강하겠습니다. 기존 약관 대비 변경 이력도 정리해 드립니다.',
      quotedAmount: 1_700_000,
      estimatedDays: 12,
      status: 'accepted',
      createdAt: daysAgo(16),
      updatedAt: daysAgo(14),
    },
    {
      id: randomUUID(),
      requestId: matchedReq.id,
      providerUserId: seoUserId,
      providerOrgId: seoOrgId,
      providerName: '서지은 컨설턴트',
      message: '결제 데이터 처리와 관련한 개인정보 조항도 함께 점검해 드릴 수 있습니다.',
      quotedAmount: 1_500_000,
      estimatedDays: 15,
      status: 'rejected',
      createdAt: daysAgo(15),
      updatedAt: daysAgo(14),
    },
    // 쿠키 정책(in_progress) — 수락 제안
    {
      id: inProgressProposalId,
      requestId: inProgressReq.id,
      providerUserId: seoUserId,
      providerOrgId: seoOrgId,
      providerName: '서지은 컨설턴트',
      message:
        '쿠키 분류 표와 함께 동의 배너 문구(필수/선택 구분)를 작성하겠습니다. 다국어 확장도 고려해 드립니다.',
      quotedAmount: 800_000,
      estimatedDays: 9,
      status: 'accepted',
      createdAt: daysAgo(23),
      updatedAt: daysAgo(22),
    },
    // 영문 번역(delivered) — 수락 제안
    {
      id: deliveredProposalId,
      requestId: deliveredReq.id,
      providerUserId: leeUserId,
      providerOrgId: leeOrgId,
      providerName: '이수민 번역가',
      message:
        '법률 용어 정확도를 우선하되 영어권 사용자가 읽기 자연스럽도록 현지화하겠습니다. 용어집도 함께 제공합니다.',
      quotedAmount: 950_000,
      estimatedDays: 8,
      status: 'accepted',
      createdAt: daysAgo(28),
      updatedAt: daysAgo(27),
    },
    // 청소년보호정책(completed) — 수락 제안
    {
      id: completedProposalId,
      requestId: completedReq.id,
      providerUserId: jeongUserId,
      providerOrgId: jeongOrgId,
      providerName: '정태현 변호사',
      message: '청소년보호책임자 지정·유해정보 차단 조치를 포함해 표준에 맞게 작성하겠습니다.',
      quotedAmount: 650_000,
      estimatedDays: 7,
      status: 'accepted',
      createdAt: daysAgo(55),
      updatedAt: daysAgo(54),
    },
  ])

  // ── 스레드(진행/완료 의뢰) ──
  await dbs.db.insert(requestMessages).values([
    // 쿠키 정책(in_progress): system → requester → provider
    {
      id: randomUUID(),
      requestId: inProgressReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'system',
      body: '서지은 컨설턴트 전문가의 제안이 수락되어 매칭되었습니다.',
      createdAt: daysAgo(22),
    },
    {
      id: randomUUID(),
      requestId: inProgressReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'message',
      body: '안녕하세요. 현재 사용 중인 쿠키 목록을 정리해서 공유드릴게요. 카테고리는 필수/분석/마케팅으로 나누면 될까요?',
      createdAt: daysAgo(21),
    },
    {
      id: randomUUID(),
      requestId: inProgressReq.id,
      authorUserId: seoUserId,
      authorName: '서지은 컨설턴트',
      authorRole: 'provider',
      kind: 'message',
      body: '네, 그 분류로 진행하겠습니다. 배너 문구는 필수/선택을 명확히 구분한 초안을 먼저 드리겠습니다.',
      createdAt: daysAgo(20),
    },
    // 영문 번역(delivered): system → message ×2 → delivery
    {
      id: randomUUID(),
      requestId: deliveredReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'system',
      body: '이수민 번역가 전문가의 제안이 수락되어 매칭되었습니다.',
      createdAt: daysAgo(27),
    },
    {
      id: randomUUID(),
      requestId: deliveredReq.id,
      authorUserId: leeUserId,
      authorName: '이수민 번역가',
      authorRole: 'provider',
      kind: 'message',
      body: '국문 약관 잘 받았습니다. 용어 통일을 위해 핵심 용어집을 먼저 정리해 확인 요청드리겠습니다.',
      createdAt: daysAgo(24),
    },
    {
      id: randomUUID(),
      requestId: deliveredReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'message',
      body: '용어집 확인했습니다. 표현 방향 좋습니다. 그대로 진행 부탁드려요.',
      createdAt: daysAgo(23),
    },
    {
      id: randomUUID(),
      requestId: deliveredReq.id,
      authorUserId: leeUserId,
      authorName: '이수민 번역가',
      authorRole: 'provider',
      kind: 'delivery',
      body: '영문 이용약관 번역본과 용어집을 제출합니다. 검수 후 수정 의견 주시면 반영하겠습니다.',
      createdAt: daysAgo(2),
    },
    // 청소년보호정책(completed): system → message → delivery → message
    {
      id: randomUUID(),
      requestId: completedReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'system',
      body: '정태현 변호사 전문가의 제안이 수락되어 매칭되었습니다.',
      createdAt: daysAgo(54),
    },
    {
      id: randomUUID(),
      requestId: completedReq.id,
      authorUserId: jeongUserId,
      authorName: '정태현 변호사',
      authorRole: 'provider',
      kind: 'delivery',
      body: '청소년보호정책 최종본을 제출합니다. 청소년보호책임자 지정 및 신고 절차 조항을 포함했습니다.',
      createdAt: daysAgo(22),
    },
    {
      id: randomUUID(),
      requestId: completedReq.id,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'message',
      body: '꼼꼼하게 작성해 주셔서 감사합니다. 검수 완료하고 마무리하겠습니다.',
      createdAt: daysAgo(20),
    },
  ])

  // ── 감사 로그(중계 활동) ──
  await dbs.db.insert(auditEvents).values([
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: requesterName,
      action: 'request.created',
      targetType: 'service_request',
      targetId: matchedReq.id,
      metadata: { summary: `의뢰 등록: ${matchedReq.title} (${matchedReq.serviceType})` },
      createdAt: daysAgo(18),
    },
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: requesterName,
      action: 'proposal.accepted',
      targetType: 'service_request',
      targetId: matchedReq.id,
      metadata: { summary: `제안 수락·매칭: ${matchedReq.title} → 정태현 변호사` },
      createdAt: daysAgo(14),
    },
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: '이수민 번역가',
      action: 'request.delivered',
      targetType: 'service_request',
      targetId: deliveredReq.id,
      metadata: { summary: `산출물 제출: ${deliveredReq.title} (전문가 이수민 번역가)` },
      createdAt: daysAgo(2),
    },
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: requesterName,
      action: 'request.completed',
      targetType: 'service_request',
      targetId: completedReq.id,
      metadata: { summary: `의뢰 완료: ${completedReq.title}` },
      createdAt: daysAgo(20),
    },
  ])
}
