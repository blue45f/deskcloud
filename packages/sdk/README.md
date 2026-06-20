# @communitydesk/sdk

CommunityDesk 클라이언트 SDK — 의존성 0. **브라우저(publishable, pk)** 클라이언트와
**서버(secret, sk)** 어드민 헬퍼를 함께 제공합니다. 타입은 `@communitydesk/shared` 에서.

## 키 모델

| 키            | 노출           | 용도                                                   |
| ------------- | -------------- | ------------------------------------------------------ |
| `pk_…`        | 브라우저 안전  | 읽기 + 멤버를 대신한 글·댓글·반응 작성(`x-pk` 헤더)     |
| `sk_…`        | **서버 전용**  | 게시판 CRUD·검수·운영·테넌트 설정·키 회전(`x-sk` 헤더)  |
| `ADMIN_TOKEN` | 서버(셀프호스트) | 모든 테넌트 어드민(`x-admin-token`, 대상 테넌트 지정) |

엔드유저(호스트 앱의 사용자)는 호스트 앱이 넘겨주는 `memberId`/`memberName`(또는 익명
`anon:…`)으로 식별합니다. SDK 자체엔 인증 시스템이 없습니다 — 호스트 앱이 pk 로 보증합니다.

## 브라우저 클라이언트 (publishable)

```ts
import { createCommunityBrowserClient } from '@communitydesk/sdk/browser'

const cd = createCommunityBrowserClient({
  publishableKey: 'pk_…',
  endpoint: 'https://community.example.com',
})

const boards = await cd.listBoards()
const list = await cd.listPosts('free', { sort: 'popular', tag: 'qna', limit: 20 })
const post = await cd.getPost(list.items[0].id) // 상세 + 중첩 댓글 트리

// 멤버를 대신한 작성(호스트 앱이 memberId 보증)
await cd.createPost({ boardSlug: 'free', authorMemberId: 'u_42', authorName: '준호', body: '안녕하세요 **마크다운**', tags: ['인사'] })
await cd.createComment(post.id, { authorMemberId: 'u_42', authorName: '준호', body: '좋은 글이네요' })
await cd.toggleReaction({ targetType: 'post', targetId: post.id, memberId: 'u_42', kind: 'like' })
```

`Origin` 은 브라우저가 자동으로 보내며, 서버가 테넌트 `corsOrigins` 허용목록과 대조합니다.

## 어드민 클라이언트 (secret — 서버에서만)

```ts
import { createCommunityAdminClient } from '@communitydesk/sdk/admin'

const admin = createCommunityAdminClient({ secretKey: process.env.CD_SECRET_KEY!, endpoint })

await admin.createBoard({ slug: 'qna', name: '질문답변', kind: 'board' })
const { items } = await admin.listPosts({ status: 'pending' })
await admin.moderatePost(items[0].id, { action: 'approve' })
await admin.moderatePost(items[0].id, { action: 'pin' })
await admin.deleteComment('…')
```

글로벌 토큰(셀프호스트 운영자)으로 특정 테넌트를 다룰 때:

```ts
const admin = createCommunityAdminClient({
  adminToken: process.env.ADMIN_TOKEN!,
  tenantId: 'tenant-uuid', // 또는 publishableKey: 'pk_…'
  endpoint,
})
```

## 테넌트 셀프 가입

```ts
import { registerTenant } from '@communitydesk/sdk/browser'

const { tenant, publishableKey, secretKey } = await registerTenant(endpoint, {
  name: 'My App',
  corsOrigins: ['https://myapp.com'],
})
// secretKey 는 이 응답에서 단 한 번만 노출됩니다 — 서버에 안전히 보관하세요.
```

## 에러

- `NotFoundError` — 404(글/게시판 없음).
- `CommunityDeskError` — 그 외 4xx/5xx(`.status`, `.detail` 보존).

## 빌드 / 검증

```bash
pnpm --filter @communitydesk/sdk run build       # tsup(ESM/CJS/d.ts)
pnpm --filter @communitydesk/sdk run typecheck
pnpm --filter @communitydesk/sdk run test
```
