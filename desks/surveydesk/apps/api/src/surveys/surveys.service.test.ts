import { PGlite } from '@electric-sql/pglite'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { SurveysService } from './surveys.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { CreateSurveyInput } from '@surveydesk/shared'

/** PGlite 인메모리 DB + 부팅 마이그레이션을 적용한 가짜 DatabaseService. */
async function makeDb(): Promise<{ dbs: DatabaseService; service: SurveysService }> {
  const client = await PGlite.create() // 인메모리(경로 미지정)
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, service: new SurveysService(dbs) }
}

const baseSurvey: CreateSurveyInput = {
  title: '테스트 설문',
  intro: '안내',
  questions: [
    { id: 'q_rating', type: 'rating', label: '만족도', required: true },
    { id: 'q_nps', type: 'nps', label: '추천', required: true },
    {
      id: 'q_pick',
      type: 'single_choice',
      label: '플랜',
      required: false,
      options: [
        { value: 'free', label: '무료' },
        { value: 'pro', label: '프로' },
      ],
    },
    { id: 'q_text', type: 'text', label: '메모', required: false, variant: 'long' },
  ],
}

describe('SurveysService (PGlite)', () => {
  let service: SurveysService
  let dbs: DatabaseService

  beforeEach(async () => {
    ;({ service, dbs } = await makeDb())
  })

  it('활성 설문이 없으면 getActive 가 404', async () => {
    await expect(service.getActive('nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('생성 → 활성화 → 위젯이 활성 설문을 받음', async () => {
    const created = await service.createSurvey('demo', baseSurvey)
    expect(created.version).toBe(1)
    expect(created.active).toBe(false)

    const activated = await service.activateSurvey('demo', 1)
    expect(activated.active).toBe(true)

    const active = await service.getActive('demo')
    expect(active.version).toBe(1)
    expect(active.questions).toHaveLength(4)
  })

  it('두 번째 버전 활성화 시 이전 활성본이 내려감(활성본 1개 불변)', async () => {
    await service.createSurvey('demo', baseSurvey)
    await service.activateSurvey('demo', 1)
    await service.createSurvey('demo', { ...baseSurvey, title: 'v2' })
    await service.activateSurvey('demo', 2)

    const active = await service.getActive('demo')
    expect(active.version).toBe(2)

    const activeCount = await dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.surveys)
      .where(sql`${schema.surveys.appId} = 'demo' and ${schema.surveys.active} = true`)
    expect(Number(activeCount[0]!.c)).toBe(1)
  })

  it('유효한 응답을 저장하고 영수증을 반환', async () => {
    await service.createSurvey('demo', baseSurvey)
    await service.activateSurvey('demo', 1)

    const receipt = await service.submitResponse(
      'demo',
      { answers: { q_rating: 5, q_nps: 9, q_pick: 'pro', q_text: '좋아요' } },
      { userAgent: 'vitest', referrer: 'https://x.test' }
    )
    expect(receipt.surveyVersion).toBe(1)
    expect(receipt.id).toBeTruthy()

    const list = await service.listResponses('demo', {})
    expect(list.total).toBe(1)
    expect(list.items[0]!.answers.q_rating).toBe(5)
    // 위젯이 meta 를 안 보내면 헤더로 보완됨
    expect(list.items[0]!.meta?.userAgent).toBe('vitest')
  })

  it('활성 설문 기준 검증 실패 시 400(질문별 사유)', async () => {
    await service.createSurvey('demo', baseSurvey)
    await service.activateSurvey('demo', 1)

    // q_rating 범위 밖 + q_nps 누락(필수)
    await expect(
      service.submitResponse('demo', { answers: { q_rating: 99 } }, {})
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('summary 가 평균 별점·NPS·선택지 분포를 반영', async () => {
    await service.createSurvey('demo', baseSurvey)
    await service.activateSurvey('demo', 1)

    const submit = (rating: number, nps: number, pick: string) =>
      service.submitResponse(
        'demo',
        { answers: { q_rating: rating, q_nps: nps, q_pick: pick } },
        {}
      )

    // 추천 3(9,10,9), 비추천 1(3) → NPS = 75% − 25% = 50; rating 평균 (5+4+5+2)/4 = 4
    await submit(5, 9, 'pro')
    await submit(4, 10, 'free')
    await submit(5, 9, 'pro')
    await submit(2, 3, 'free')

    const s = await service.summary('demo')
    expect(s.responseCount).toBe(4)

    const rating = s.questions.find((q) => q.questionId === 'q_rating')!
    if (rating.type === 'rating') expect(rating.average).toBe(4)

    const nps = s.questions.find((q) => q.questionId === 'q_nps')!
    if (nps.type === 'nps') {
      expect(nps.promoters).toBe(3)
      expect(nps.detractors).toBe(1)
      expect(nps.score).toBe(50)
    }

    const pick = s.questions.find((q) => q.questionId === 'q_pick')!
    if (pick.type === 'single_choice') {
      expect(pick.tallies).toEqual([
        { value: 'free', label: '무료', count: 2 },
        { value: 'pro', label: '프로', count: 2 },
      ])
    }
  })

  it('응답 목록 페이지네이션(offset/limit)', async () => {
    await service.createSurvey('demo', baseSurvey)
    await service.activateSurvey('demo', 1)
    for (let i = 0; i < 5; i += 1) {
      await service.submitResponse('demo', { answers: { q_rating: 4, q_nps: 8 } }, {})
    }
    const page = await service.listResponses('demo', { offset: '2', limit: '2' })
    expect(page.total).toBe(5)
    expect(page.items).toHaveLength(2)
    expect(page.offset).toBe(2)
    expect(page.limit).toBe(2)
  })
})
