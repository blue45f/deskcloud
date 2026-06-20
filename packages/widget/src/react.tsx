/**
 * @communitydesk/widget/react — 임베드 커뮤니티 위젯 컴포넌트.
 *
 *  - <CommunityBoard> : 게시판 하나를 렌더 — 글 목록(정렬·태그필터) → 글 열기 →
 *    중첩 댓글 → 글/댓글 작성(memberId 제공 시)·반응.
 *  - <CommunityFeed>  : 최근 글 요약(compact). 클릭하면 onOpenPost 콜백.
 *
 * 자급식(self-contained): 의존성은 react(peer) + @communitydesk/sdk(클라이언트)뿐.
 * 외부 CSS 프레임워크 0(스코프 `.cd-*` 인라인 스타일). 살균된 본문 HTML 은 서버가
 * 만들어 내려주므로 위젯은 그대로 렌더한다(추가 살균 불필요, 화이트리스트 출력).
 */

import {
  createCommunityBrowserClient,
  type CommunityBrowserClient,
} from '@communitydesk/sdk/browser'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import { BackIcon, CommentIcon, LockIcon, PinIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'
import { REACTION_META, REACTION_ORDER, relativeTime } from './util'

import type {
  BoardDto,
  CommentNodeDto,
  PostDetailDto,
  PostSort,
  PostSummaryDto,
  ReactionCounts,
  ReactionKind,
  ReactionTarget,
} from '@communitydesk/shared'

// ── 공통 props ────────────────────────────────────────────────────────────────

interface BaseProps {
  /** publishable 키(pk_...). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://community.example.com'. */
  endpoint: string
  /** 강조색(버튼/선택). 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색(대비 보장). 기본 흰색. */
  accentInk?: string
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유). 주면 publishableKey/endpoint 보다 우선. */
  client?: CommunityBrowserClient
}

export interface CommunityBoardProps extends BaseProps {
  /** 표시할 게시판 slug. 예: 'free', 'notice'. */
  boardSlug: string
  /** 엔드유저 식별자(호스트 앱이 보증). 있어야 글/댓글/반응 작성 UI 가 켜진다. */
  memberId?: string
  /** 작성 시 표기될 이름. 기본 '익명'. */
  memberName?: string
  /** 기본 정렬. 기본 'recent'. */
  defaultSort?: PostSort
  /** 한 페이지 글 수. 기본 20. */
  pageSize?: number
  /** 헤더에 보드 이름/설명 표시 여부. 기본 true. */
  showHeader?: boolean
}

export interface CommunityFeedProps extends BaseProps {
  /** 표시할 게시판 slug. */
  boardSlug: string
  /** 보여줄 최근 글 수. 기본 5. */
  limit?: number
  /** 피드 제목. 기본 '최근 글'. */
  title?: string
  /** 글 클릭 콜백(피드는 상세를 직접 열지 않음 — 호스트가 라우팅하거나 보드로 이동). */
  onOpenPost?: (post: PostSummaryDto) => void
}

function useClient(props: BaseProps): CommunityBrowserClient {
  const { client, publishableKey, endpoint, fetch: customFetch } = props
  return useMemo<CommunityBrowserClient>(
    () => client ?? createCommunityBrowserClient({ publishableKey, endpoint, fetch: customFetch }),
    [client, publishableKey, endpoint, customFetch]
  )
}

function rootStyleOf(accent: string, accentInk: string): CSSProperties {
  const theme: WidgetTheme = { accent, accentInk }
  return themeVars(theme) as CSSProperties
}

const SORT_LABELS: Record<PostSort, string> = {
  recent: '최신',
  popular: '인기',
  replies: '댓글순',
}

// ── <CommunityBoard> ────────────────────────────────────────────────────────

type View = { kind: 'list' } | { kind: 'detail'; postId: string }

