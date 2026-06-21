/**
 * @heejun/deskcloud — BROWSER entry (publishable `pk_` clients).
 *
 * Import the per-Desk public clients from here, e.g.:
 *   import { createReviewClient } from '@heejun/deskcloud'
 *
 * SECURITY: this entry is browser-safe (publishable keys only). It NEVER imports
 * anything from `./server/*`. For admin operations with a secret `sk_` key, use
 * '@heejun/deskcloud/server' and never bundle that into client code.
 *
 * Note on duplicate type names: a few clients independently define identically
 * named (but structurally distinct) types — `GetWallParams` (changelog/review),
 * `SignupInput` (changelog/realtime) and `ConnectOptions` (realtime/chat). Only
 * one binding can own each bare name, so the secondaries are also re-exported
 * under disambiguated aliases (`ReviewGetWallParams`, `RealtimeSignupInput`,
 * `ChatConnectOptions`). The bare names resolve to a single canonical client.
 */

// ── Shared core (browser-safe) ───────────────────────────────────────────────
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

// ── Survey ───────────────────────────────────────────────────────────────────
export { createSurveyClient } from "./clients/survey.js";
export type {
  SurveyClient,
  SurveyClientOptions,
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyTextVariant,
  SurveyOption,
  SurveyAnswerValue,
  SurveyResponseMeta,
  SurveyRespondent,
  SubmitSurveyResponseInput,
  SurveyResponseReceipt,
} from "./clients/survey.js";

// ── Changelog ────────────────────────────────────────────────────────────────
export { createChangelogClient } from "./clients/changelog.js";
export type {
  ChangelogClient,
  ChangelogClientOptions,
  ChangelogEntry,
  ChangelogEntryTag,
  ChangelogPlan,
  PublicChangelog,
  ChangelogUnreadCount,
  ChangelogTenant,
  ChangelogTenantWithKeys,
  ChangelogOk,
  // Canonical bare bindings (changelog owns these names in the browser barrel).
  GetWallParams,
  GetUnreadCountParams,
  MarkSeenInput,
  SignupInput,
} from "./clients/changelog.js";

// ── Review ───────────────────────────────────────────────────────────────────
export { createReviewClient } from "./clients/review.js";
export type {
  ReviewClient,
  ReviewClientOptions,
  ReviewStatus,
  ReviewMeta,
  ReviewAggregate,
  PublicReview,
  PublicReviews,
  ReviewWall,
  ReviewReceipt,
  ReviewSubmission,
  ListReviewsParams,
  GetAggregateParams,
} from "./clients/review.js";
// Review's GetWallParams collides with changelog's — alias it (changelog is bare).
export type { GetWallParams as ReviewGetWallParams } from "./clients/review.js";

// ── Notify ───────────────────────────────────────────────────────────────────
export { createNotifyClient } from "./clients/notify.js";
export type {
  NotifyClient,
  NotifyClientOptions,
  NotifyChannel,
  NotifyNotificationStatus,
  NotifyNotification,
  NotifyInbox,
  NotifyUnreadCount,
  NotifyMarkReadResult,
  NotifyPreference,
  NotifyPreferences,
  NotifyGetInboxParams,
  NotifyUnreadCountParams,
  NotifyMarkReadInput,
  NotifyGetPreferencesParams,
  NotifyPreferenceItemInput,
  NotifyUpdatePreferencesInput,
} from "./clients/notify.js";

// ── Search ───────────────────────────────────────────────────────────────────
export { createSearchClient } from "./clients/search.js";
export type {
  SearchClient,
  SearchClientOptions,
  SearchParams,
  SearchResponse,
  SearchHit,
  SearchFacets,
  SearchFacetCount,
  SearchSignupInput,
  SearchTenantCredentials,
  SearchPlan,
} from "./clients/search.js";

// ── Community ────────────────────────────────────────────────────────────────
export { createCommunityClient } from "./clients/community.js";
export type {
  CommunityClient,
  CommunityClientOptions,
  BoardKind,
  ContentStatus,
  ReactionTarget,
  ReactionKind,
  PostSort,
  ReactionCounts,
  Board,
  PostSummary,
  CommentNode,
  PostDetail,
  PostList,
  PostReceipt,
  ReactionToggle,
  CreatePostInput,
  CreateCommentInput,
  ToggleReactionInput,
  ListPostsParams,
} from "./clients/community.js";

