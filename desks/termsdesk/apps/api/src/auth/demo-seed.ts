import { computeContentHash } from '@termsdesk/shared'
import { and, eq } from 'drizzle-orm'

import { hashApiKey, hashPassword, randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
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
} from '../db/schema'
import { DEMO_API_KEY } from '../db/seed-data'

const DEMO_SLUG = 'demo'
const DEMO_USER_EMAIL = 'guest@demo.termsdesk'

const TERMS_V1 = `제1조 (목적)
이 약관은 데모컴퍼니(이하 "회사")가 제공하는 서비스의 이용 조건을 규정합니다.

제2조 (서비스의 제공)
회사는 연중무휴 서비스를 제공함을 원칙으로 합니다.`

const TERMS_V2 = `제1조 (목적)
이 약관은 데모컴퍼니(이하 "회사")가 제공하는 서비스의 이용과 관련하여 회사와 이용자의 권리·의무를 규정합니다.

제2조 (서비스의 제공)
회사는 연중무휴 1일 24시간 서비스를 제공함을 원칙으로 하며, 점검 시 일시 중단될 수 있습니다.

제3조 (이용자의 의무)
이용자는 관계 법령과 이 약관을 준수하여야 합니다.`

const PRIVACY = `제1조 (수집 항목)
회사는 회원가입 시 이메일과 서비스 이용기록을 수집합니다.

제2조 (보유 기간)
수집된 개인정보는 회원 탈퇴 시까지 보유하며, 관계 법령에 따라 일정 기간 보관할 수 있습니다.`

const MARKETING = `마케팅 정보 수신 동의(선택)

회사가 제공하는 이벤트·혜택 등 마케팅 정보를 이메일로 수신하는 데 동의합니다. 동의하지 않아도 서비스 이용에는 제한이 없습니다.`

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

/**
 * 로그인 없이 둘러볼 수 있는 **격리된 데모 조직**을 보장(idempotent). 비어 있으면 샘플
 * 정책·버전(타임라인/diff 용 v1·v2)·동의 영수증·감사 로그를 채웁니다. 게스트는 viewer(읽기전용).
 * 반환: { orgId, userId } — 게스트 세션 발급용.
 */
