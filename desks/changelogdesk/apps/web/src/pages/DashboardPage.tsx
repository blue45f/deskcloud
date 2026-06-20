import { type ChangelogEntryDto, type CreateEntryInput, type EntryTag } from '@changelogdesk/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, FilePlus2, Filter, Inbox, Pencil, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EntryEditorDialog } from '@/components/feature/EntryEditorDialog'
import { PublishPill, TagBadge } from '@/components/ui/badge'
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
import { Select } from '@/components/ui/field'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createEntry, deleteEntry, listEntries, updateEntry } from '@/services/changelog'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

type TagFilter = 'all' | EntryTag
type StatusFilter = 'all' | 'published' | 'draft'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[0.8125rem] font-medium text-text-muted">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-text">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-text-subtle">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  useDocumentTitle('체인지로그')
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'entries'],
    queryFn: listEntries,
  })

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ChangelogEntryDto | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChangelogEntryDto | null>(null)
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // 키보드 단축키: "/" 로 검색 포커스(입력 중이 아닐 때만). esc 로 검색 비우기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'entries'] })

  const saveMutation = useMutation({
    mutationFn: (payload: CreateEntryInput) =>
      editing ? updateEntry(editing.id, payload) : createEntry(payload),
    onSuccess: () => {
      toast.success(editing ? '항목을 저장했습니다.' : '항목을 작성했습니다.')
      setEditorOpen(false)
      setEditing(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const togglePublish = useMutation({
    mutationFn: (entry: ChangelogEntryDto) =>
      updateEntry(entry.id, { isPublished: !entry.isPublished }),
    onSuccess: (updated) => {
      toast.success(updated.isPublished ? '게시되었습니다.' : '게시 해제되었습니다.')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => {
      toast.success('항목을 삭제했습니다.')
      setConfirmDelete(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = useMemo(() => data?.items ?? [], [data?.items])
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      items.filter((e) => {
        if (tagFilter !== 'all' && e.tag !== tagFilter) return false
        if (statusFilter === 'published' && !e.isPublished) return false
        if (statusFilter === 'draft' && e.isPublished) return false
        if (normalizedQuery) {
          const haystack = [e.title, e.bodyMarkdown, e.version, e.category]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(normalizedQuery)) return false
        }
        return true
      }),
    [items, tagFilter, statusFilter, normalizedQuery]
  )

  const publishedCount = items.filter((e) => e.isPublished).length
  const draftCount = items.length - publishedCount

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (entry: ChangelogEntryDto) => {
    setEditing(entry)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">체인지로그</h1>
          <p className="mt-1 text-pretty text-text-muted">
            변경 이력을 작성·게시하면 위젯에 즉시 노출됩니다.
          </p>
        </div>
        <Button variant="accent" onClick={openNew}>
          <FilePlus2 className="size-4" /> 새 항목
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 항목" value={String(items.length)} />
        <StatCard label="게시됨" value={String(publishedCount)} hint="위젯에 노출 중" />
        <StatCard label="초안" value={String(draftCount)} hint="미게시" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          {/* 검색 — 제목·본문·버전·카테고리. "/" 단축키로 포커스. */}
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  setQuery('')
                }
              }}
              placeholder="항목 검색…  (/)"
              aria-label="항목 검색"
              className="h-8 w-full rounded-md border border-border bg-bg pr-8 pl-8 text-xs text-text shadow-xs outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus-visible:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong/30 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
                aria-label="검색어 지우기"
                className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Filter className="size-4 text-text-subtle" aria-hidden />
          <div className="flex items-center gap-2">
            <label htmlFor="filter-tag" className="text-xs font-medium text-text-muted">
              태그
            </label>
            <Select
              id="filter-tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value as TagFilter)}
              className="h-8 w-auto pr-8 text-xs"
            >
              <option value="all">전체</option>
              <option value="new">신규</option>
              <option value="improved">개선</option>
              <option value="fixed">수정</option>
              <option value="announcement">공지</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="text-xs font-medium text-text-muted">
              상태
            </label>
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-8 w-auto pr-8 text-xs"
            >
              <option value="all">전체</option>
              <option value="published">게시됨</option>
              <option value="draft">초안</option>
            </Select>
          </div>
          <span className="ml-auto text-xs text-text-subtle">
            {filtered.length} / {items.length}건
          </span>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <ul className="divide-y divide-border" aria-busy="true" aria-label="목록을 불러오는 중">
              {[0, 1, 2, 3].map((key) => (
                <li key={key} className="flex items-start gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <ErrorState
              title="목록을 불러오지 못했습니다"
              description={(error as Error)?.message ?? undefined}
              onRetry={() => void refetch()}
              className="m-5 border-0"
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="아직 항목이 없습니다"
              description="첫 변경 이력을 작성해 보세요. 게시하면 위젯에 바로 나타납니다."
              action={
                <Button variant="accent" size="sm" onClick={openNew}>
                  <FilePlus2 className="size-4" /> 새 항목
                </Button>
              }
              className="m-5"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title={
                normalizedQuery
                  ? `"${query.trim()}" 검색 결과가 없습니다`
                  : '필터에 해당하는 항목이 없습니다'
              }
              description="검색어나 필터를 바꿔 보세요."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setTagFilter('all')
                    setStatusFilter('all')
                  }}
                >
                  필터 초기화
                </Button>
              }
              className="m-5 border-0"
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TagBadge tag={entry.tag} />
                      {entry.version ? (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-text-muted">
                          {entry.version}
                        </span>
                      ) : null}
                      <PublishPill published={entry.isPublished} />
                      {entry.category ? (
                        <span className="text-[0.6875rem] text-text-subtle">{entry.category}</span>
                      ) : null}
                    </div>
                    <h3
                      className={cn(
                        'mt-1.5 truncate text-sm font-semibold text-text',
                        !entry.isPublished && 'text-text-muted'
                      )}
                    >
                      {entry.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-text-subtle">
                      {entry.isPublished && entry.publishedAt
                        ? `${formatDate(entry.publishedAt)} 게시`
                        : `${formatDate(entry.createdAt)} 작성`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip content={entry.isPublished ? '게시 해제' : '게시'}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => togglePublish.mutate(entry)}
                        loading={
                          togglePublish.isPending && togglePublish.variables?.id === entry.id
                        }
                        aria-label={entry.isPublished ? '게시 해제' : '게시'}
                      >
                        {entry.isPublished ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip content="수정">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(entry)}
                        aria-label="수정"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="삭제">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfirmDelete(entry)}
                        aria-label="삭제"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-text-subtle">
        위젯이 실제로 어떻게 보이는지 궁금하다면{' '}
        <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
          데모
        </Link>{' '}
        에서 확인하세요.
      </p>

      <EntryEditorDialog
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v)
          if (!v) setEditing(null)
        }}
        entry={editing}
        onSubmit={(payload) => saveMutation.mutate(payload)}
        saving={saveMutation.isPending}
      />

      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>항목을 삭제할까요?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; 항목이 영구히 삭제됩니다. 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">취소</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={removeMutation.isPending}
              onClick={() => confirmDelete && removeMutation.mutate(confirmDelete.id)}
            >
              <Trash2 className="size-4" /> 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
