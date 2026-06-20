import {
  applyAiScore,
  matchRules,
  type ModerateInput,
  type ModerateResultDto,
  type MatchableRule,
} from '@moderationdesk/shared'
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { forbiddenRules, moderationLogs } from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { AiAssistService } from './ai-assist.service'

@Injectable()
export class ModerationService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly tenants: TenantsService,
    private readonly ai: AiAssistService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /**
   * 텍스트 모더레이션 검사.
   *   1) 무료 플랜 소프트 한도 검사(초과 402)
   *   2) 활성 금칙 규칙으로 규칙 기반 verdict 산출(항상)
   *   3) AI 보조가 켜져 있고(useAi !== false) 키가 있으면 Claude 점수 추가 → verdict 격상(선택)
   *   4) 로그 적재 + usage 증가
   * 반환: { verdict, matchedRules, aiScore?, logId }
   */
  async moderate(tenant: TenantRow, input: ModerateInput): Promise<ModerateResultDto> {
    // 무료 플랜 소프트 한도: 누적 검사가 한도 이상이면 402.
    if (tenant.plan === 'free' && tenant.usageCount >= this.cfg.freePlanLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `무료 플랜 검사 한도(${this.cfg.freePlanLimit})를 초과했습니다. 플랜을 업그레이드하세요.`,
        },
        HttpStatus.PAYMENT_REQUIRED
      )
    }

    // 1) 규칙 기반(항상).
    const rules = await this.loadRules(tenant.id)
    const ruleResult = matchRules(input.text, rules)
    let verdict = ruleResult.verdict

    // 2) AI 보조(선택) — useAi 가 명시적으로 false 가 아니고 키가 있을 때만.
    let aiScore: number | undefined
    if (input.useAi !== false && this.ai.enabled) {
      const ai = await this.ai.score(input.text)
      if (ai) {
        aiScore = ai.score
        verdict = applyAiScore(verdict, aiScore)
      }
    }

    // 3) 로그 적재.
    const inserted = await this.dbs.db
      .insert(moderationLogs)
      .values({
        tenantId: tenant.id,
        text: input.text,
        verdict,
        matchedRules: ruleResult.matched,
        aiScore: aiScore ?? null,
        source: input.meta?.source ?? null,
      })
      .returning({ id: moderationLogs.id })
    const logId = inserted[0]!.id

    // 4) usage 증가(검사 1건).
    await this.tenants.incrementUsage(tenant.id)

    const result: ModerateResultDto = {
      verdict,
      matchedRules: ruleResult.matched,
      logId,
    }
    if (aiScore !== undefined) result.aiScore = aiScore
    return result
  }

  /** 테넌트의 활성 금칙 규칙을 매칭 가능한 형태로 로드. */
  private async loadRules(tenantId: string): Promise<MatchableRule[]> {
    const rows = await this.dbs.db
      .select({
        id: forbiddenRules.id,
        pattern: forbiddenRules.pattern,
        kind: forbiddenRules.kind,
        action: forbiddenRules.action,
        enabled: forbiddenRules.enabled,
      })
      .from(forbiddenRules)
      .where(and(eq(forbiddenRules.tenantId, tenantId), eq(forbiddenRules.enabled, true)))
    return rows
  }
}
