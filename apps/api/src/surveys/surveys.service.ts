import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  summarize,
  validateAnswers,
  type CreateSurveyInput,
  type ResponseListDto,
  type ResponseReceiptDto,
  type SubmitResponseInput,
  type SurveyDto,
  type SurveySummary,
  type UpdateSurveyInput,
} from '@surveydesk/shared'
import { and, desc, eq, sql } from 'drizzle-orm'

import { toResponseDto, toSurveyDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { surveyResponses, surveys } from '../db/schema'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

function parsePaging(offset?: string, limit?: string): { offset: number; limit: number } {
  const o = Math.max(0, Math.trunc(Number(offset)) || 0)
  const l = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(limit)) || DEFAULT_LIMIT))
  return { offset: o, limit: l }
}

@Injectable()
export class SurveysService {
  constructor(private readonly dbs: DatabaseService) {}

  // ── 공개(위젯) ────────────────────────────────────────────────────────────

  /** 위젯용 활성 설문. 활성본이 없으면 404. */
  async getActive(appId: string): Promise<SurveyDto> {
    const rows = await this.dbs.db
      .select()
      .from(surveys)
      .where(and(eq(surveys.appId, appId), eq(surveys.active, true)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException(`'${appId}' 의 활성 설문이 없습니다`)
    return toSurveyDto(row)
  }

  /**
   * 공개 응답 제출 — 활성 설문을 기준으로 answers 를 2차 검증한 뒤 저장.
   * 활성본이 없으면 404, 검증 실패면 400(질문별 사유 포함).
   */
  async submitResponse(
    appId: string,
    input: SubmitResponseInput,
    ctx: { userAgent?: string; referrer?: string }
  ): Promise<ResponseReceiptDto> {
    const active = await this.getActive(appId)

    const result = validateAnswers(active.questions, input.answers)
    if (!result.ok) {
      throw new BadRequestException({
        message: '응답이 활성 설문 기준 검증에 실패했습니다',
        errors: result.errors,
      })
    }

    const meta = {
      pageUrl: input.meta?.pageUrl,
      // 위젯이 보내지 않으면 헤더로 보완.
      userAgent: input.meta?.userAgent ?? ctx.userAgent,
      referrer: input.meta?.referrer ?? ctx.referrer,
    }

    const inserted = await this.dbs.db
      .insert(surveyResponses)
      .values({
        appId,
        surveyVersion: active.version,
        answers: result.value,
        respondentUserId: input.respondent?.userId ?? null,
        respondentEmail: input.respondent?.email ?? null,
        meta,
      })
      .returning()
    const row = inserted[0]!
    return {
      id: row.id,
      appId: row.appId,
      surveyVersion: row.surveyVersion,
      createdAt: row.createdAt.toISOString(),
    }
  }

  // ── 어드민: 응답·집계 ──────────────────────────────────────────────────────

  /** 응답 목록(최신순, 페이지네이션). */
  async listResponses(
    appId: string,
    paging: { offset?: string; limit?: string }
  ): Promise<ResponseListDto> {
    const { offset, limit } = parsePaging(paging.offset, paging.limit)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(surveyResponses)
      .where(eq(surveyResponses.appId, appId))
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.appId, appId))
      .orderBy(desc(surveyResponses.createdAt))
      .offset(offset)
      .limit(limit)

    return { items: rows.map(toResponseDto), total, offset, limit }
  }

  /**
   * 집계 — 활성 설문의 질문 정의를 기준으로 그 버전의 응답을 요약한다.
   * 활성본이 없으면 가장 최신 버전을 기준으로 한다(없으면 404).
   */
  async summary(appId: string): Promise<SurveySummary> {
    const surveyRow = await this.resolveSummaryBaseSurvey(appId)

    const responses = await this.dbs.db
      .select({ answers: surveyResponses.answers, createdAt: surveyResponses.createdAt })
      .from(surveyResponses)
      .where(
        and(eq(surveyResponses.appId, appId), eq(surveyResponses.surveyVersion, surveyRow.version))
      )

    return summarize(
      appId,
      surveyRow.version,
      surveyRow.questions,
      responses.map((r) => ({ answers: r.answers, createdAt: r.createdAt }))
    )
  }

