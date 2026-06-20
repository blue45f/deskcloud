import { eq, sql } from 'drizzle-orm'

import { DatabaseService } from './database.service'
import { surveyResponses, surveys } from './schema'

import type { ResponseMeta, SurveyQuestion } from '@surveydesk/shared'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 설문 정의(앱별). 실제 형제 앱 appId 를 사용해 통합 데모가 자연스럽게 보이도록. */
interface DemoSurvey {
  appId: string
  title: string
  intro: string
  questions: SurveyQuestion[]
}

const DEMO_SURVEYS: DemoSurvey[] = [
  {
    appId: 'demo',
    title: '데모 앱은 어떠셨나요?',
    intro: '몇 가지 짧은 질문에 답해 주시면 서비스 개선에 큰 도움이 됩니다.',
    questions: [
      { id: 'q_rating', type: 'rating', label: '전반적인 만족도', required: true },
      { id: 'q_nps', type: 'nps', label: '동료에게 추천할 의향이 있으신가요?', required: true },
      {
        id: 'q_role',
        type: 'single_choice',
        label: '어떤 용도로 사용하시나요?',
        required: false,
        options: [
          { value: 'personal', label: '개인' },
          { value: 'team', label: '팀/업무' },
          { value: 'eval', label: '평가/테스트' },
        ],
      },
      {
        id: 'q_likes',
        type: 'multi_choice',
        label: '마음에 든 점(복수 선택)',
        required: false,
        options: [
          { value: 'speed', label: '속도' },
          { value: 'design', label: '디자인' },
          { value: 'ease', label: '사용 편의성' },
          { value: 'price', label: '가격' },
        ],
      },
      { id: 'q_text', type: 'text', label: '한 마디 남겨 주세요', required: false, variant: 'long' },
    ],
  },
  {
    appId: 'offhours',
    title: 'OffHours 피드백',
    intro: '서비스 경험을 알려 주세요. 30초면 충분합니다.',
    questions: [
      { id: 'q_rating', type: 'rating', label: '예약 경험 만족도', required: true },
      { id: 'q_nps', type: 'nps', label: '추천 의향', required: true },
      {
        id: 'q_channel',
        type: 'single_choice',
        label: '어떻게 알게 되셨나요?',
        required: false,
        options: [
          { value: 'search', label: '검색' },
          { value: 'sns', label: 'SNS' },
          { value: 'referral', label: '지인 추천' },
        ],
      },
      { id: 'q_improve', type: 'text', label: '개선되었으면 하는 점', required: false, variant: 'long' },
    ],
  },
]

/** 자유서술 샘플 풀. */
const TEXT_SAMPLES = [
  '전반적으로 만족스럽습니다. 계속 쓸게요.',
  '속도가 빨라서 좋아요.',
  '디자인이 깔끔합니다.',
  '가끔 버튼 위치가 헷갈려요.',
  '모바일에서도 잘 동작하면 좋겠습니다.',
  '가격이 조금 부담됩니다.',
  '온보딩이 친절해서 금방 적응했어요.',
  '알림이 너무 잦은 것 같아요.',
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 설문이 하나도 없을 때만 데모 설문 + 샘플 응답을 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(surveys)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  for (const def of DEMO_SURVEYS) {
    // 설문 버전 1(활성)
    await dbs.db.insert(surveys).values({
      appId: def.appId,
      version: 1,
      title: def.title,
      intro: def.intro,
      questions: def.questions,
      active: true,
    })

    // 샘플 응답 — 집계가 비지 않도록 다양한 값으로 ~24건.
    const rows: (typeof surveyResponses.$inferInsert)[] = []
    const npsPool = [10, 9, 9, 8, 7, 6, 9, 10, 5, 9, 8, 10]
    const ratingPool = [5, 4, 5, 3, 4, 5, 2, 4, 5, 3, 4, 5]
    for (let i = 0; i < 24; i += 1) {
      const answers: Record<string, unknown> = {}
      for (const q of def.questions) {
        switch (q.type) {
          case 'rating':
            answers[q.id] = ratingPool[i % ratingPool.length]
            break
          case 'nps':
            answers[q.id] = npsPool[i % npsPool.length]
            break
          case 'single_choice':
            answers[q.id] = q.options![i % q.options!.length]!.value
            break
          case 'multi_choice': {
            const picks = q.options!.filter((_, idx) => (i + idx) % 2 === 0).map((o) => o.value)
            answers[q.id] = picks.length > 0 ? picks : [q.options![0]!.value]
            break
          }
          case 'text':
            // 약 1/2 정도만 자유서술을 남김
            if (i % 2 === 0) answers[q.id] = TEXT_SAMPLES[i % TEXT_SAMPLES.length]
            break
          default:
            break
        }
      }
      const meta: ResponseMeta = {
        pageUrl: `https://${def.appId}.example/app`,
        userAgent: 'Mozilla/5.0 (demo seed)',
        referrer: i % 3 === 0 ? 'https://www.google.com/' : undefined,
      }
      rows.push({
        appId: def.appId,
        surveyVersion: 1,
        answers,
        respondentEmail: i % 4 === 0 ? `user${i}@example.com` : null,
        respondentUserId: i % 4 === 0 ? `user_${1000 + i}` : null,
        meta,
        createdAt: daysAgo(i % 30),
      })
    }
    await dbs.db.insert(surveyResponses).values(rows)
  }

  return { seeded: true }
}

/** 활성 설문이 있는지(테스트·헬스 용). */
export async function hasActiveSurvey(dbs: DatabaseService, appId: string): Promise<boolean> {
  const r = await dbs.db
    .select({ id: surveys.id })
    .from(surveys)
    .where(eq(surveys.appId, appId))
    .limit(1)
  return r.length > 0
}
