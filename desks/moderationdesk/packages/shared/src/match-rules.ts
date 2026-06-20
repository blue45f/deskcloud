import { AI_FLAG_THRESHOLD, type RuleAction, type RuleKind, type Verdict } from './constants'

/** 매칭 대상 규칙(최소 형태) — DB row 든 입력이든 이 형태면 매칭 가능. */
export interface MatchableRule {
  id: string
  pattern: string
  kind: RuleKind
  action: RuleAction
  enabled: boolean
}

/** 텍스트에 매칭된 규칙 1건의 요약(응답·로그에 실린다). */
export interface MatchedRule {
  id: string
  pattern: string
  kind: RuleKind
  action: RuleAction
}

/** 규칙 매칭 결과(순수). verdict 는 매칭 액션 중 가장 강한 것으로 결정된다. */
export interface RuleMatchResult {
  verdict: Verdict
  matched: MatchedRule[]
}

/** 규칙 액션 → verdict 매핑. review 는 flag 로(검토 분류, 차단 아님). */
function actionToVerdict(action: RuleAction): Verdict {
  switch (action) {
    case 'block':
      return 'block'
    case 'flag':
    case 'review':
      return 'flag'
    default:
      return 'allow'
  }
}

/** verdict 강도 순위 — 큰 값이 더 강함. */
const VERDICT_RANK: Record<Verdict, number> = { allow: 0, flag: 1, block: 2 }

/** 두 verdict 중 더 강한 쪽을 반환(우선순위: block > flag > allow). */
export function strongerVerdict(a: Verdict, b: Verdict): Verdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b
}

/** 정규식 컴파일을 안전하게 — 잘못된 패턴이면 null(매칭 실패로 취급, throw 안 함). */
function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'iu')
  } catch {
    return null
  }
}

/** 단일 규칙이 텍스트에 매칭되는지(대소문자 무시). */
function ruleMatches(rule: MatchableRule, lowerText: string, rawText: string): boolean {
  const pattern = rule.pattern
  if (pattern.length === 0) return false
  switch (rule.kind) {
    case 'exact':
      return lowerText.trim() === pattern.toLowerCase().trim()
    case 'substring':
      return lowerText.includes(pattern.toLowerCase())
    case 'regex': {
      const re = safeRegex(pattern)
      return re ? re.test(rawText) : false
    }
    default:
      return false
  }
}

/**
 * 규칙 기반 모더레이션(순수 함수). 활성 규칙만 평가하며, 매칭된 규칙들의 액션 중
 * 가장 강한 verdict 를 채택한다. 매칭이 없으면 `allow`.
 *
 * - exact: 텍스트 전체가 패턴과 (trim·소문자 기준) 동일
 * - substring: 텍스트가 패턴을 포함(소문자 기준)
 * - regex: 패턴을 정규식(i,u)으로 컴파일해 test (잘못된 정규식은 매칭 실패로 안전 처리)
 *
 * api(검사 경로)·테스트가 공유한다. 외부 입력만 받고 부수효과가 없다.
 */
export function matchRules(text: string, rules: readonly MatchableRule[]): RuleMatchResult {
  const lowerText = text.toLowerCase()
  const matched: MatchedRule[] = []
  let verdict: Verdict = 'allow'

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!ruleMatches(rule, lowerText, text)) continue
    matched.push({ id: rule.id, pattern: rule.pattern, kind: rule.kind, action: rule.action })
    verdict = strongerVerdict(verdict, actionToVerdict(rule.action))
  }

  return { verdict, matched }
}

/**
 * 규칙 verdict 에 AI 독성 점수를 합성(순수). 규칙이 block 이면 그대로 두고,
 * 점수가 임계값 이상이면 verdict 를 최소 flag 로 격상한다. (AI 는 절대 차단(block)을 만들지 않음 —
 * 차단은 명시 규칙의 권한.) aiScore 가 undefined 면 규칙 verdict 를 그대로 반환.
 */
export function applyAiScore(
  ruleVerdict: Verdict,
  aiScore: number | undefined,
  threshold: number = AI_FLAG_THRESHOLD
): Verdict {
  if (aiScore === undefined) return ruleVerdict
  if (aiScore >= threshold) return strongerVerdict(ruleVerdict, 'flag')
  return ruleVerdict
}
