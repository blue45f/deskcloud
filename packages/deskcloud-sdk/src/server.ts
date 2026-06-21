/**
 * @heejun/deskcloud/server — SERVER entry (secret `sk_` admin clients).
 *
 * Import the per-Desk admin clients from here, e.g.:
 *   import { createReviewAdminClient } from '@heejun/deskcloud/server'
 *
 * SECURITY: this entry uses SECRET keys (`sk_…`). NEVER import it from browser /
 * client-bundled code. Use it only in server runtimes (Node, edge functions, API
 * routes) where the secret key is not exposed to end users.
 *
 * Note on duplicate type names: several admin clients independently define
 * identically named but structurally distinct types — `Plan`, `Tenant`,
 * `TenantCreated`, `UpdateTenantInput`, `UpdateTenantSettingsInput` and
 * `DeleteResult`. Only one binding can own each bare name, so the first client
 * (in declaration order below) owns the bare name and every other client's
 * variant is also re-exported under a client-prefixed alias (e.g.
 * `CommunityTenant`, `ReviewPlan`, `AdDeleteResult`). The bare name always
 * resolves to a single canonical client.
 */

// ── Shared core (re-exported for convenience on the server too) ───────────────
export { DeskError, createDeskTransport, request } from "./core/http.js";
export type {
  DeskTransport,
  DeskTransportOptions,
  RequestOptions,
  RequestInit_,
  QueryParams,
  Paginated,
  Result,
} from "./core/http.js";
// Server-only secret-key (`sk_`) transport. Lives only in this entry.
export { createAdminTransport } from "./core/admin.js";
export type { AdminTransportOptions } from "./core/admin.js";

// ── Survey (admin) ───────────────────────────────────────────────────────────
export { createSurveyAdminClient } from "./server/survey.js";
export type {
  SurveyAdminClient,
  SurveyAdminClientOptions,
  SurveyBodyInput,
  CreateSurveyInput,
  UpdateSurveyInput,
  SurveyResponse,
  SurveyResponseList,
  SurveyResponseListParams,
  SurveySummary,
  QuestionSummary,
  RatingSummary,
  NpsSummary,
  ChoiceSummary,
  TextSummary,
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyTextVariant,
  SurveyOption,
} from "./server/survey.js";

// ── Changelog (admin) ────────────────────────────────────────────────────────
export { createChangelogAdminClient } from "./server/changelog.js";
export type {
  ChangelogAdminClient,
  ChangelogAdminClientOptions,
  ChangelogEntry,
  ChangelogEntryTag,
  ChangelogPlan,
  ChangelogAdminEntryList,
  ChangelogTenant,
  ChangelogTenantWithKeys,
  ChangelogOk,
  CreateEntryInput,
  UpdateEntryInput,
  // Canonical bare `UpdateTenantInput` (changelog owns it on the server barrel).
  UpdateTenantInput,
} from "./server/changelog.js";

// ── Review (admin) ───────────────────────────────────────────────────────────
export { createReviewAdminClient } from "./server/review.js";
export type {
  ReviewAdminClient,
  ReviewAdminClientOptions,
  ReviewStatus,
  ModerationAction,
  ReviewMeta,
  AdminReview,
  AdminReviewList,
  ListReviewsParams,
  ModerateReviewInput,
  // Canonical bare names owned by review.
  Plan,
  Tenant,
  TenantCreated,
} from "./server/review.js";
// Review's UpdateTenantInput collides (changelog is bare) — alias it.
export type { UpdateTenantInput as ReviewUpdateTenantInput } from "./server/review.js";

// ── Notify (admin) ───────────────────────────────────────────────────────────
export { createNotifyAdminClient } from "./server/notify.js";
export type {
  NotifyAdminClient,
  NotifyAdminClientOptions,
  NotifyChannel,
  NotifyNotificationStatus,
  NotifyPlan,
  NotifyNotification,
  NotifyTemplate,
  NotifyChannelDelivery,
  NotifyResult,
  NotifySentLog,
  NotifyTenant,
  NotifyTenantCredentials,
  NotifySendInput,
  NotifyCreateTemplateInput,
  NotifyUpdateTemplateInput,
  NotifyListSentParams,
  NotifyUpdateTenantInput,
} from "./server/notify.js";