export function CommunityBoard(props: CommunityBoardProps): ReactElement {
  const {
    boardSlug,
    memberId,
    memberName = '익명',
    defaultSort = 'recent',
    pageSize = 20,
    showHeader = true,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
  } = props

  const client = useClient(props)

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const [view, setView] = useState<View>({ kind: 'list' })
  const [board, setBoard] = useState<BoardDto | null>(null)

  // 보드 메타(이름/설명/kind) — 목록 요약엔 없으므로 boards 목록에서 찾는다.
  useEffect(() => {
    if (!showHeader) return
    let alive = true
    client
      .listBoards()
      .then((boards) => {
        if (alive) setBoard(boards.find((b) => b.slug === boardSlug) ?? null)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client, boardSlug, showHeader])

  const canPost = Boolean(memberId)

  return (
    <div className="cd-root" style={rootStyleOf(accent, accentInk)}>
      <div className="cd-card">
        {view.kind === 'list' ? (
          <BoardListView
            client={client}
            boardSlug={boardSlug}
            board={showHeader ? board : null}
            showHeader={showHeader}
            defaultSort={defaultSort}
            pageSize={pageSize}
            canPost={canPost}
            memberId={memberId}
            memberName={memberName}
            onOpen={(postId) => setView({ kind: 'detail', postId })}
          />
        ) : (
          <PostDetailView
            client={client}
            postId={view.postId}
            boardName={board?.name ?? boardSlug}
            canPost={canPost}
            memberId={memberId}
            memberName={memberName}
            onBack={() => setView({ kind: 'list' })}
          />
        )}
      </div>
    </div>
  )
}

// ── 목록 뷰 ──────────────────────────────────────────────────────────────────

interface BoardListViewProps {
  client: CommunityBrowserClient
  boardSlug: string
  board: BoardDto | null
  showHeader: boolean
  defaultSort: PostSort
  pageSize: number
  canPost: boolean
  memberId?: string
  memberName: string
  onOpen: (postId: string) => void
}

function BoardListView(props: BoardListViewProps): ReactElement {
  const {
    client,
    boardSlug,
    board,
    showHeader,
    defaultSort,
    pageSize,
    canPost,
    memberId,
    memberName,
    onOpen,
  } = props

  const [sort, setSort] = useState<PostSort>(defaultSort)
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<PostSummaryDto[]>([])
  const [total, setTotal] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [composing, setComposing] = useState(false)

  const load = useCallback(
    (reset: boolean) => {
      const offset = reset ? 0 : items.length
      if (reset) setPhase('loading')
      else setLoadingMore(true)
      const ctrl = new AbortController()
      client
        .listPosts(boardSlug, { sort, tag, limit: pageSize, offset }, ctrl.signal)
        .then((res) => {
          setTotal(res.total)
          setItems((prev) => (reset ? res.items : [...prev, ...res.items]))
          setPhase('ready')
          setLoadingMore(false)
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return
          setPhase('error')
          setLoadingMore(false)
          void e
        })
      return ctrl
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, boardSlug, sort, tag, pageSize]
  )

  // 정렬/태그 변경 시 처음부터 다시 로드
  useEffect(() => {
    const ctrl = load(true)
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, tag, boardSlug])

  const onCreated = useCallback(() => {
    setComposing(false)
    load(true)
  }, [load])

  return (
    <>
      {showHeader ? (
        <div className="cd-head">
          <div className="cd-head-top">
            <div>
              <h2 className="cd-title">{board?.name ?? boardSlug}</h2>
              {board?.description ? <p className="cd-desc">{board.description}</p> : null}
            </div>
            <span className="cd-head-spacer" />
            {board ? (
              <span className="cd-kind">{board.kind === 'cafe' ? '카페' : '게시판'}</span>
            ) : null}
          </div>

          <div className="cd-controls">
            <div className="cd-sort" role="group" aria-label="정렬">
              {(['recent', 'popular', 'replies'] as PostSort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="cd-sort-btn"
                  aria-pressed={sort === s}
                  onClick={() => setSort(s)}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
            {tag ? (
              <span className="cd-tagfilter">
                태그: #{tag}
                <button
                  type="button"
                  onClick={() => setTag(undefined)}
                  aria-label={`태그 ${tag} 필터 해제`}
                >
                  해제
                </button>
              </span>
            ) : null}
            <span className="cd-head-spacer" />
            {canPost ? (
              <button
                type="button"
                className="cd-btn cd-btn-primary cd-btn-sm"
                onClick={() => setComposing((v) => !v)}
                aria-expanded={composing}
              >
                {composing ? '닫기' : '글쓰기'}
              </button>
            ) : null}
          </div>

          {composing && canPost ? (
            <PostComposer
              client={client}
              boardSlug={boardSlug}
              memberId={memberId!}
              memberName={memberName}
              onCreated={onCreated}
              onCancel={() => setComposing(false)}
            />
          ) : null}
        </div>
      ) : null}

      {phase === 'loading' ? (
        <ListSkeleton />
      ) : phase === 'error' ? (
        <div className="cd-state" role="alert">
          <p className="cd-state-title">글을 불러오지 못했어요</p>
          <p className="cd-state-text">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="cd-btn cd-btn-primary cd-btn-sm"
              onClick={() => load(true)}
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="cd-state">
          <p className="cd-state-title">아직 글이 없어요</p>
          <p className="cd-state-text">
            {canPost ? '첫 글을 남겨 보세요.' : '곧 새 글이 올라올 거예요.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="cd-list">
            {items.map((p) => (
              <li className="cd-item" key={p.id}>
                <button type="button" className="cd-item-btn" onClick={() => onOpen(p.id)}>
                  <span className="cd-item-meta">
                    {p.pinned ? (
                      <span className="cd-pin">
                        <PinIcon />
                        고정
                      </span>
                    ) : null}
                    <span>{p.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{relativeTime(p.createdAt)}</span>
                    {p.locked ? (
                      <span className="cd-lock" title="잠긴 글">
                        <LockIcon />
                      </span>
                    ) : null}
                  </span>
                  {p.title ? <p className="cd-item-title">{p.title}</p> : null}
                  {p.excerpt ? <p className="cd-excerpt">{p.excerpt}</p> : null}
                  {p.tags.length > 0 ? (
                    <span className="cd-tags">
                      {p.tags.map((t) => (
                        <span key={t} className="cd-tagchip">
                          #{t}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <span className="cd-item-foot">
                    <span className="cd-stat">
                      <CommentIcon />
                      {p.replyCount}
                    </span>
                    <span className="cd-stat" aria-label="반응 수">
                      {reactionTotal(p.reactions)} 반응
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.length < total ? (
            <div style={{ padding: 14, textAlign: 'center' }}>
              <button
                type="button"
                className="cd-btn cd-btn-ghost cd-btn-sm"
                disabled={loadingMore}
                onClick={() => load(false)}
              >
                {loadingMore ? '불러오는 중…' : `더 보기 (${items.length}/${total})`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

// ── 상세 뷰 ──────────────────────────────────────────────────────────────────

interface PostDetailViewProps {
  client: CommunityBrowserClient
  postId: string
  boardName: string
  canPost: boolean
  memberId?: string
  memberName: string
  onBack: () => void
}

function PostDetailView(props: PostDetailViewProps): ReactElement {
  const { client, postId, boardName, canPost, memberId, memberName, onBack } = props
  const [post, setPost] = useState<PostDetailDto | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const load = useCallback(() => {
    setPhase('loading')
    const ctrl = new AbortController()
    client
      .getPost(postId, ctrl.signal)
      .then((p) => {
        setPost(p)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setPhase('error')
        void e
      })
    return ctrl
  }, [client, postId])

  useEffect(() => {
    const ctrl = load()
    return () => ctrl.abort()
  }, [load])

  // 상세 진입 시 제목으로 포커스 이동(라우트 포커스 관리·스크린리더 안내)
  useEffect(() => {
    if (phase === 'ready') headingRef.current?.focus()
  }, [phase])

  const replyTo = useCallback(
    async (parentId: string | undefined, body: string) => {
      if (!memberId) return
      await client.createComment(postId, {
        authorMemberId: memberId,
        authorName: memberName,
        body,
        parentId,
      })
      load()
    },
    [client, postId, memberId, memberName, load]
  )

  return (
    <>
      <div className="cd-detail-head">
        <button
          type="button"
          className="cd-back"
          aria-label={`${boardName} 목록으로`}
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <div>
          <div className="cd-byline" style={{ margin: 0 }}>
            {boardName}
          </div>
        </div>
      </div>

      {phase === 'loading' ? (
        <div className="cd-state" aria-busy="true">
          <div className="cd-spinner" />
          <p className="cd-state-text">글을 불러오는 중…</p>
        </div>
      ) : phase === 'error' || !post ? (
        <div className="cd-state" role="alert">
          <p className="cd-state-title">글을 불러오지 못했어요</p>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="cd-btn cd-btn-primary cd-btn-sm" onClick={load}>
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        <div className="cd-detail-body">
          <h2 className="cd-detail-title" tabIndex={-1} ref={headingRef}>
            {post.title ?? '(제목 없음)'}
          </h2>
          <div className="cd-byline">
            {post.authorName} · {relativeTime(post.createdAt)}
            {post.locked ? ' · 🔒 잠김' : ''}
          </div>

          {/* 서버 살균 HTML — 화이트리스트 출력이므로 그대로 렌더 */}
          <div className="cd-prose" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

          {post.tags.length > 0 ? (
            <span className="cd-tags" style={{ marginTop: 14 }}>
              {post.tags.map((t) => (
                <span key={t} className="cd-tagchip">
                  #{t}
                </span>
              ))}
            </span>
          ) : null}

          <ReactionBar
            client={client}
            targetType="post"
            targetId={post.id}
            counts={post.reactions}
            memberId={memberId}
          />

          <CommentsSection
            client={client}
            comments={post.comments}
            replyCount={post.replyCount}
            locked={post.locked}
            canPost={canPost && !post.locked}
            memberId={memberId}
            memberName={memberName}
            onReply={replyTo}
          />
        </div>
      )}
    </>
  )
}

// ── 댓글 섹션 + 트리 ─────────────────────────────────────────────────────────

interface CommentsSectionProps {
  client: CommunityBrowserClient
  comments: CommentNodeDto[]
  replyCount: number
  locked: boolean
  canPost: boolean
  memberId?: string
  memberName: string
  onReply: (parentId: string | undefined, body: string) => Promise<void>
}

function CommentsSection(props: CommentsSectionProps): ReactElement {
  const { client, comments, replyCount, locked, canPost, memberId, onReply } = props
  const headingId = useId()

  return (
    <section className="cd-comments" aria-labelledby={headingId}>
      <h3 className="cd-comments-h" id={headingId}>
        댓글 {replyCount}
      </h3>

      {canPost && memberId ? (
        <CommentComposer
          onSubmit={(body) => onReply(undefined, body)}
          placeholder="댓글을 남겨보세요"
        />
      ) : locked ? (
        <p className="cd-hint" role="status">
          잠긴 글에는 댓글을 달 수 없어요.
        </p>
      ) : !memberId ? (
        <p className="cd-hint">로그인하면 댓글을 남길 수 있어요.</p>
      ) : null}

      {comments.length === 0 ? (
        <p className="cd-hint" style={{ marginTop: 12 }}>
          첫 댓글을 남겨보세요.
        </p>
      ) : (
        <ul className="cd-ctree" style={{ marginTop: 4 }}>
          {comments.map((c) => (
            <CommentNode
              key={c.id}
              node={c}
              client={client}
              canPost={canPost}
              memberId={memberId}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface CommentNodeProps {
  node: CommentNodeDto
  client: CommunityBrowserClient
  canPost: boolean
  memberId?: string
  onReply: (parentId: string | undefined, body: string) => Promise<void>
}

function CommentNode(props: CommentNodeProps): ReactElement {
  const { node, client, canPost, memberId, onReply } = props
  const [replying, setReplying] = useState(false)

  return (
    <li className="cd-cnode">
      <div className="cd-cbody">
        <div className="cd-cmeta">
          <span className="cd-cauthor">{node.authorName}</span>
          <span className="cd-ctime">{relativeTime(node.createdAt)}</span>
        </div>
        {/* 서버 살균 HTML */}
        <div className="cd-ctext cd-prose" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />
        <div className="cd-cactions">
          <ReactionBar
            client={client}
            targetType="comment"
            targetId={node.id}
            counts={node.reactions}
            memberId={memberId}
            compact
          />
          {canPost ? (
            <button type="button" className="cd-link-btn" onClick={() => setReplying((v) => !v)}>
              {replying ? '취소' : '답글'}
            </button>
          ) : null}
        </div>
        {replying && canPost ? (
          <div className="cd-compose-inline">
            <CommentComposer
              placeholder="답글을 남겨보세요"
              autoFocus
              onSubmit={async (body) => {
                await onReply(node.id, body)
                setReplying(false)
              }}
            />
          </div>
        ) : null}
      </div>

      {node.children.length > 0 ? (
        <ul className="cd-children">
          {node.children.map((child) => (
            <CommentNode
              key={child.id}
              node={child}
              client={client}
              canPost={canPost}
              memberId={memberId}
              onReply={onReply}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

// ── 반응 바 ──────────────────────────────────────────────────────────────────

interface ReactionBarProps {
  client: CommunityBrowserClient
  targetType: ReactionTarget
  targetId: string
  counts: ReactionCounts
  memberId?: string
  /** 댓글용 컴팩트(좋아요만 노출). */
  compact?: boolean
}

function ReactionBar(props: ReactionBarProps): ReactElement {
  const { client, targetType, targetId, counts, memberId, compact } = props
  const [local, setLocal] = useState<ReactionCounts>(counts)
  const [mine, setMine] = useState<Set<ReactionKind>>(new Set())
  const [busy, setBusy] = useState<ReactionKind | null>(null)

  useEffect(() => setLocal(counts), [counts])

  const kinds = compact ? (['like', 'love'] as ReactionKind[]) : REACTION_ORDER

  const toggle = useCallback(
    async (kind: ReactionKind) => {
      if (!memberId || busy) return
      setBusy(kind)
      try {
        const res = await client.toggleReaction({ targetType, targetId, memberId, kind })
        setLocal(res.reactions)
        setMine((prev) => {
          const next = new Set(prev)
          if (res.active) next.add(kind)
          else next.delete(kind)
          return next
        })
      } catch {
        // 무시 — 다음 상호작용에서 재시도
      } finally {
        setBusy(null)
      }
    },
    [client, targetType, targetId, memberId, busy]
  )

  // 멤버가 없으면 카운트만(읽기 전용) 표시 — 0 인 종류는 숨김.
  const visible = kinds.filter((k) => memberId || (local[k] ?? 0) > 0)
  if (visible.length === 0 && !memberId) return <span />

  return (
    <div className="cd-reactions" role="group" aria-label="반응">
      {visible.map((k) => {
        const meta = REACTION_META[k]
        const count = local[k] ?? 0
        return (
          <button
            key={k}
            type="button"
            className="cd-react"
            aria-pressed={mine.has(k)}
            aria-label={`${meta.label} ${count}`}
            disabled={!memberId || busy === k}
            onClick={() => toggle(k)}
          >
            <span className="cd-emoji" aria-hidden="true">
              {meta.emoji}
            </span>
            {count > 0 ? <span className="cd-count">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// ── 작성 컴포넌트 ────────────────────────────────────────────────────────────

interface PostComposerProps {
  client: CommunityBrowserClient
  boardSlug: string
  memberId: string
  memberName: string
  onCreated: () => void
  onCancel: () => void
}

function PostComposer(props: PostComposerProps): ReactElement {
  const { client, boardSlug, memberId, memberName, onCreated, onCancel } = props
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const bodyId = useId()
  const tagsId = useId()

  const submit = useCallback(async () => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await client.createPost({
        boardSlug,
        authorMemberId: memberId,
        authorName: memberName,
        title: title.trim() || undefined,
        body: body.trim(),
        tags: tags
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
      })
      setTitle('')
      setBody('')
      setTags('')
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '작성에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }, [client, boardSlug, memberId, memberName, title, body, tags, submitting, onCreated])

  return (
    <div className="cd-compose" style={{ marginTop: 12, borderTop: 0, paddingTop: 0 }}>
      {error ? (
        <p className="cd-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cd-field">
        <label className="cd-label" htmlFor={titleId}>
          제목 (선택)
        </label>
        <input
          id={titleId}
          className="cd-input"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
        />
      </div>
      <div className="cd-field">
        <label className="cd-label" htmlFor={bodyId}>
          내용
        </label>
        <textarea
          id={bodyId}
          className="cd-textarea"
          value={body}
          maxLength={20000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="마크다운을 쓸 수 있어요 (**굵게**, `코드`, - 목록)"
        />
        <p className="cd-hint">마크다운 지원 · 작성자: {memberName}</p>
      </div>
      <div className="cd-field">
        <label className="cd-label" htmlFor={tagsId}>
          태그 (선택, 쉼표/공백 구분)
        </label>
        <input
          id={tagsId}
          className="cd-input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="질문, 후기"
        />
      </div>
      <div className="cd-compose-foot">
        <span className="cd-spacer" />
        <button type="button" className="cd-btn cd-btn-ghost cd-btn-sm" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className="cd-btn cd-btn-primary cd-btn-sm"
          disabled={submitting || !body.trim()}
          onClick={submit}
        >
          {submitting ? '게시 중…' : '게시'}
        </button>
      </div>
    </div>
  )
}

interface CommentComposerProps {
  onSubmit: (body: string) => Promise<void>
  placeholder?: string
  autoFocus?: boolean
}

function CommentComposer(props: CommentComposerProps): ReactElement {
  const { onSubmit, placeholder = '댓글을 입력하세요', autoFocus } = props
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(body.trim())
      setBody('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '댓글 작성에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }, [body, submitting, onSubmit])

  return (
    <div className="cd-compose-inline">
      {error ? (
        <p className="cd-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <textarea
        className="cd-textarea"
        style={{ minHeight: 64 }}
        value={body}
        maxLength={8000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter 로 빠른 전송
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
      />
      <div className="cd-compose-foot">
        <span className="cd-hint">⌘/Ctrl + Enter 로 전송</span>
        <span className="cd-spacer" />
        <button
          type="button"
          className="cd-btn cd-btn-primary cd-btn-sm"
          disabled={submitting || !body.trim()}
          onClick={submit}
        >
          {submitting ? '등록 중…' : '댓글 등록'}
        </button>
      </div>
    </div>
  )
}

// ── 로딩 스켈레톤 ────────────────────────────────────────────────────────────

function ListSkeleton(): ReactElement {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      {[0, 1, 2, 3].map((i) => (
        <div className="cd-skel" key={i}>
          <div className="cd-skel-line cd-w40" />
          <div className="cd-skel-line cd-w90" />
          <div className="cd-skel-line cd-w70" />
        </div>
      ))}
    </div>
  )
}

// ── <CommunityFeed> (compact) ───────────────────────────────────────────────

export function CommunityFeed(props: CommunityFeedProps): ReactElement {
  const {
    boardSlug,
    limit = 5,
    title = '최근 글',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    onOpenPost,
  } = props
  const client = useClient(props)

  const [items, setItems] = useState<PostSummaryDto[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .listPosts(boardSlug, { sort: 'recent', limit }, ctrl.signal)
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || !alive) return
        setPhase('error')
        void e
      })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [client, boardSlug, limit])

  return (
    <div className="cd-root" style={rootStyleOf(accent, accentInk)}>
      <div className="cd-card cd-feed">
        <div className="cd-feed-h">
          <h3>{title}</h3>
        </div>
        {phase === 'loading' ? (
          <ListSkeleton />
        ) : phase === 'error' ? (
          <div className="cd-state" role="alert">
            <p className="cd-state-text">불러오지 못했어요.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="cd-state">
            <p className="cd-state-text">아직 글이 없어요.</p>
          </div>
        ) : (
          items.map((p) => (
            <div className="cd-feed-item" key={p.id}>
              <button type="button" className="cd-feed-link" onClick={() => onOpenPost?.(p)}>
                <span className="cd-feed-title">{p.title ?? (p.excerpt || '(제목 없음)')}</span>
                <span className="cd-feed-meta">
                  <span>{p.authorName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{relativeTime(p.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>댓글 {p.replyCount}</span>
                </span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function reactionTotal(counts: ReactionCounts): number {
  let n = 0
  for (const v of Object.values(counts)) n += v ?? 0
  return n
}
