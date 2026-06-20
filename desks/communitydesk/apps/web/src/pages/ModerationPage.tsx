import {
  CONTENT_STATUSES,
  type AdminPostDto,
  type ContentStatus,
  type PostModerationAction,
} from '@communitydesk/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PostDetail } from '@/components/feature/PostDetail'
import { ReactionChips } from '@/components/feature/ReactionChips'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import { Tooltip } from '@/components/ui/tooltip'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import {
  deletePost,
  listBoards,
  listPosts,
  moderatePost,
  type AdminPostsResult,
} from '@/services/community'
import { relativeTime } from '@/utils/format'
import { filterPostsBySearch } from '@/utils/postSearch'

const STATUS_LABEL: Record<ContentStatus, string> = {
  visible: '노출',
  hidden: '숨김',
  pending: '검수 대기',
}

const PAGE_SIZE = 20

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

function isContentStatus(v: string): v is ContentStatus {
  return (CONTENT_STATUSES as readonly string[]).includes(v)
}

interface PostActionsProps {
  post: AdminPostDto
  onAction: (action: PostModerationAction) => void
  onDelete: () => void
  busy: boolean
}

function PostActions({ post, onAction, onDelete, busy }: PostActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {post.status !== 'visible' ? (
        <Tooltip content={post.status === 'pending' ? '승인(노출)' : '다시 노출'}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onAction(post.status === 'pending' ? 'approve' : 'show')}
            aria-label="노출"
          >
            {post.status === 'pending' ? (
              <ShieldCheck className="size-4 text-success" />
            ) : (
              <Eye className="size-4 text-success" />
            )}
          </Button>
        </Tooltip>
      ) : (
        <Tooltip content="숨김">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onAction('hide')}
            aria-label="숨김"
          >
            <EyeOff className="size-4" />
          </Button>
        </Tooltip>
      )}

      <Tooltip content={post.pinned ? '고정 해제' : '상단 고정'}>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={() => onAction(post.pinned ? 'unpin' : 'pin')}
          aria-label={post.pinned ? '고정 해제' : '고정'}
        >
          {post.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
      </Tooltip>

      <Tooltip content={post.locked ? '잠금 해제' : '댓글 잠금'}>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={() => onAction(post.locked ? 'unlock' : 'lock')}
          aria-label={post.locked ? '잠금 해제' : '잠금'}
        >
          {post.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </Button>
      </Tooltip>

      <Tooltip content="삭제">
        <Button variant="ghost" size="icon-sm" disabled={busy} onClick={onDelete} aria-label="삭제">
          <Trash2 className="size-4 text-danger" />
        </Button>
      </Tooltip>
    </div>
  )
}