// ── Search (admin) ───────────────────────────────────────────────────────────
export { createSearchAdminClient } from "./server/search.js";
export type {
  SearchAdminClient,
  SearchAdminClientOptions,
  SearchUpsertInput,
  SearchDocumentInput,
  SearchIndexResult,
  SearchDeleteResult,
  SearchDocument,
  SearchDocumentList,
  SearchListDocumentsParams,
  SearchTenant,
  SearchTenantUpdate,
  SearchTenantCredentials,
  SearchUsage,
  SearchPlan,
} from "./server/search.js";

// ── Community (admin) ────────────────────────────────────────────────────────
export { createCommunityAdminClient } from "./server/community.js";
export type {
  CommunityAdminClient,
  CommunityAdminClientOptions,
  BoardKind,
  ContentStatus,
  ReactionKind,
  ReactionCounts,
  PostModerationAction,
  CommentModerationAction,
  Board,
  AdminPost,
  AdminPostList,
  ListAdminPostsParams,
  ModeratePostInput,
  ModerateCommentInput,
  CreateBoardInput,
  UpdateBoardInput,
} from "./server/community.js";
// Community's collisions (review owns bare Plan/Tenant/TenantCreated; changelog
// owns bare UpdateTenantInput) — alias the community variants.
export type {
  Plan as CommunityPlan,
  Tenant as CommunityTenant,
  TenantCreated as CommunityTenantCreated,
  UpdateTenantInput as CommunityUpdateTenantInput,
} from "./server/community.js";

// ── Media (admin) ────────────────────────────────────────────────────────────
export { createMediaAdminClient } from "./server/media.js";
export type {
  MediaAdminClient,
  MediaAdminClientOptions,
  MediaTenant,
  MediaPlan,
  MediaUsage,
  MediaAsset,
  MediaAdminAssetList,
  MediaRotateKeysResult,
  MediaStorageInfo,
  MediaDeleteResult,
  ListMediaAssetsParams,
  UpdateMediaTenantInput,
} from "./server/media.js";

// ── Moderation (admin) ───────────────────────────────────────────────────────
export { createModerationAdminClient } from "./server/moderation.js";
export type {
  ModerationAdminClient,
  ModerationAdminClientOptions,
  Verdict,
  RuleKind,
  RuleAction,
  ReportStatus,
  MatchedRule,
  ModerateMeta,
  ModerateResult,
  AdminRule,
  AdminReport,
  AdminReportList,
  AdminLog,
  AdminLogList,
  ModerateInput,
  CreateRuleInput,
  UpdateRuleInput,
  ListReportsParams,
  UpdateReportInput,
  ListLogsParams,
  CreateTenantInput,
} from "./server/moderation.js";
// Moderation's collisions — alias them (review/changelog own the bare names).
export type {
  Plan as ModerationPlan,
  Tenant as ModerationTenant,
  TenantCreated as ModerationTenantCreated,
  UpdateTenantInput as ModerationUpdateTenantInput,
} from "./server/moderation.js";

// ── File (admin) ─────────────────────────────────────────────────────────────
export { createFileAdminClient } from "./server/file.js";
export type {
  FileAdminClient,
  FileAdminClientOptions,
  ListFilesParams,
  SignUrlInput,
  FileObject,
  FileList,
  FileStats,
  FileVisibilityStat,
  SignedUrl,
  FileTenant,
  FileTenantCredentials,
  FileVisibility,
  FilePlan,
  StorageDriver,
  UsageMetric,
} from "./server/file.js";
// File's UpdateTenantInput + DeleteResult collide — alias them.
export type {
  UpdateTenantInput as FileUpdateTenantInput,
  DeleteResult as FileDeleteResult,
} from "./server/file.js";

