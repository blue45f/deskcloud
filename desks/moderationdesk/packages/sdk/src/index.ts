/**
 * @moderationdesk/sdk — ModerationDesk 서버 SDK.
 *
 * secret 키(sk_)로 모더레이션을 호출하는 형제 백엔드/서버리스용 클라이언트.
 * 런타임 의존성 0 — 전역 fetch 만 쓰고(주입 가능), 타입은 @moderationdesk/shared 에서.
 *
 *   import { createModerationClient } from '@moderationdesk/sdk'
 *   const md = createModerationClient({ secretKey: process.env.MD_SECRET_KEY!, endpoint })
 *   const { verdict } = await md.moderate('사용자가 입력한 댓글…')
 *   if (verdict === 'block') throw new Error('차단된 콘텐츠')
 *
 * secret 키는 서버 전용입니다 — 브라우저 번들에 절대 포함하지 마세요(검사/신고만
 * 필요한 클라이언트는 @moderationdesk/widget 의 publishable 키 경로를 쓰세요).
 */
export {
  createModerationClient,
  ModerationError,
  PlanLimitError,
  type ModerationClient,
  type ModerationClientOptions,
  type CheckResult,
} from './client'

// 소비자가 결과를 다룰 때 자주 필요한 공유 타입을 재노출(편의).
export type {
  ModerateInput,
  ModerateMeta,
  ModerateResultDto,
  MatchedRule,
  Verdict,
  CreateRuleInput,
  UpdateRuleInput,
  RuleDto,
  SubmitReportInput,
  ReportReceiptDto,
  ReportDto,
  ReportListDto,
  AdminReportQuery,
  UpdateReportInput,
  LogListDto,
  AdminLogQuery,
  TenantDto,
} from '@moderationdesk/shared'