// ── Media ────────────────────────────────────────────────────────────────────
export { createMediaClient } from "./clients/media.js";
export type {
  MediaClient,
  MediaClientOptions,
  MediaAsset,
  MediaAssetList,
  MediaUploadInput,
  ListMediaAssetsParams,
  MediaTransformParams,
  MediaTransformFormat,
} from "./clients/media.js";

// ── Moderation ───────────────────────────────────────────────────────────────
export { createModerationClient } from "./clients/moderation.js";
export type {
  ModerationClient,
  ModerationClientOptions,
  Verdict,
  RuleKind,
  RuleAction,
  MatchedRule,
  ModerateMeta,
  ModerateResult,
  ReportStatus,
  ReportReceipt,
  ModerateInput,
  SubmitReportInput,
} from "./clients/moderation.js";

// ── File ─────────────────────────────────────────────────────────────────────
export { createFileClient } from "./clients/file.js";
export type {
  FileClient,
  FileClientOptions,
  FileUploadInput,
  FileSignupInput,
  UploadResult,
  FileTenantCredentials,
  FileVisibility,
  FilePlan,
} from "./clients/file.js";

// ── Ad ───────────────────────────────────────────────────────────────────────
export { createAdClient } from "./clients/ad.js";
export type {
  AdClient,
  AdClientOptions,
  ServeParams,
  ServeResult,
  TrackReceipt,
} from "./clients/ad.js";

// ── Auth ─────────────────────────────────────────────────────────────────────
export { createAuthClient } from "./clients/auth.js";
export type {
  AuthClient,
  AuthClientOptions,
  EndUser,
  AuthResult,
  LogoutResult,
  RegisterInput,
  LoginInput,
} from "./clients/auth.js";

// ── Terms ────────────────────────────────────────────────────────────────────
export { createTermsClient } from "./clients/terms.js";
export type {
  TermsClient,
  TermsClientOptions,
  PolicyType,
  ConsentDecision,
  ConsentMethod,
  SupportCategory,
  SupportStatus,
  InquiryCategory,
  InquiryStatus,
  PublicPolicy,
  PublicRender,
  PublicVerify,
  ConsentReceiptCreated,
  SupportPost,
  SupportPostList,
  InquiryReceipt,
  ConsentEvidence,
  RecordConsentInput,
  GetCurrentParams,
  RenderParams,
  RenderHtmlParams,
  VerifyParams,
  SubmitInquiryInput,
  ListSupportPostsParams,
  CreateSupportPostInput,
} from "./clients/terms.js";

// ── Realtime ─────────────────────────────────────────────────────────────────
export { createRealtimeClient } from "./clients/realtime.js";
export {
  REALTIME_SERVER_EVENTS,
  REALTIME_CLIENT_EVENTS,
  REALTIME_DEFAULT_PATH,
} from "./clients/realtime.js";
export type {
  RealtimeClient,
  RealtimeClientOptions,
  RealtimeConnection,
  RealtimeAck,
  RealtimeServerError,
  RealtimeMessage,
  ChannelHistory,
  ChannelPresence,
  PresenceDelta,
  RealtimeUsage,
  RealtimeTenant,
  RealtimeTenantWithSecret,
  RealtimePlan,
  GetHistoryParams,
  // Canonical bare `ConnectOptions` (realtime owns it in the browser barrel).
  ConnectOptions,
} from "./clients/realtime.js";
// Realtime's SignupInput collides with changelog's (which is bare) — alias it.
export type { SignupInput as RealtimeSignupInput } from "./clients/realtime.js";

// ── Chat ─────────────────────────────────────────────────────────────────────
export { createChatClient } from "./clients/chat.js";
export type {
  ChatClient,
  ChatClientOptions,
  ConversationKind,
  Attachment,
  Message,
  Conversation,
  ConversationListItem,
  MyConversations,
  MessageHistory,
  SendResult,
  ReadResult,
  Presence,
  CreateConversationInput,
  SendMessageInput,
  ReadReceiptInput,
  ListConversationsParams,
  HistoryParams,
  TypingEvent,
  ReadEvent,
  MessageDeletedEvent,
  PresenceDeltaEvent,
  ChatErrorEvent,
  Ack,
  ChatServerEvents,
  Unsubscribe,
  ChatSocket,
} from "./clients/chat.js";
// Chat's ConnectOptions collides with realtime's (which is bare) — alias it.
export type { ConnectOptions as ChatConnectOptions } from "./clients/chat.js";