// ── Ad (admin) ───────────────────────────────────────────────────────────────
export { createAdAdminClient } from "./server/ad.js";
export type {
  AdAdminClient,
  AdAdminClientOptions,
  CampaignStatus,
  Campaign,
  Creative,
  Slot,
  CampaignStat,
  StatsTotals,
  Stats,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateCreativeInput,
  UpdateCreativeInput,
  ListCreativesParams,
  CreateSlotInput,
  UpdateSlotInput,
  // Canonical bare `DeleteResult` (ad owns it on the server barrel).
  DeleteResult,
} from "./server/ad.js";

// ── Auth (admin) ─────────────────────────────────────────────────────────────
export { createAuthAdminClient } from "./server/auth.js";
export type {
  AuthAdminClient,
  AuthAdminClientOptions,
  EndUser,
  UserList,
  AuthStats,
  ListUsersParams,
} from "./server/auth.js";
// Auth's Plan + DeleteResult collide (review/ad own the bare names) — alias them.
export type {
  Plan as AuthPlan,
  DeleteResult as AuthDeleteResult,
} from "./server/auth.js";

// ── Terms (admin) ────────────────────────────────────────────────────────────
export { createTermsAdminClient } from "./server/terms.js";
export type {
  TermsAdminClient,
  TermsAdminClientOptions,
  PolicyType,
  PolicyVisibility,
  VersionStatus,
  ConsentDecision,
  ConsentMethod,
  Role,
  ApiKeyScope,
  PlanId,
  InquiryCategory,
  InquiryStatus,
  Policy,
  PolicyVersionSummary,
  PolicyVersionDetail,
  ConsentEvidence,
  ConsentReceipt,
  Inquiry,
  InquiryList,
  Member,
  Org,
  PlanLimits,
  PlanUsage,
  ApiKey,
  ApiKeyCreated,
  AuditEvent,
  ConsentTrendPoint,
  ReconsentStatus,
  ApiKeyUsage,
  CreatePolicyInput,
  UpdatePolicyInput,
  CreateVersionInput,
  UpdateVersionInput,
  PublishVersionInput,
  ListConsentsParams,
  ListInquiriesParams,
  UpdateInquiryInput,
  InviteMemberInput,
  UpdateOrgInput,
  CreateApiKeyInput,
  ExportConsentsParams,
} from "./server/terms.js";

// ── Realtime (admin) ─────────────────────────────────────────────────────────
export { createRealtimeAdminClient } from "./server/realtime.js";
export type {
  RealtimeAdminClient,
  RealtimeAdminClientOptions,
  PublishInput,
  PublishResult,
  RealtimeMessage,
  RealtimeUsage,
  RealtimeTenant,
  RealtimeTenantWithSecret,
  RealtimePlan,
  // Canonical bare `UpdateTenantSettingsInput` (realtime owns it).
  UpdateTenantSettingsInput,
} from "./server/realtime.js";

// ── Chat (admin) ─────────────────────────────────────────────────────────────
export { createChatAdminClient } from "./server/chat.js";
export type {
  ChatAdminClient,
  ChatAdminClientOptions,
  ConversationKind,
  Attachment,
  Message,
  Conversation,
  MessageHistory,
  SendResult,
  DeleteMessageResult,
  TenantUsage,
  TenantWithSecret,
  MemberToken,
  CreateConversationInput,
  AdminHistoryParams,
  SystemMessageInput,
  IssueMemberTokenInput,
} from "./server/chat.js";
// Chat's collisions — alias them (review owns bare Plan/Tenant; realtime owns
// bare UpdateTenantSettingsInput).
export type {
  Plan as ChatPlan,
  Tenant as ChatTenant,
  UpdateTenantSettingsInput as ChatUpdateTenantSettingsInput,
} from "./server/chat.js";