export default function ModerationPage() {
  useDocumentTitle('검수 큐')
  const qc = useQueryClient()

  // 필터를 URL 쿼리에 반영 — 대시보드 등에서 ?status=pending 으로 진입하면 그 상태로 열린다.
  const [params, setParams] = useSearchParams()
  const boardSlug = params.get('board') ?? ''
  const statusParam = params.get('status') ?? ''
  const status: '' | ContentStatus = isContentStatus(statusParam) ? statusParam : ''
  const tag = params.get('tag') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0)

  // 한 필터만 바꾸고 page 는 0 으로 리셋(서버 결과가 달라지므로). 빈 값은 키를 제거해 URL 정리.
  const patchParams = (patch: Record<string, string>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true }
    )
  }
  const setFilter = (patch: Record<string, string>) => patchParams({ ...patch, page: '' })
  const setPage = (p: number) => patchParams({ page: p > 0 ? String(p) : '' })

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const searchRef = useRef<HTMLInputElement>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [toDelete, setToDelete] = useState<AdminPostDto | null>(null)

  const boardsQ = useQuery({ queryKey: ['boards'], queryFn: listBoards })

  const query = {
    boardSlug: boardSlug || undefined,
    status: status || undefined,
    tag: tag.trim() || undefined,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  }
  const postsQ = useQuery<AdminPostsResult>({
    queryKey: ['posts', query],
    queryFn: () => listPosts(query),
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['posts'] })

  const moderateMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: PostModerationAction }) =>
      moderatePost(id, action),
    onSuccess: () => {
      toast.success('적용했습니다.')
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e, '적용에 실패했습니다.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      toast.success('글을 삭제했습니다.')
      setToDelete(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e, '삭제에 실패했습니다.')),
  })

  // 일괄 운영 — 선택된 글에 같은 액션을 차례로 적용(부분 실패도 합산 보고).
  const bulkMut = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: PostModerationAction }) => {
      const results = await Promise.allSettled(ids.map((id) => moderatePost(id, action)))
      return results.reduce((acc, r) => acc + (r.status === 'fulfilled' ? 1 : 0), 0)
    },
    onSuccess: (ok, { ids }) => {
      if (ok === ids.length) toast.success(`${ok}건에 적용했습니다.`)
      else toast.warning(`${ok}/${ids.length}건에 적용했습니다. 일부는 실패했습니다.`)
      setSelected(new Set())
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e, '일괄 적용에 실패했습니다.')),
  })

  const allItems = useMemo(() => postsQ.data?.items ?? [], [postsQ.data])
  const total = postsQ.data?.total ?? 0
  const boards = boardsQ.data ?? []

  // 현재 페이지 안에서 키워드로 한 번 더 좁힌다(서버 필터 + 클라이언트 빠른 검색).
  const items = useMemo(
    () => filterPostsBySearch(allItems, debouncedSearch),
    [allItems, debouncedSearch]
  )
  const visibleIds = useMemo(() => items.map((p) => p.id), [items])

  // 선택은 항상 "지금 보이는 글"과 교차해 파생하므로(아래 selectedIds), 페이지/검색이
  // 바뀌어도 화면에서 사라진 글은 자동으로 선택에서 빠진다 — 별도 정리 effect 불필요.

  // '/' 로 검색에 포커스(입력 중이 아닐 때만) — 검수 작업의 키보드 단축.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (typing) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))

  const selectedIds = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected]
  )
  const runBulk = (action: PostModerationAction) => {
    if (selectedIds.length === 0) return
    bulkMut.mutate({ ids: selectedIds, action })
  }

  const hasActiveFilters = Boolean(boardSlug || status || tag || search)
  const clearAll = () => {
    setSearch('')
    setParams({}, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">검수 큐</h1>
        <p className="mt-1 text-sm text-text-muted">
          글을 노출·숨김·고정·잠금하거나 삭제합니다. 글을 펼치면 본문과 댓글을 검수할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="게시판" htmlFor="f-board">
              <Select
                id="f-board"
                value={boardSlug}
                onChange={(e) => setFilter({ board: e.target.value })}
              >
                <option value="">전체 게시판</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name} ({b.slug})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="상태" htmlFor="f-status">
              <Select
                id="f-status"
                value={status}
                onChange={(e) => setFilter({ status: e.target.value })}
              >
                <option value="">전체 상태</option>
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="태그" htmlFor="f-tag">
              <Input
                id="f-tag"
                value={tag}
                onChange={(e) => setFilter({ tag: e.target.value })}
                placeholder="태그로 필터"
                className="font-mono"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이 페이지에서 제목·작성자·본문 검색  (단축키 /)"
                aria-label="현재 페이지 글 검색"
                className="pl-8"
              />
            </div>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <X className="size-4" /> 필터 초기화
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 일괄 작업 바 — 선택된 글이 있을 때만 */}
      {selectedIds.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-strong/40 bg-accent-soft/40 px-4 py-2.5"
          role="region"
          aria-label="일괄 작업"
        >
          <span className="text-sm font-medium text-text">{selectedIds.length}건 선택됨</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              loading={bulkMut.isPending}
              onClick={() => runBulk('approve')}
            >
              <ShieldCheck className="size-4 text-success" /> 승인
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={bulkMut.isPending}
              onClick={() => runBulk('show')}
            >
              <Eye className="size-4 text-success" /> 노출
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={bulkMut.isPending}
              onClick={() => runBulk('hide')}
            >
              <EyeOff className="size-4" /> 숨김
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-4" /> 선택 해제
            </Button>
          </div>
        </div>
      ) : null}

      {/* 목록 */}
      <Card>
        <CardContent className="p-0">
          {postsQ.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : postsQ.isError ? (
            <div className="p-5">
              <ErrorState
                title="글을 불러오지 못했습니다"
                error={postsQ.error}
                retrying={postsQ.isFetching}
                onRetry={() => void postsQ.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title={
                  debouncedSearch ? '검색어에 맞는 글이 없습니다' : '조건에 맞는 글이 없습니다'
                }
                description={
                  debouncedSearch
                    ? '검색어를 지우거나 다른 키워드로 찾아보세요.'
                    : '필터를 바꾸거나, 위젯이 글을 받기 시작하면 여기에 표시됩니다.'
                }
              />
            </div>
          ) : (
            <>
              {/* 전체 선택 헤더 */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label={allSelected ? '이 페이지 선택 해제' : '이 페이지 전체 선택'}
                />
                <span className="text-xs text-text-subtle">
                  이 페이지 {items.length}건{debouncedSearch ? ` (검색 결과)` : ''}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {items.map((p) => {
                  const open = expanded === p.id
                  const checked = selected.has(p.id)
                  const busy =
                    (moderateMut.isPending && moderateMut.variables?.id === p.id) ||
                    (deleteMut.isPending && deleteMut.variables === p.id) ||
                    (bulkMut.isPending && checked)
                  return (
                    <li key={p.id} className={checked ? 'bg-accent-soft/20' : undefined}>
                      <div className="flex items-start gap-3 px-5 py-3.5">
                        <Checkbox
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleSelect(p.id)}
                          aria-label={`${p.title || '제목 없음'} 선택`}
                        />
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : p.id)}
                          className="mt-0.5 shrink-0 rounded p-0.5 text-text-subtle transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
                          aria-label={open ? '접기' : '펼치기'}
                          aria-expanded={open}
                        >
                          {open ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-text">
                              {p.title || '(제목 없음)'}
                            </span>
                            <StatusBadge status={p.status} />
                            {p.pinned ? (
                              <Badge tone="accent" size="sm">
                                <Pin className="size-3" /> 고정
                              </Badge>
                            ) : null}
                            {p.locked ? (
                              <Badge tone="neutral" size="sm">
                                <Lock className="size-3" /> 잠금
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-text-subtle">
                            <span className="font-mono">{p.boardSlug}</span> · {p.authorName} ·{' '}
                            {relativeTime(p.createdAt)} · 댓글 {p.replyCount}
                          </p>
                          {p.tags.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {p.tags.map((t) => {
                                const active = tag === t
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFilter({ tag: active ? '' : t })}
                                    aria-pressed={active}
                                    title={active ? '태그 필터 해제' : `#${t} 로 필터`}
                                    className={
                                      active
                                        ? 'rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6875rem] text-accent-fg transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong'
                                        : 'rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[0.6875rem] text-text-muted transition-colors hover:bg-accent-soft hover:text-accent-fg focus-visible:ring-2 focus-visible:ring-accent-strong'
                                    }
                                  >
                                    #{t}
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <ReactionChips reactions={p.reactions} />
                          <PostActions
                            post={p}
                            busy={busy}
                            onAction={(action) => moderateMut.mutate({ id: p.id, action })}
                            onDelete={() => setToDelete(p)}
                          />
                        </div>
                      </div>

                      {open ? (
                        <div className="border-t border-border bg-surface-2/40 px-5 py-4 sm:pl-12">
                          <PostDetail post={p} onChanged={invalidate} />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {/* 검색이 없을 때만 서버 페이지네이션(검색은 현재 페이지 내 필터라 페이지 이동과 무관) */}
              {!debouncedSearch ? (
                <Pagination
                  offset={page * PAGE_SIZE}
                  total={total}
                  count={allItems.length}
                  busy={postsQ.isFetching}
                  onPrev={() => setPage(page - 1)}
                  onNext={() => setPage(page + 1)}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>글을 삭제할까요?</DialogTitle>
            <DialogDescription>
              <strong className="text-text">{toDelete?.title || '(제목 없음)'}</strong> 와 그 댓글이
              함께 삭제됩니다. 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                취소
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
            >
              <Trash2 className="size-4" /> 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