export async function ensureDemoOrg(
  dbs: DatabaseService
): Promise<{ orgId: string; userId: string }> {
  // 조직 보장
  let org = (
    await dbs.db.select().from(organizations).where(eq(organizations.slug, DEMO_SLUG)).limit(1)
  )[0]
  if (!org) {
    const id = randomUUID()
    await dbs.db.insert(organizations).values({ id, name: 'TermsDesk 데모', slug: DEMO_SLUG })
    org = (await dbs.db.select().from(organizations).where(eq(organizations.id, id)).limit(1))[0]!
  }
  const orgId = org.id

  // 게스트(viewer) 사용자 보장
  let guest = (
    await dbs.db.select().from(users).where(eq(users.email, DEMO_USER_EMAIL)).limit(1)
  )[0]
  if (!guest) {
    const id = randomUUID()
    await dbs.db.insert(users).values({
      id,
      orgId,
      email: DEMO_USER_EMAIL,
      name: '게스트',
      role: 'viewer',
      provider: 'demo',
    })
    guest = (await dbs.db.select().from(users).where(eq(users.id, id)).limit(1))[0]!
  }

  // 라이브 데모(/app/demo)용 publishable 데모 API 키를 데모 조직에 보장(항상·멱등).
  const keyHash = hashApiKey(DEMO_API_KEY)
  const existingKey = await dbs.db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)
  if (!existingKey[0]) {
    await dbs.db.insert(apiKeys).values({
      id: randomUUID(),
      orgId,
      name: 'Demo (publishable)',
      keyPrefix: DEMO_API_KEY.slice(0, 11),
      keyHash,
      scopes: 'read:current,write:consent,read:consent',
    })
  }

  // 이미 콘텐츠가 있으면 그대로 사용 — 단, 브로커리지 시드는 별도(나중에 추가된 기능이라
  // 기존 데모 조직엔 없을 수 있다). seedDemoBrokerage 는 자체 멱등이므로 안전하게 호출.
  const has = await dbs.db
    .select({ id: policies.id })
    .from(policies)
    .where(eq(policies.orgId, orgId))
    .limit(1)
  if (has[0]) {
    await seedDemoBrokerage(dbs, orgId, guest.name)
    return { orgId, userId: guest.id }
  }

  // ── 샘플 콘텐츠 시드 ──
  const editorId = guest.id
  const mk = async (
    slug: string,
    name: string,
    type: string,
    versions: { label: string; body: string; status: 'published' | 'archived'; effDays: number }[]
  ) => {
    const pid = randomUUID()
    await dbs.db.insert(policies).values({
      id: pid,
      orgId,
      slug,
      name,
      type,
      jurisdiction: 'KR',
      description: `${name} (데모)`,
    })
    let currentId: string | null = null
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i]!
      const vid = randomUUID()
      const hash = await computeContentHash(v.body)
      await dbs.db.insert(policyVersions).values({
        id: vid,
        orgId,
        policyId: pid,
        versionNumber: i + 1,
        versionLabel: v.label,
        title: `${name} ${v.label}`,
        body: v.body,
        contentHash: hash,
        status: v.status,
        locale: 'ko',
        changeSummary: i === 0 ? '최초 제정' : '조항 보강·표현 명확화',
        effectiveAt: daysAgo(v.effDays),
        createdBy: editorId,
        publishedBy: editorId,
        createdAt: daysAgo(v.effDays + 3),
        publishedAt: daysAgo(v.effDays),
      })
      if (v.status === 'published') currentId = vid
    }
    if (currentId)
      await dbs.db.update(policies).set({ currentVersionId: currentId }).where(eq(policies.id, pid))
    return { pid, currentId }
  }

  const terms = await mk('terms-of-service', '이용약관', 'terms', [
    { label: 'v1', body: TERMS_V1, status: 'archived', effDays: 120 },
    { label: 'v2', body: TERMS_V2, status: 'published', effDays: 20 },
  ])
  const privacy = await mk('privacy-policy', '개인정보처리방침', 'privacy', [
    { label: 'v1', body: PRIVACY, status: 'published', effDays: 60 },
  ])
  await mk('marketing-consent', '마케팅 수신 동의', 'marketing', [
    { label: 'v1', body: MARKETING, status: 'published', effDays: 45 },
  ])

  // 약관 의뢰 중계(Brokerage) 데모 샘플 — 게스트(의뢰자 조직)가 둘러볼 수 있게.
  await seedDemoBrokerage(dbs, orgId, guest.name)

  // 동의 영수증 ~24건
  const termsHash = await computeContentHash(TERMS_V2)
  const privacyHash = await computeContentHash(PRIVACY)
  const decisions = ['accepted', 'accepted', 'accepted', 'accepted', 'declined', 'withdrawn']
  const methods = ['checkbox_clickwrap', 'api', 'sso', 'import']
  const rows: (typeof consentReceipts.$inferInsert)[] = []
  for (let i = 0; i < 24; i++) {
    const useTerms = i % 2 === 0
    rows.push({
      id: randomUUID(),
      orgId,
      policyId: useTerms ? terms.pid : privacy.pid,
      policyVersionId: (useTerms ? terms.currentId : privacy.currentId)!,
      contentHash: useTerms ? termsHash : privacyHash,
      subjectRef: `user_${1000 + i}`,
      decision: decisions[i % decisions.length]!,
      method: methods[i % methods.length]!,
      locale: 'ko',
      evidence: { ip: `203.0.113.${10 + i}`, userAgent: 'demo' },
      createdAt: daysAgo(i),
    })
  }
  await dbs.db.insert(consentReceipts).values(rows)

  // 감사 로그 몇 건
  await dbs.db.insert(auditEvents).values([
    {
      id: randomUUID(),
      orgId,
      actorName: '게스트',
      action: 'policy.created',
      targetType: 'policy',
      targetId: terms.pid,
      metadata: { summary: '정책 생성: 이용약관' },
      createdAt: daysAgo(123),
    },
    {
      id: randomUUID(),
      orgId,
      actorName: '게스트',
      action: 'version.published',
      targetType: 'policy_version',
      targetId: terms.currentId,
      metadata: { summary: '게시: 이용약관 v2 · 재동의 필요' },
      createdAt: daysAgo(20),
    },
    {
      id: randomUUID(),
      orgId,
      actorName: '게스트',
      action: 'version.published',
      targetType: 'policy_version',
      targetId: privacy.currentId,
      metadata: { summary: '게시: 개인정보처리방침 v1' },
      createdAt: daysAgo(60),
    },
  ])

  return { orgId, userId: guest.id }
}

