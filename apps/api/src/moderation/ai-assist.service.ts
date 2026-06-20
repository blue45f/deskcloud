import { Inject, Injectable, Logger } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

/** AI 보조 결과 — 점수(0~1)와 카테고리(있으면). 사용 불가/오류 시 null. */
export interface AiAssistResult {
  score: number
  categories?: string[]
}

/**
 * Claude(Anthropic) 보조 독성 평가 — **선택**.
 *
 * ANTHROPIC_API_KEY 가 설정되어 있을 때만 활성화된다. 작고 저렴한 모델(기본 claude-haiku-4-5)에
 * JSON 출력을 요청해 0~1 독성 점수와 카테고리를 받는다. 키 미설정/오류/파싱 실패 시 **null** 을
 * 반환하며 절대 throw 하지 않는다(모더레이션은 규칙 기반으로 안전 폴백).
 *
 * 참고: 실제 키 없이 동작하는 게 기본 경로이며, 키가 있어도 이 모듈은 모더레이션을 차단(block)하지
 * 않는다 — 점수만 제공하고 verdict 격상 여부는 호출 측(matchRules/applyAiScore)이 결정한다.
 */
@Injectable()
export class AiAssistService {
  private readonly logger = new Logger('AiAssist')

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  /** AI 보조가 사용 가능한지(키가 있는지). */
  get enabled(): boolean {
    return this.cfg.anthropicApiKey !== null
  }

  /**
   * 텍스트의 독성/유해성 점수를 산출. 비활성(키 없음)이거나 오류면 null.
   * @param text 평가 대상(이미 살균된 사용자 입력)
   */
  async score(text: string): Promise<AiAssistResult | null> {
    if (!this.cfg.anthropicApiKey) return null
    try {
      return await this.callClaude(text)
    } catch (err) {
      // 라이브 보호: AI 경로는 절대 모더레이션을 깨뜨리지 않는다.
      this.logger.warn(`AI 보조 호출 실패 — 규칙 기반으로 폴백: ${(err as Error).message}`)
      return null
    }
  }

  /**
   * Anthropic SDK 를 동적 import 해 호출한다(패키지가 없거나 키가 없으면 동적 로딩 실패 →
   * 상위에서 catch). structured output(json_schema)로 0~1 점수를 강제한다.
   */
  private async callClaude(text: string): Promise<AiAssistResult | null> {
    // 동적 import — @anthropic-ai/sdk 는 선택적 의존성(미설치 시 throw → 폴백).
    // 모듈 지정자를 런타임 값으로 구성해, 미설치 패키지가 컴파일 타임 의존성이 되지 않게 한다
    // (AI 경로는 키가 있을 때만, 그리고 SDK 가 설치돼 있을 때만 동작 — 둘 다 선택).
    const specifier = '@anthropic-ai/sdk'
    const mod = (await import(/* @vite-ignore */ specifier).catch(() => null)) as {
      default?: new (opts: { apiKey: string }) => AnthropicLike
    } | null
    const Anthropic = mod?.default
    if (!Anthropic) {
      this.logger.warn('@anthropic-ai/sdk 미설치 — AI 보조 건너뜀(규칙 기반 사용)')
      return null
    }

    const client = new Anthropic({ apiKey: this.cfg.anthropicApiKey! })
    const response = await client.messages.create({
      model: this.cfg.aiModel,
      max_tokens: 256,
      system:
        'You are a content moderation classifier. Rate the toxicity/harmfulness of the user text ' +
        'on a 0..1 scale (0 = benign, 1 = severe). Respond ONLY with the structured JSON.',
      messages: [{ role: 'user', content: text }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              categories: { type: 'array', items: { type: 'string' } },
            },
            required: ['score'],
            additionalProperties: false,
          },
        },
      },
    })

    return this.parseResult(response)
  }

  /** 응답에서 첫 text 블록의 JSON 을 파싱해 0~1 로 클램프. 실패 시 null. */
  private parseResult(response: AnthropicResponse): AiAssistResult | null {
    const block = response.content?.find((b) => b.type === 'text')
    if (!block?.text) return null
    let parsed: { score?: unknown; categories?: unknown }
    try {
      parsed = JSON.parse(block.text) as typeof parsed
    } catch {
      return null
    }
    const raw = Number(parsed.score)
    if (!Number.isFinite(raw)) return null
    const score = Math.min(1, Math.max(0, raw))
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((c): c is string => typeof c === 'string')
      : undefined
    return { score, categories }
  }
}

// ── 최소 타입(런타임 SDK 형태에 맞춘 얇은 인터페이스) ─────────────────────────
interface AnthropicResponse {
  content?: { type: string; text?: string }[]
}
interface AnthropicLike {
  messages: { create: (params: Record<string, unknown>) => Promise<AnthropicResponse> }
}
