import { DEFAULT_INDEX, type DocumentDto, type DocumentInput } from '@searchdesk/shared'
import { FileJson, FilePlus2, Inbox, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CategoryBadge } from '@/components/ui/badge'
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
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useDeleteDoc, useDocs, useUpsertDocs } from '@/services/searchdesk'

const PAGE_SIZE = 10

// ── 문서 추가/수정 다이얼로그 ────────────────────────────────────────────────

interface DocFormState {
  id: string
  index: string
  title: string
  body: string
  url: string
  category: string
  tags: string
}

function emptyForm(): DocFormState {
  return { id: '', index: '', title: '', body: '', url: '', category: '', tags: '' }
}

function toForm(d: DocumentDto): DocFormState {
  return {
    id: d.id,
    index: d.index,
    title: d.title,
    body: d.body,
    url: d.url ?? '',
    category: d.category ?? '',
    tags: d.tags.join(', '),
  }
}

function DocDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: DocumentDto | null
}) {
  const upsert = useUpsertDocs()
  const [form, setForm] = useState<DocFormState>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof DocFormState, string>>>({})

  // 다이얼로그가 열릴 때 폼 초기화(편집 대상 반영).
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(editing ? toForm(editing) : emptyForm())
      setErrors({})
    }
  }

  const set =
    (k: keyof DocFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.id.trim()) next.id = '문서 id 가 필요합니다.'
    if (!form.title.trim()) next.title = '제목이 필요합니다.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const doc: DocumentInput = {
      id: form.id.trim(),
      index: form.index.trim() || DEFAULT_INDEX,
      title: form.title.trim(),
      body: form.body,
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      ...(form.category.trim() ? { category: form.category.trim() } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    }

    upsert.mutate(
      { document: doc },
      {
        onSuccess: (res) => {
          if (res.capExceeded) {
            toast.warning(
              'free 플랜 문서 캡을 초과해 일부가 거부되었습니다. pro 로 업그레이드하세요.'
            )
          } else {
            toast.success(editing ? '문서가 수정되었습니다.' : '문서가 색인되었습니다.')
          }
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>{editing ? '문서 수정' : '문서 추가'}</DialogTitle>
          <DialogDescription>
            같은 (인덱스, id)는 덮어씁니다(upsert). title·body 가 전문 검색 대상입니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="문서 id" htmlFor="doc-id" required error={errors.id}>
              <Input
                id="doc-id"
                value={form.id}
                onChange={set('id')}
                disabled={Boolean(editing)}
                placeholder="getting-started"
                className="font-mono"
              />
            </Field>
            <Field label="인덱스" htmlFor="doc-index" hint="미지정 시 default">
              <Input
                id="doc-index"
                value={form.index}
                onChange={set('index')}
                disabled={Boolean(editing)}
                placeholder={DEFAULT_INDEX}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="제목" htmlFor="doc-title" required error={errors.title}>
            <Input id="doc-title" value={form.title} onChange={set('title')} />
          </Field>

          <Field label="본문" htmlFor="doc-body" hint="검색 대상(선택). 빈 값도 허용.">
            <Textarea id="doc-body" value={form.body} onChange={set('body')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL" htmlFor="doc-url" hint="결과 클릭 시 이동(선택)">
              <Input
                id="doc-url"
                value={form.url}
                onChange={set('url')}
                placeholder="https://docs.example.com/…"
                className="font-mono"
              />
            </Field>
            <Field label="카테고리" htmlFor="doc-category" hint="패싯/필터(단일, 선택)">
              <Input
                id="doc-category"
                value={form.category}
                onChange={set('category')}
                placeholder="docs"
              />
            </Field>
          </div>

          <Field label="태그" htmlFor="doc-tags" hint="쉼표로 구분(선택)">
            <Input
              id="doc-tags"
              value={form.tags}
              onChange={set('tags')}
              placeholder="intro, setup"
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" loading={upsert.isPending}>
              {editing ? '수정 저장' : '색인하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── JSON 일괄 임포트 다이얼로그 ──────────────────────────────────────────────

const SAMPLE_JSON = `[
  {
    "id": "doc-1",
    "title": "Getting started",
    "body": "Install the SDK and run your first search.",
    "url": "https://docs.example.com/start",
    "category": "docs",
    "tags": ["intro"]
  }
]`

function BulkImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const upsert = useUpsertDocs()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setText('')
      setError('')
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('유효한 JSON 이 아닙니다.')
      return
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    if (arr.length === 0) {
      setError('문서가 비어 있습니다.')
      return
    }
    if (arr.length > 200) {
      setError('한 번에 최대 200건까지 임포트할 수 있습니다.')
      return
    }

    upsert.mutate(
      { documents: arr as DocumentInput[] },
      {
        onSuccess: (res) => {
          if (res.capExceeded) {
            toast.warning(`일부만 색인됨(${res.upserted}건) — free 캡 초과.`)
          } else {
            toast.success(`${res.upserted}건이 색인되었습니다.`)
          }
          onOpenChange(false)
        },
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : '임포트에 실패했습니다.')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>JSON 일괄 임포트</DialogTitle>
          <DialogDescription>
            문서 배열(최대 200건)을 붙여넣으세요. 각 항목은 id·title 필수,
            body·url·category·tags·index 선택.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label="문서 JSON" htmlFor="bulk-json" error={error || undefined}>
            <Textarea
              id="bulk-json"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={SAMPLE_JSON}
              className="min-h-56 font-mono text-xs"
              aria-invalid={error ? true : undefined}
            />
          </Field>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setText(SAMPLE_JSON)}>
              샘플 채우기
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" loading={upsert.isPending}>
              임포트
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── 페이지 ──────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  useDocumentTitle('문서')
  const [index, setIndex] = useState('')
  const [page, setPage] = useState(0)
  const docs = useDocs(index, page * PAGE_SIZE, PAGE_SIZE)
  const del = useDeleteDoc()

  const [docDialog, setDocDialog] = useState(false)
  const [editing, setEditing] = useState<DocumentDto | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<DocumentDto | null>(null)

  const total = docs.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openAdd = () => {
    setEditing(null)
    setDocDialog(true)
  }
  const openEdit = (d: DocumentDto) => {
    setEditing(d)
    setDocDialog(true)
  }

  const doDelete = (d: DocumentDto) => {
    del.mutate(
      { id: d.id, index: d.index },
      {
        onSuccess: () => {
          toast.success('문서가 삭제되었습니다.')
          setConfirmDelete(null)
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : '삭제에 실패했습니다.'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">문서</h1>
          <p className="mt-1 text-sm text-text-muted">
            색인 문서를 추가·수정·삭제하고, JSON 으로 일괄 임포트합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
            <FileJson className="size-4" /> JSON 임포트
          </Button>
          <Button size="sm" onClick={openAdd}>
            <FilePlus2 className="size-4" /> 문서 추가
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            value={index}
            onChange={(e) => {
              setIndex(e.target.value)
              setPage(0)
            }}
            placeholder="인덱스로 필터(빈 값 = 전체)"
            className="font-mono"
            aria-label="인덱스 필터"
          />
        </div>
        <span className="text-xs text-text-subtle">{total.toLocaleString()}건</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {docs.isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : docs.isError ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title="문서를 불러올 수 없습니다"
                description={
                  docs.error instanceof ApiError
                    ? docs.error.message
                    : '잠시 후 다시 시도해 주세요.'
                }
                action={
                  <Button size="sm" variant="secondary" onClick={() => void docs.refetch()}>
                    <RotateCcw className="size-4" /> 다시 시도
                  </Button>
                }
              />
            </div>
          ) : (docs.data?.items.length ?? 0) === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title="아직 색인된 문서가 없습니다"
                description="문서를 추가하거나 JSON 으로 일괄 임포트하면 여기에 표시됩니다."
                action={
                  <Button size="sm" variant="accent" onClick={openAdd}>
                    첫 문서 추가
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>제목 · id</TH>
                  <TH>인덱스</TH>
                  <TH>카테고리</TH>
                  <TH>태그</TH>
                  <TH className="text-right">작업</TH>
                </TR>
              </THead>
              <TBody>
                {docs.data!.items.map((d) => (
                  <TR key={`${d.index}:${d.id}`}>
                    <TD>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{d.title}</p>
                        <p className="truncate font-mono text-xs text-text-subtle">{d.id}</p>
                      </div>
                    </TD>
                    <TD>
                      <span className="font-mono text-xs text-text-muted">{d.index}</span>
                    </TD>
                    <TD>
                      {d.category ? (
                        <CategoryBadge value={d.category} />
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {d.tags.length > 0 ? (
                          d.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] text-text-muted"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                        {d.tags.length > 3 ? (
                          <span className="text-[0.6875rem] text-text-subtle">
                            +{d.tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(d)}
                          aria-label="수정"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDelete(d)}
                          aria-label="삭제"
                          className="text-danger hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-subtle">
            {page + 1} / {totalPages} 페이지
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              이전
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      ) : null}

      <DocDialog open={docDialog} onOpenChange={setDocDialog} editing={editing} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />

      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서를 삭제할까요?</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{confirmDelete?.id}</span> ({confirmDelete?.index}) 가
              인덱스에서 제거됩니다. 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              size="sm"
              loading={del.isPending}
              onClick={() => confirmDelete && doDelete(confirmDelete)}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