/**
 * 데모 조직용 약관 의뢰 중계 샘플(멱등). 데모 조직을 의뢰자로 두고, 별도의 데모 전문가 조직
 * (slug 'demo-*')을 만들어 크로스-조직 제안을 시연한다(전문가는 자기 조직 의뢰에 제안 불가).
 * 데모 격리: 모든 행이 데모 조직 또는 demo-* 전문가 조직에 귀속된다.
 * 멱등성: 데모 조직에 의뢰가 이미 있으면 통째로 건너뛴다.
 */
async function seedDemoBrokerage(
  dbs: DatabaseService,
  requesterOrgId: string,
  requesterName: string
): Promise<void> {
  const existing = await dbs.db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(eq(serviceRequests.requesterOrgId, requesterOrgId))
    .limit(1)
  if (existing[0]) return

  // ── 데모 전문가 조직 + 사용자(멱등 보장) ──
  const ensureProviderOrg = async (slug: string, name: string): Promise<string> => {
    const found = (
      await dbs.db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1)
    )[0]
    if (found) return found.id
    const id = randomUUID()
    await dbs.db.insert(organizations).values({ id, name, slug })
    return id
  }
  const ensureProviderUser = async (
    orgId: string,
    email: string,
    name: string
  ): Promise<string> => {
    const found = (
      await dbs.db
        .select()
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.email, email)))
        .limit(1)
    )[0]
    if (found) return found.id
    const id = randomUUID()
    await dbs.db.insert(users).values({
      id,
      orgId,
      email,
      name,
      role: 'owner',
      passwordHash: hashPassword('termsdesk-demo'),
    })
    return id
  }

  const expertOrgId = await ensureProviderOrg('demo-lawfirm', '데모 법률사무소')
  const expertUserId = await ensureProviderUser(
    expertOrgId,
    'expert@demo-lawfirm.test',
    '데모 전문가'
  )
  const transOrgId = await ensureProviderOrg('demo-translate', '데모 번역')
  const transUserId = await ensureProviderUser(
    transOrgId,
    'translator@demo-translate.test',
    '데모 번역가'
  )

  await dbs.db.insert(providerProfiles).values([
    {
      id: randomUUID(),
      userId: expertUserId,
      orgId: expertOrgId,
      displayName: '데모 전문가',
      headline: '약관·개인정보 전문 (검증)',
      bio: 'SaaS 약관과 개인정보처리방침 자문을 전문으로 하는 데모 전문가입니다.',
      specialties: '이용약관,개인정보,핀테크',
      jurisdictions: 'KR',
      hourlyRate: 200_000,
      contact: 'expert@demo-lawfirm.test',
      verified: true,
      active: true,
      completedCount: 8,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(2),
    },
    {
      id: randomUUID(),
      userId: transUserId,
      orgId: transOrgId,
      displayName: '데모 번역가',
      headline: '약관 영한/한영 번역',
      bio: '법률·약관 문서 현지화를 담당하는 데모 번역 전문가입니다.',
      specialties: '번역,영문약관,현지화',
      jurisdictions: 'KR,US',
      hourlyRate: 90_000,
      contact: null,
      verified: false,
      active: true,
      completedCount: 1,
      createdAt: daysAgo(80),
      updatedAt: daysAgo(5),
    },
  ])

  // ── 의뢰 4건(open 2 / in_progress 1 / completed 1) ──
  const openTermsId = randomUUID()
  const openPrivacyId = randomUUID()
  const inProgressId = randomUUID()
  const completedId = randomUUID()
  const inProgressProposalId = randomUUID()
  const completedProposalId = randomUUID()

  await dbs.db.insert(serviceRequests).values([
    {
      id: openTermsId,
      requesterOrgId,
      requesterUserId: null,
      requesterName,
      title: '신규 이용약관 초안 작성',
      description:
        '구독형 서비스 출시를 앞두고 이용약관 초안을 새로 작성해 주실 전문가를 찾습니다.',
      serviceType: 'draft',
      policyType: 'terms',
      jurisdiction: 'KR',
      budgetMin: 1_000_000,
      budgetMax: 2_000_000,
      deadline: daysAgo(-18),
      status: 'open',
      visibility: 'public',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: openPrivacyId,
      requesterOrgId,
      requesterUserId: null,
      requesterName,
      title: '개인정보처리방침 검토',
      description: '현재 사용 중인 개인정보처리방침의 보완점을 검토받고 싶습니다.',
      serviceType: 'review',
      policyType: 'privacy',
      jurisdiction: 'KR',
      budgetMin: 500_000,
      budgetMax: 1_000_000,
      deadline: daysAgo(-12),
      status: 'open',
      visibility: 'public',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: inProgressId,
      requesterOrgId,
      requesterUserId: null,
      requesterName,
      title: '마케팅 수신 동의 문구 개정',
      description: '마케팅 동의 문구를 최신 가이드에 맞춰 다듬는 작업입니다.',
      serviceType: 'update',
      policyType: 'marketing',
      jurisdiction: 'KR',
      budgetMin: 300_000,
      budgetMax: 600_000,
      deadline: daysAgo(-5),
      status: 'in_progress',
      visibility: 'public',
      acceptedProposalId: inProgressProposalId,
      assignedProviderUserId: expertUserId,
      assignedProviderOrgId: expertOrgId,
      assignedProviderName: '데모 전문가',
      createdAt: daysAgo(15),
      updatedAt: daysAgo(12),
    },
    {
      id: completedId,
      requesterOrgId,
      requesterUserId: null,
      requesterName,
      title: '영문 이용약관 번역(완료)',
      description: '국문 이용약관을 영문으로 번역·현지화한 완료 건입니다.',
      serviceType: 'translate',
      policyType: 'terms',
      jurisdiction: 'KR',
      budgetMin: 600_000,
      budgetMax: 1_000_000,
      deadline: daysAgo(5),
      status: 'completed',
      visibility: 'public',
      acceptedProposalId: completedProposalId,
      assignedProviderUserId: transUserId,
      assignedProviderOrgId: transOrgId,
      assignedProviderName: '데모 번역가',
      createdAt: daysAgo(40),
      updatedAt: daysAgo(10),
      closedAt: daysAgo(10),
    },
  ])

  // ── 제안 ──
  await dbs.db.insert(requestProposals).values([
    {
      id: randomUUID(),
      requestId: openTermsId,
      providerUserId: expertUserId,
      providerOrgId: expertOrgId,
      providerName: '데모 전문가',
      message: '구독·환불·콘텐츠 관리 조항을 포함해 이용약관 초안을 작성하겠습니다.',
      quotedAmount: 1_700_000,
      estimatedDays: 12,
      status: 'submitted',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: randomUUID(),
      requestId: openPrivacyId,
      providerUserId: expertUserId,
      providerOrgId: expertOrgId,
      providerName: '데모 전문가',
      message: '개인정보보호법 관점에서 누락 조항과 개선안을 정리해 드리겠습니다.',
      quotedAmount: 800_000,
      estimatedDays: 7,
      status: 'submitted',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      id: inProgressProposalId,
      requestId: inProgressId,
      providerUserId: expertUserId,
      providerOrgId: expertOrgId,
      providerName: '데모 전문가',
      message: '최신 가이드에 맞춰 마케팅 동의 문구를 다듬겠습니다.',
      quotedAmount: 500_000,
      estimatedDays: 5,
      status: 'accepted',
      createdAt: daysAgo(14),
      updatedAt: daysAgo(12),
    },
    {
      id: completedProposalId,
      requestId: completedId,
      providerUserId: transUserId,
      providerOrgId: transOrgId,
      providerName: '데모 번역가',
      message: '법률 용어 정확도를 우선해 영문으로 자연스럽게 현지화하겠습니다.',
      quotedAmount: 850_000,
      estimatedDays: 8,
      status: 'accepted',
      createdAt: daysAgo(38),
      updatedAt: daysAgo(36),
    },
  ])

  // ── 스레드(진행/완료) ──
  await dbs.db.insert(requestMessages).values([
    {
      id: randomUUID(),
      requestId: inProgressId,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'system',
      body: '데모 전문가 전문가의 제안이 수락되어 매칭되었습니다.',
      createdAt: daysAgo(12),
    },
    {
      id: randomUUID(),
      requestId: inProgressId,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'message',
      body: '현재 문구를 공유드립니다. 수신 거부 안내를 좀 더 명확히 했으면 합니다.',
      createdAt: daysAgo(11),
    },
    {
      id: randomUUID(),
      requestId: inProgressId,
      authorUserId: expertUserId,
      authorName: '데모 전문가',
      authorRole: 'provider',
      kind: 'message',
      body: '네, 수신 동의·철회 방법을 분리해 명확히 드러내는 방향으로 초안을 준비하겠습니다.',
      createdAt: daysAgo(10),
    },
    {
      id: randomUUID(),
      requestId: completedId,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'system',
      body: '데모 번역가 전문가의 제안이 수락되어 매칭되었습니다.',
      createdAt: daysAgo(36),
    },
    {
      id: randomUUID(),
      requestId: completedId,
      authorUserId: transUserId,
      authorName: '데모 번역가',
      authorRole: 'provider',
      kind: 'delivery',
      body: '영문 이용약관 번역본을 제출합니다. 검수 의견 주시면 반영하겠습니다.',
      createdAt: daysAgo(12),
    },
    {
      id: randomUUID(),
      requestId: completedId,
      authorUserId: null,
      authorName: requesterName,
      authorRole: 'requester',
      kind: 'message',
      body: '번역 품질 좋습니다. 검수 완료하고 마무리하겠습니다. 감사합니다.',
      createdAt: daysAgo(10),
    },
  ])

  // ── 감사 로그(중계 활동) ──
  await dbs.db.insert(auditEvents).values([
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: requesterName,
      action: 'proposal.accepted',
      targetType: 'service_request',
      targetId: inProgressId,
      metadata: { summary: '제안 수락·매칭: 마케팅 수신 동의 문구 개정 → 데모 전문가' },
      createdAt: daysAgo(12),
    },
    {
      id: randomUUID(),
      orgId: requesterOrgId,
      actorName: requesterName,
      action: 'request.completed',
      targetType: 'service_request',
      targetId: completedId,
      metadata: { summary: '의뢰 완료: 영문 이용약관 번역(완료)' },
      createdAt: daysAgo(10),
    },
  ])
}
