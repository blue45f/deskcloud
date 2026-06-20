import { sql } from 'drizzle-orm'

import { hashSecretKey } from '../common/keys'

import { DatabaseService } from './database.service'
import { forbiddenRules, moderationLogs, reports, tenants } from './schema'

import type {
  MatchedRule,
  ReportStatus,
  RuleAction,
  RuleKind,
  Verdict,
} from '@moderationdesk/shared'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 테넌트 — 가입 없이 검사·어드민을 바로 체험할 수 있게 고정 키를 사용한다. */
const DEMO_PUBLISHABLE_KEY = 'pk_demo'
const DEMO_SECRET_KEY = 'sk_demo'

interface SeedRule {
  pattern: string
  kind: RuleKind
  action: RuleAction
  label: string
  enabled?: boolean
}

/** 데모 금칙 규칙 — 종류·액션을 골고루 섞어 검사 결과가 다양하게 나오도록. */
const DEMO_RULES: SeedRule[] = [
  { pattern: 'spam', kind: 'substring', action: 'block', label: '스팸 키워드' },
  { pattern: 'example.spam', kind: 'substring', action: 'block', label: '스팸 도메인' },
  { pattern: '\\b(buy|cheap)\\s+now\\b', kind: 'regex', action: 'flag', label: '광고성 문구' },
  { pattern: 'idiot', kind: 'substring', action: 'review', label: '욕설(검토)' },
  { pattern: 'banned-phrase', kind: 'exact', action: 'block', label: '완전일치 금칙' },
  { pattern: 'lottery', kind: 'substring', action: 'flag', label: '복권/사행성', enabled: false },
]

interface SeedReport {
  subjectType: string
  subjectId: string
  reason: string
  reporterId?: string
  status: ReportStatus
  notes?: string
  daysAgo: number
}

const DEMO_REPORTS: SeedReport[] = [
  {
    subjectType: 'comment',
    subjectId: 'c_1001',
    reason: '욕설과 인신공격이 포함되어 있습니다.',
    reporterId: 'user_42',
    status: 'open',
    daysAgo: 1,
  },
  {
    subjectType: 'comment',
    subjectId: 'c_1002',
    reason: '광고성 스팸으로 보입니다.',
    status: 'reviewing',
    notes: '담당자 확인 중',
    daysAgo: 2,
  },
  {
    subjectType: 'post',
    subjectId: 'p_55',
    reason: '저작권 침해 소지가 있습니다.',
    reporterId: 'user_7',
    status: 'resolved',
    notes: '게시물 비공개 처리 완료',
    daysAgo: 5,
  },
  {
    subjectType: 'profile',
    subjectId: 'u_900',
    reason: '사칭 계정 같습니다.',
    status: 'dismissed',
    notes: '확인 결과 본인 계정',
    daysAgo: 8,
  },
]

interface SeedLog {
  text: string
  verdict: Verdict
  matchedRules: MatchedRule[]
  aiScore?: number
  source?: string
  daysAgo: number
}

const DEMO_LOGS: SeedLog[] = [
  { text: 'hello, great article!', verdict: 'allow', matchedRules: [], source: 'web', daysAgo: 0 },
  {
    text: 'this is spam, visit example.spam',
    verdict: 'block',
    matchedRules: [
      { id: 'seed', pattern: 'spam', kind: 'substring', action: 'block' },
      { id: 'seed', pattern: 'example.spam', kind: 'substring', action: 'block' },
    ],
    source: 'web',
    daysAgo: 0,
  },
  {
    text: 'buy now and save big',
    verdict: 'flag',
    matchedRules: [
      { id: 'seed', pattern: '\\b(buy|cheap)\\s+now\\b', kind: 'regex', action: 'flag' },
    ],
    source: 'api',
    daysAgo: 1,
  },
  {
    text: 'you are an idiot honestly',
    verdict: 'flag',
    matchedRules: [{ id: 'seed', pattern: 'idiot', kind: 'substring', action: 'review' }],
    aiScore: 0.72,
    source: 'web',
    daysAgo: 2,
  },
  {
    text: 'looks good to me',
    verdict: 'allow',
    matchedRules: [],
    aiScore: 0.05,
    source: 'web',
    daysAgo: 3,
  },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 규칙 + 신고/로그를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const insertedTenant = await dbs.db
    .insert(tenants)
    .values({
      name: 'Demo Co.',
      slug: 'demo',
      publishableKey: DEMO_PUBLISHABLE_KEY,
      secretKeyHash: hashSecretKey(DEMO_SECRET_KEY),
      corsOrigins: ['*'],
      plan: 'pro',
      usageCount: DEMO_LOGS.length,
    })
    .returning()
  const tenant = insertedTenant[0]!

  await dbs.db.insert(forbiddenRules).values(
    DEMO_RULES.map((r) => ({
      tenantId: tenant.id,
      pattern: r.pattern,
      kind: r.kind,
      action: r.action,
      label: r.label,
      enabled: r.enabled ?? true,
    }))
  )

  await dbs.db.insert(reports).values(
    DEMO_REPORTS.map((r) => ({
      tenantId: tenant.id,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      reason: r.reason,
      reporterId: r.reporterId ?? null,
      status: r.status,
      notes: r.notes ?? null,
      createdAt: daysAgo(r.daysAgo),
    }))
  )

  await dbs.db.insert(moderationLogs).values(
    DEMO_LOGS.map((l) => ({
      tenantId: tenant.id,
      text: l.text,
      verdict: l.verdict,
      matchedRules: l.matchedRules,
      aiScore: l.aiScore ?? null,
      source: l.source ?? 'seed',
      createdAt: daysAgo(l.daysAgo),
    }))
  )

  return { seeded: true }
}