  /** 집계 기준 설문: 활성본 우선, 없으면 최신 버전. */
  private async resolveSummaryBaseSurvey(appId: string): Promise<typeof surveys.$inferSelect> {
    const activeRows = await this.dbs.db
      .select()
      .from(surveys)
      .where(and(eq(surveys.appId, appId), eq(surveys.active, true)))
      .limit(1)
    if (activeRows[0]) return activeRows[0]

    const latest = await this.dbs.db
      .select()
      .from(surveys)
      .where(eq(surveys.appId, appId))
      .orderBy(desc(surveys.version))
      .limit(1)
    if (!latest[0]) throw new NotFoundException(`'${appId}' 의 설문이 없습니다`)
    return latest[0]
  }

  // ── 어드민: 설문 CRUD ──────────────────────────────────────────────────────

  /** 앱의 설문 목록(버전 이력, 최신순). */
  async listSurveys(appId: string): Promise<SurveyDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(surveys)
      .where(eq(surveys.appId, appId))
      .orderBy(desc(surveys.version))
    return rows.map(toSurveyDto)
  }

  /** 설문 단건(특정 버전). */
  async getSurvey(appId: string, version: number): Promise<SurveyDto> {
    const row = await this.findSurvey(appId, version)
    return toSurveyDto(row)
  }

  /**
   * 새 설문 버전 생성 — version 은 자동 증가(현재 최대+1). 생성 시점에는 비활성.
   * activate 로 명시 활성화한다.
   */
  async createSurvey(appId: string, input: CreateSurveyInput): Promise<SurveyDto> {
    const maxRows = await this.dbs.db
      .select({ m: sql<number>`coalesce(max(${surveys.version}), 0)::int` })
      .from(surveys)
      .where(eq(surveys.appId, appId))
    const nextVersion = Number(maxRows[0]?.m ?? 0) + 1

    const inserted = await this.dbs.db
      .insert(surveys)
      .values({
        appId,
        version: nextVersion,
        title: input.title,
        intro: input.intro ?? null,
        questions: input.questions,
        active: false,
      })
      .returning()
    return toSurveyDto(inserted[0]!)
  }

  /** 설문(특정 버전) 수정. 버전 번호·활성 상태는 바꾸지 않는다. */
  async updateSurvey(appId: string, version: number, input: UpdateSurveyInput): Promise<SurveyDto> {
    await this.findSurvey(appId, version) // 존재 확인(404)
    const updated = await this.dbs.db
      .update(surveys)
      .set({
        title: input.title,
        intro: input.intro ?? null,
        questions: input.questions,
        updatedAt: new Date(),
      })
      .where(and(eq(surveys.appId, appId), eq(surveys.version, version)))
      .returning()
    return toSurveyDto(updated[0]!)
  }

  /**
   * 설문(특정 버전) 활성화 — 같은 appId 의 기존 활성본을 모두 내리고 이 버전만 활성으로.
   * (appId당 활성본 1개 불변 유지.)
   */
  async activateSurvey(appId: string, version: number): Promise<SurveyDto> {
    await this.findSurvey(appId, version) // 존재 확인(404)
    await this.dbs.db
      .update(surveys)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(surveys.appId, appId), eq(surveys.active, true)))
    const activated = await this.dbs.db
      .update(surveys)
      .set({ active: true, updatedAt: new Date() })
      .where(and(eq(surveys.appId, appId), eq(surveys.version, version)))
      .returning()
    if (!activated[0]) throw new ConflictException('설문 활성화에 실패했습니다')
    return toSurveyDto(activated[0])
  }

  private async findSurvey(appId: string, version: number): Promise<typeof surveys.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(surveys)
      .where(and(eq(surveys.appId, appId), eq(surveys.version, version)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`'${appId}' v${version} 설문이 없습니다`)
    return rows[0]
  }
}
