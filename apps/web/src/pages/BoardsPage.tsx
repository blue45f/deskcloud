import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { BoardDto, BoardKind } from '@communitydesk/shared'

import { BoardKindBadge } from '@/components/ui/badge'
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
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { createBoard, deleteBoard, listBoards, updateBoard } from '@/services/community'
import { formatNumber } from '@/utils/format'

interface FormState {
  slug: string
  name: string
  description: string
  kind: BoardKind
}

const EMPTY: FormState = { slug: '', name: '', description: '', kind: 'board' }

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export default function BoardsPage() {
  useDocumentTitle('게시판·카페')
  const qc = useQueryClient()
  const boardsQ = useQuery({ queryKey: ['boards'], queryFn: listBoards })

  const [editing, setEditing] = useState<BoardDto | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [formError, setFormError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<BoardDto | null>(null)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['boards'] })
    void qc.invalidateQueries({ queryKey: ['tenant'] })
  }

  const createMut = useMutation({
    mutationFn: () =>
      createBoard({
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
      }),
    onSuccess: () => {
      toast.success('게시판을 만들었습니다.')
      setCreating(false)
      setForm(EMPTY)
      invalidate()
    },
    onError: (e) => setFormError(errMsg(e, '생성에 실패했습니다.')),
  })

  const updateMut = useMutation({
    mutationFn: () =>
      updateBoard(editing!.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
      }),
    onSuccess: () => {
      toast.success('게시판을 수정했습니다.')
      setEditing(null)
      invalidate()
    },
    onError: (e) => setFormError(errMsg(e, '수정에 실패했습니다.')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      toast.success('게시판을 삭제했습니다.')
      setToDelete(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e, '삭제에 실패했습니다.')),
  })

  const openCreate = () => {
    setForm(EMPTY)
    setFormError(null)
    setCreating(true)
  }
  const openEdit = (b: BoardDto) => {
    setForm({ slug: b.slug, name: b.name, description: b.description ?? '', kind: b.kind })
    setFormError(null)
    setEditing(b)
  }

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.slug.trim() || !form.name.trim()) {
      setFormError('slug 와 이름은 필수입니다.')
      return
    }
    createMut.mutate()
  }
  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('이름은 필수입니다.')
      return
    }
    updateMut.mutate()
  }

  const boards = boardsQ.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">게시판·카페</h1>
          <p className="mt-1 text-sm text-text-muted">
            위젯이 붙일 게시판을 만들고 관리합니다. slug 는 위젯의 <code>boardSlug</code> 로 씁니다.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 새 게시판
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {boardsQ.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : boardsQ.isError ? (
            <div className="p-5">
              <ErrorState
                title="게시판을 불러오지 못했습니다"
                error={boardsQ.error}
                retrying={boardsQ.isFetching}
                onRetry={() => void boardsQ.refetch()}
              />
            </div>
          ) : boards.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={FolderOpen}
                title="게시판이 없습니다"
                description="첫 게시판이나 카페를 만들어 위젯에 붙이세요."
                action={
                  <Button size="sm" variant="accent" onClick={openCreate}>
                    <Plus className="size-4" /> 게시판 만들기
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>이름</TH>
                  <TH>slug</TH>
                  <TH>종류</TH>
                  <TH className="text-right">노출 글</TH>
                  <TH className="text-right">작업</TH>
                </TR>
              </THead>
              <TBody>
                {boards.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <div className="font-medium text-text">{b.name}</div>
                      {b.description ? (
                        <div className="mt-0.5 max-w-md truncate text-xs text-text-subtle">
                          {b.description}
                        </div>
                      ) : null}
                    </TD>
                    <TD className="font-mono text-xs text-text-muted">{b.slug}</TD>
                    <TD>
                      <BoardKindBadge kind={b.kind} />
                    </TD>
                    <TD className="text-right font-mono text-text-muted">
                      {formatNumber(b.postCount)}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(b)}
                          aria-label={`${b.name} 수정`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(b)}
                          aria-label={`${b.name} 삭제`}
                        >
                          <Trash2 className="size-4 text-danger" />
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

      {/* 생성 다이얼로그 */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 게시판·카페</DialogTitle>
            <DialogDescription>slug 는 생성 후 변경할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <Field
              label="slug"
              htmlFor="b-slug"
              required
              hint="소문자·숫자·하이픈. 예: free, notice"
            >
              <Input
                id="b-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="free"
                className="font-mono"
                autoFocus
              />
            </Field>
            <Field label="이름" htmlFor="b-name" required>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="자유게시판"
              />
            </Field>
            <Field label="설명 (선택)" htmlFor="b-desc">
              <Textarea
                id="b-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="이 게시판의 용도를 짧게 설명하세요."
              />
            </Field>
            <Field label="종류" htmlFor="b-kind">
              <Select
                id="b-kind"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as BoardKind }))}
              >
                <option value="board">게시판 (board)</option>
                <option value="cafe">카페 (cafe)</option>
              </Select>
            </Field>
            {formError ? (
              <p role="alert" className="text-xs text-danger">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  취소
                </Button>
              </DialogClose>
              <Button type="submit" loading={createMut.isPending}>
                만들기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시판 수정</DialogTitle>
            <DialogDescription>
              slug(<code className="font-mono">{editing?.slug}</code>)는 변경할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <Field label="이름" htmlFor="e-name" required>
              <Input
                id="e-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </Field>
            <Field label="설명 (선택)" htmlFor="e-desc">
              <Textarea
                id="e-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <Field label="종류" htmlFor="e-kind">
              <Select
                id="e-kind"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as BoardKind }))}
              >
                <option value="board">게시판 (board)</option>
                <option value="cafe">카페 (cafe)</option>
              </Select>
            </Field>
            {formError ? (
              <p role="alert" className="text-xs text-danger">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  취소
                </Button>
              </DialogClose>
              <Button type="submit" loading={updateMut.isPending}>
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시판을 삭제할까요?</DialogTitle>
            <DialogDescription>
              <strong className="text-text">{toDelete?.name}</strong> 와 그 안의 글·댓글이 함께
              삭제됩니다. 되돌릴 수 없습니다.
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
