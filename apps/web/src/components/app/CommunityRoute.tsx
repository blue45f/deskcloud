import {
  AlertTriangle,
  ClipboardList,
  Coffee,
  Hash,
  Home,
  Loader2,
  LogIn,
  MessagesSquare,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { Board, CommunityClient, PostSummary } from '@heejun/deskcloud'

import {
  Chip,
  EmptyState,
  SearchField,
  SectionHeader,
  SegmentBar,
  Select,
} from '@/components/app/CommonUi'
import {
  addBoardPost,
  addPost,
  boardCategories,
  deleteBoardPost,
  deletePost,
  getCafeMemberCount,
  getMemberId,
  getNickname,
  isCafeMember,
  joinCafe,
  leaveCafe,
  listBoardPosts,
  listCafes,
  listChannels,
  listPosts,
  type BoardPost,
  type Cafe,
  type Channel,
  type Post,
} from '@/components/app/communityStore'
import { getCommunityClient } from '@/components/app/deskcloud'

type CommunityTab = 'chat' | 'board' | 'cafe'

/** 작성 시간을 "방금 전 / n분 전 / n시간 전 / n일 전 / 날짜"로 표기한다. */
function formatRelativeTime(iso: string): string {
  const created = new Date(iso).getTime()
  if (Number.isNaN(created)) return ''

  const diffMs = Date.now() - created
  if (diffMs < 0) return '방금 전'

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return '방금 전'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}일 전`

  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function MessageRow({
  post,
  canDelete,
  onDelete,
}: {
  post: Post
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <li className="rounded-md border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-text">{post.author}</span>
          <span className="text-xs text-text-subtle">{formatRelativeTime(post.createdAt)}</span>
        </div>
        {canDelete ? <DeleteButton label="내 메시지 삭제" onClick={onDelete} /> : null}
      </div>
      <p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-text-muted">{post.body}</p>
    </li>
  )
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-surface text-text-subtle transition hover:border-border-strong hover:text-text"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  )
}

/* ── 채팅방 탭 ───────────────────────────────────────────────────────── */

function ChatTab({ nickname }: { nickname: string }) {
  const channels = useMemo<Channel[]>(() => listChannels(), [])
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id ?? '')
  const [refreshToken, setRefreshToken] = useState(0)
  const refresh = () => setRefreshToken((token) => token + 1)
  const [draft, setDraft] = useState('')

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null

  const posts = useMemo<Post[]>(() => {
    void refreshToken
    return activeChannel ? listPosts(activeChannel.id) : []
  }, [activeChannel, refreshToken])

  const submit = () => {
    if (!activeChannel) return
    const body = draft.trim()
    if (!body) return

    addPost({ channelId: activeChannel.id, author: nickname, body })
    setDraft('')
    refresh()
  }

  const handleDelete = (id: string) => {
    deletePost(id)
    refresh()
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <SectionHeader
        icon={MessagesSquare}
        title="토론 채팅방"
        description="왼쪽에서 채널을 선택하고, 오른쪽 스레드에서 대화를 이어가세요."
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="채널 목록" className="min-w-0">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
            {channels.map((channel) => {
              const selected = channel.id === activeChannel?.id
              return (
                <li key={channel.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => setActiveChannelId(channel.id)}
                    className={
                      selected
                        ? 'flex w-full items-center gap-2 rounded-md border border-ink bg-ink px-3 py-2 text-left text-sm font-semibold text-ink-fg'
                        : 'flex w-full items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-left text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
                    }
                  >
                    <Hash className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{channel.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {activeChannel ? (
            <div className="space-y-4">
              <header className="rounded-md border border-border bg-bg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text">
                    <Hash className="size-3.5 text-accent" aria-hidden />
                    {activeChannel.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs text-text-subtle">
                    <Users className="size-3.5" aria-hidden />
                    {posts.length}개의 메시지
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-text-subtle">
                  {activeChannel.description} · {activeChannel.topic}
                </p>
              </header>

              <div className="max-h-[28rem] overflow-y-auto">
                {posts.length > 0 ? (
                  <ul className="space-y-2">
                    {posts.map((post) => (
                      <MessageRow
                        key={post.id}
                        post={post}
                        canDelete={post.author === nickname}
                        onDelete={() => handleDelete(post.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="첫 메시지를 남겨보세요"
                    body="이 채널에는 아직 대화가 없습니다. 아래 입력창에서 첫 메시지를 작성해 보세요."
                  />
                )}
              </div>

              <form
                className="space-y-3 rounded-md border border-border bg-bg p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                <label className="block">
                  <span className="text-xs font-semibold text-text-subtle">메시지</span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        submit()
                      }
                    }}
                    rows={3}
                    placeholder="메시지를 입력하세요. Enter로 전송, Shift+Enter로 줄바꿈."
                    className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                  />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-text-subtle">
                    <span className="font-semibold text-text-muted">{nickname}</span> 이름으로
                    작성됩니다.
                  </p>
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink bg-ink px-3.5 py-2 text-xs font-semibold text-ink-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="size-3.5" aria-hidden />
                    전송
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <EmptyState
              title="채널이 없습니다"
              body="표시할 채널이 없습니다. 페이지를 새로고침해 기본 채널을 다시 불러와 주세요."
            />
          )}
        </div>
      </div>
    </section>
  )
}

/* ── 게시판 글 행 ────────────────────────────────────────────────────── */

function BoardPostRow({
  post,
  canDelete,
  onDelete,
}: {
  post: BoardPost
  canDelete: boolean
  onDelete: () => void
}) {
  // 카페 게시판(`cafe:${id}`) 글은 카테고리 칩을 숨긴다.
  const showCategory = !post.category.startsWith('cafe:')
  return (
    <li className="rounded-md border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showCategory ? <Chip tone="accent">{post.category}</Chip> : null}
            <h4 className="text-sm font-semibold text-text">{post.title}</h4>
          </div>
          <p className="mt-1 text-xs text-text-subtle">
            <span className="font-semibold text-text-muted">{post.author}</span> ·{' '}
            {formatRelativeTime(post.createdAt)}
          </p>
        </div>
        {canDelete ? <DeleteButton label="내 글 삭제" onClick={onDelete} /> : null}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 whitespace-pre-wrap text-text-muted">
        {post.body}
      </p>
    </li>
  )
}

/* ── 게시판 작성 폼 ──────────────────────────────────────────────────── */

function BoardComposer({
  nickname,
  categoryOptions,
  initialCategory,
  onSubmit,
}: {
  nickname: string
  /** 선택 가능한 카테고리. 단일이면 셀렉트를 숨긴다(카페 게시판). */
  categoryOptions: readonly string[]
  initialCategory: string
  onSubmit: (input: { category: string; title: string; body: string }) => void
}) {
  const [category, setCategory] = useState<string>(initialCategory)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const canSubmit = title.trim().length > 0 && body.trim().length > 0

  const submit = () => {
    if (!canSubmit) return
    onSubmit({ category, title: title.trim(), body: body.trim() })
    setTitle('')
    setBody('')
  }

  return (
    <form
      className="space-y-3 rounded-md border border-border bg-bg p-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        {categoryOptions.length > 1 ? (
          <Select
            label="카테고리"
            value={category}
            onChange={setCategory}
            options={categoryOptions.map((value) => ({ value, label: value }))}
          />
        ) : null}
        <SearchField
          label="제목"
          value={title}
          onChange={setTitle}
          placeholder="제목을 입력하세요"
        />
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-text-subtle">내용</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="내용을 입력하세요."
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-subtle">
          <span className="font-semibold text-text-muted">{nickname}</span> 이름으로 작성됩니다.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink bg-ink px-3.5 py-2 text-xs font-semibold text-ink-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden />
          작성
        </button>
      </div>
    </form>
  )
}

/* ── 게시판 탭 ───────────────────────────────────────────────────────── */

function BoardTab({ nickname }: { nickname: string }) {
  const [refreshToken, setRefreshToken] = useState(0)
  const refresh = () => setRefreshToken((token) => token + 1)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const posts = useMemo<BoardPost[]>(() => {
    void refreshToken
    return activeCategory === 'all' ? listBoardPosts() : listBoardPosts(activeCategory)
  }, [activeCategory, refreshToken])

  const filterItems = useMemo(
    () => [
      { id: 'all', label: '전체' },
      ...boardCategories.map((category) => ({ id: category, label: category })),
    ],
    []
  )

  const handleSubmit = (input: { category: string; title: string; body: string }) => {
    addBoardPost({ ...input, author: nickname })
    setActiveCategory('all')
    refresh()
  }

  const handleDelete = (id: string) => {
    deleteBoardPost(id)
    refresh()
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <SectionHeader
        icon={ClipboardList}
        title="게시판"
        description="자유·질문·정보공유·후기 카테고리로 글을 정리해 공유하세요."
      />

      <div className="mt-5 space-y-4">
        <SegmentBar
          label="카테고리"
          items={filterItems}
          value={activeCategory}
          onChange={setActiveCategory}
        />

        {posts.length > 0 ? (
          <ul className="space-y-2">
            {posts.map((post) => (
              <BoardPostRow
                key={post.id}
                post={post}
                canDelete={post.author === nickname}
                onDelete={() => handleDelete(post.id)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="아직 글이 없습니다"
            body="이 카테고리에는 아직 글이 없습니다. 아래에서 첫 글을 작성해 보세요."
          />
        )}

        <BoardComposer
          nickname={nickname}
          categoryOptions={boardCategories}
          initialCategory={boardCategories[0]}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  )
}

/* ── 카페 카드 + 가입 시 미니 게시판 ─────────────────────────────────── */

function CafeCard({ cafe, nickname }: { cafe: Cafe; nickname: string }) {
  const [refreshToken, setRefreshToken] = useState(0)
  const refresh = () => setRefreshToken((token) => token + 1)

  const cafeCategory = `cafe:${cafe.id}`
  const joined = useMemo(() => {
    void refreshToken
    return isCafeMember(cafe.id)
  }, [cafe.id, refreshToken])
  const memberCount = useMemo(() => {
    void refreshToken
    return getCafeMemberCount(cafe.id)
  }, [cafe.id, refreshToken])
  const cafePosts = useMemo<BoardPost[]>(() => {
    void refreshToken
    return listBoardPosts(cafeCategory)
  }, [cafeCategory, refreshToken])

  const toggleMembership = () => {
    if (joined) {
      leaveCafe(cafe.id)
    } else {
      joinCafe(cafe.id)
    }
    refresh()
  }

  const handleSubmit = (input: { category: string; title: string; body: string }) => {
    addBoardPost({ ...input, author: nickname })
    refresh()
  }

  const handleDelete = (id: string) => {
    deleteBoardPost(id)
    refresh()
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-bg text-lg"
            aria-hidden
          >
            {cafe.emoji ?? '☕'}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">{cafe.name}</h3>
            <p className="mt-0.5 text-xs leading-5 text-text-muted">{cafe.description}</p>
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-text-subtle">
              <Users className="size-3.5" aria-hidden />
              멤버 {memberCount.toLocaleString('ko-KR')}명
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleMembership}
          aria-pressed={joined}
          className={
            joined
              ? 'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
              : 'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-ink-fg transition hover:opacity-90'
          }
        >
          <LogIn className="size-3.5" aria-hidden />
          {joined ? '탈퇴' : '가입'}
        </button>
      </div>

      {joined ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-text-subtle">
            <ClipboardList className="size-3.5" aria-hidden />이 카페 게시판
          </p>
          {cafePosts.length > 0 ? (
            <ul className="space-y-2">
              {cafePosts.map((post) => (
                <BoardPostRow
                  key={post.id}
                  post={post}
                  canDelete={post.author === nickname}
                  onDelete={() => handleDelete(post.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed border-border-strong bg-bg p-3 text-xs text-text-muted">
              아직 글이 없습니다. 첫 글을 남겨보세요.
            </p>
          )}
          <BoardComposer
            nickname={nickname}
            categoryOptions={[cafeCategory]}
            initialCategory={cafeCategory}
            onSubmit={handleSubmit}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-subtle">{cafe.topic}</p>
      )}
    </article>
  )
}

/* ── 카페 탭 ─────────────────────────────────────────────────────────── */

function CafeTab({ nickname }: { nickname: string }) {
  const cafes = useMemo<Cafe[]>(() => listCafes(), [])

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <SectionHeader
        icon={Coffee}
        title="카페"
        description="관심 주제의 카페에 가입하면 전용 미니 게시판이 열립니다."
      />

      <div className="mt-5">
        {cafes.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {cafes.map((cafe) => (
              <CafeCard key={cafe.id} cafe={cafe} nickname={nickname} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="카페가 없습니다"
            body="표시할 카페가 없습니다. 페이지를 새로고침해 기본 카페를 다시 불러와 주세요."
          />
        )}
      </div>
    </section>
  )
}

/* ── DeskCloud(CommunityDesk) 원격 연동 ──────────────────────────────────
 *
 * `getCommunityClient()` 가 클라이언트를 돌려주면(= env 설정됨) 게시판/카페 탭은
 * 실제 CommunityDesk 서비스를 읽고 쓴다. 미설정이면 위의 로컬 데모 탭을 그대로
 * 쓰므로(아래 CommunityRoute 의 분기 참고), 미설정 상태의 동작은 현재와 동일하다.
 *
 * 범위(의도적 한계):
 *   - 읽기: listBoards()(kind 로 게시판/카페 분리) + listPosts({ boardSlug, sort:'recent' }).
 *   - 쓰기: createPost({ boardSlug, title, body, authorName, authorMemberId }).
 *   - 반응(toggleReaction)·댓글(createComment)·삭제는 이 1차 연동에서 노출하지 않는다
 *     (원격 글은 호스트가 삭제 권한을 갖지 않으므로 삭제 버튼을 숨긴다).
 *   - 실시간 채팅방 탭은 별도 소켓 서비스가 필요하므로 항상 로컬을 유지한다.
 */

/** 로딩 스피너 행(접근성: status 라이브 리전). */
function RemoteLoadingRow({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-md border border-border bg-bg p-3 text-sm text-text-muted"
    >
      <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
      {label}
    </div>
  )
}

/** 친절한 한국어 에러 행(크래시 대신 인라인 표시). */
function RemoteErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-strong bg-bg p-3 text-sm text-text-muted"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden />
        {message}
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  )
}

/** 원격 글 요약 행(삭제 불가 — 호스트가 소유권을 갖지 않는다). */
function RemotePostRow({ post, showBoard }: { post: PostSummary; showBoard?: boolean }) {
  return (
    <li className="rounded-md border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        {showBoard ? <Chip tone="accent">{post.boardSlug}</Chip> : null}
        <h4 className="text-sm font-semibold text-text">{post.title ?? '(제목 없음)'}</h4>
      </div>
      <p className="mt-1 text-xs text-text-subtle">
        <span className="font-semibold text-text-muted">{post.authorName}</span> ·{' '}
        {formatRelativeTime(post.createdAt)} · 댓글 {post.replyCount}
      </p>
      {post.excerpt ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 whitespace-pre-wrap text-text-muted">
          {post.excerpt}
        </p>
      ) : null}
    </li>
  )
}

/**
 * 단일 원격 보드(게시판 또는 카페)의 글 목록 + 작성 폼.
 * 카페 게시판 작성 폼은 카테고리 셀렉트가 없으므로 boardSlug 를 카테고리로 고정한다.
 */
function RemoteBoardPanel({
  client,
  board,
  nickname,
}: {
  client: CommunityClient
  board: Board
  nickname: string
}) {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => {
    // 동기 setState 는 이벤트 핸들러에서만(react-hooks/set-state-in-effect 회피).
    setLoading(true)
    setError(null)
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    client
      .listPosts({ boardSlug: board.slug, sort: 'recent', signal: controller.signal })
      .then((list) => {
        if (active) setPosts(list.items)
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : '글을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [client, board.slug, reloadToken])

  const handleSubmit = (input: { category: string; title: string; body: string }) => {
    // category 는 폼 UI 호환용 필드라 원격에서는 boardSlug 로 대체한다.
    void input.category
    client
      .createPost({
        boardSlug: board.slug,
        title: input.title,
        body: input.body,
        authorName: nickname,
        authorMemberId: getMemberId(),
      })
      .then(() => {
        reload()
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '글을 등록하지 못했습니다.')
      })
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <RemoteLoadingRow label="글을 불러오는 중…" />
      ) : error ? (
        <RemoteErrorRow message={error} onRetry={reload} />
      ) : posts.length > 0 ? (
        <ul className="space-y-2">
          {posts.map((post) => (
            <RemotePostRow key={post.id} post={post} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="아직 글이 없습니다"
          body="이 게시판에는 아직 글이 없습니다. 아래에서 첫 글을 작성해 보세요."
        />
      )}

      <BoardComposer
        nickname={nickname}
        categoryOptions={[board.slug]}
        initialCategory={board.slug}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

/** boards 를 불러와 kind 로 필터링하는 공통 로더. */
function useRemoteBoards(client: CommunityClient, kind: Board['kind']) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    client
      .listBoards({ signal: controller.signal })
      .then((all) => {
        if (active) setBoards(all.filter((board) => board.kind === kind))
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [client, kind, reloadToken])

  return { boards, loading, error, reload }
}

/* ── 게시판 탭(원격) ─────────────────────────────────────────────────── */

function RemoteBoardTab({ client, nickname }: { client: CommunityClient; nickname: string }) {
  const { boards, loading, error, reload } = useRemoteBoards(client, 'board')
  const [activeSlug, setActiveSlug] = useState<string>('')

  const activeBoard = boards.find((board) => board.slug === activeSlug) ?? boards[0] ?? null

  const filterItems = useMemo(
    () => boards.map((board) => ({ id: board.slug, label: board.name })),
    [boards]
  )

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <SectionHeader
        icon={ClipboardList}
        title="게시판"
        description="CommunityDesk 게시판의 글을 최신순으로 보고 새 글을 작성하세요."
      />

      <div className="mt-5 space-y-4">
        {loading ? (
          <RemoteLoadingRow label="게시판을 불러오는 중…" />
        ) : error ? (
          <RemoteErrorRow message={error} onRetry={reload} />
        ) : activeBoard ? (
          <>
            {filterItems.length > 1 ? (
              <SegmentBar
                label="게시판"
                items={filterItems}
                value={activeBoard.slug}
                onChange={setActiveSlug}
              />
            ) : null}
            <RemoteBoardPanel
              key={activeBoard.slug}
              client={client}
              board={activeBoard}
              nickname={nickname}
            />
          </>
        ) : (
          <EmptyState
            title="게시판이 없습니다"
            body="CommunityDesk 에 등록된 게시판이 없습니다. 관리자 콘솔에서 게시판을 추가해 주세요."
          />
        )}
      </div>
    </section>
  )
}

/* ── 카페 탭(원격) ───────────────────────────────────────────────────── */

function RemoteCafeTab({ client, nickname }: { client: CommunityClient; nickname: string }) {
  const { boards, loading, error, reload } = useRemoteBoards(client, 'cafe')

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <SectionHeader
        icon={Coffee}
        title="카페"
        description="CommunityDesk 카페별 게시판의 글을 보고 새 글을 작성하세요."
      />

      <div className="mt-5">
        {loading ? (
          <RemoteLoadingRow label="카페를 불러오는 중…" />
        ) : error ? (
          <RemoteErrorRow message={error} onRetry={reload} />
        ) : boards.length > 0 ? (
          <div className="space-y-4">
            {boards.map((board) => (
              <article key={board.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-bg text-lg"
                    aria-hidden
                  >
                    ☕
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text">{board.name}</h3>
                    {board.description ? (
                      <p className="mt-0.5 text-xs leading-5 text-text-muted">
                        {board.description}
                      </p>
                    ) : null}
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-text-subtle">
                      <Users className="size-3.5" aria-hidden />글 {board.postCount.toLocaleString(
                        'ko-KR'
                      )}
                      개
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <RemoteBoardPanel client={client} board={board} nickname={nickname} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="카페가 없습니다"
            body="CommunityDesk 에 등록된 카페가 없습니다. 관리자 콘솔에서 카페를 추가해 주세요."
          />
        )}
      </div>
    </section>
  )
}

/* ── 커뮤니티 허브 ───────────────────────────────────────────────────── */

const tabItems: Array<{ id: CommunityTab; label: string }> = [
  { id: 'chat', label: '채팅방' },
  { id: 'board', label: '게시판' },
  { id: 'cafe', label: '카페' },
]

export function CommunityRoute({
  onNavigate,
  memberName,
}: {
  onNavigate: (route: AppRoute) => void
  memberName?: string | null
}) {
  const [tab, setTab] = useState<CommunityTab>('chat')
  const [nickname, setNickname] = useState<string>(() => memberName?.trim() || getNickname())

  const currentNickname = nickname.trim() || '게스트'

  // env 미설정이면 null → 게시판/카페 탭이 기존 로컬 데모로 폴백한다(현재 동작과 동일).
  // 채팅방 탭은 별도 소켓 서비스 영역이라 원격 여부와 무관하게 항상 로컬을 쓴다.
  const communityClient = useMemo(() => getCommunityClient(), [])
  const remote = communityClient !== null

  const renderTab = () => {
    switch (tab) {
      case 'chat':
        return <ChatTab nickname={currentNickname} />
      case 'board':
        return remote ? (
          <RemoteBoardTab client={communityClient} nickname={currentNickname} />
        ) : (
          <BoardTab nickname={currentNickname} />
        )
      case 'cafe':
        return remote ? (
          <RemoteCafeTab client={communityClient} nickname={currentNickname} />
        ) : (
          <CafeTab nickname={currentNickname} />
        )
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-accent">커뮤니티 · /community</p>
              <h1 className="mt-1 text-2xl font-semibold text-text">커뮤니티 · 채팅방·게시판·카페</h1>
              {remote ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                  채팅방에서 실시간 대화를, 게시판에서 카테고리별 글을, 카페에서 관심 주제 모임을
                  즐겨 보세요. 게시판·카페는 CommunityDesk 서비스에 연결되어 있어 글이 실제로
                  저장·공유되며, 채팅방은 아직 이 브라우저에만 저장되는 데모입니다.
                </p>
              ) : (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                  채팅방에서 실시간 대화를, 게시판에서 카테고리별 글을, 카페에서 관심 주제 모임을
                  즐겨 보세요. 이 공간은 데모 단계이며 모든 글과 가입 정보는 백엔드 없이 이
                  브라우저에만 저장됩니다.
                </p>
              )}
              <div className="mt-3">
                <Chip tone="amber">
                  {remote ? '베타 · 게시판·카페 연동' : '베타 · 브라우저 로컬 저장'}
                </Chip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털로
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <SegmentBar label="커뮤니티 메뉴" items={tabItems} value={tab} onChange={setTab} />
            <div className="w-full sm:w-56">
              <SearchField
                label="닉네임"
                value={nickname}
                onChange={setNickname}
                placeholder="게스트"
              />
            </div>
          </div>
        </section>

        {renderTab()}
      </div>
    </main>
  )
}
