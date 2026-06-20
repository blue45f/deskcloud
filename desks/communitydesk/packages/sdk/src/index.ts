/**
 * @communitydesk/sdk — CommunityDesk 클라이언트 SDK(의존성 0).
 *
 * - 브라우저(publishable, pk): `createCommunityBrowserClient` — 읽기 + 멤버 글/댓글/반응.
 * - 서버(secret, sk): `createCommunityAdminClient` — 게시판 CRUD·검수·운영·테넌트 설정.
 * - 테넌트 셀프 가입: `registerTenant`.
 *
 * 트리쉐이크를 위해 서브패스(`@communitydesk/sdk/browser`, `/admin`)로도 가져올 수 있다.
 * 도메인 타입(BoardDto·PostDetailDto 등)은 @communitydesk/shared 를 직접 import.
 */
export {
  createCommunityBrowserClient,
  registerTenant,
  type CommunityBrowserClient,
  type CommunityBrowserClientOptions,
} from './browser'

export {
  createCommunityAdminClient,
  type CommunityAdminClient,
  type CommunityAdminClientOptions,
} from './admin'

export {
  CommunityDeskError,
  NotFoundError,
  SDK_VERSION,
  type HttpClient,
  type HttpClientOptions,
  type RequestOptions,
} from './http'

// 편의 재노출 — SDK 만 import 해도 응답 타입을 함께 쓸 수 있게.
export type {
  BoardDto,
  CommentNodeDto,
  PostDetailDto,
  PostListDto,
  PostReceiptDto,
  PostSummaryDto,
  ReactionCounts,
  ReactionToggleDto,
  TenantCreatedDto,
  TenantDto,
} from '@communitydesk/shared'
