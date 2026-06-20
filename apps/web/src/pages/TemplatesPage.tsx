import { type TemplateDto } from '@notifydesk/shared'
import { FileStack, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { TemplateEditorDialog } from '@/components/feature/TemplateEditorDialog'
import { ChannelBadge } from '@/components/ui/badge'
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
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useDeleteTemplate, useTemplates } from '@/services/notifications'
import { formatDate } from '@/utils/format'

export default function TemplatesPage() {
  useDocumentTitle('템플릿')
  const templates = useTemplates()
  const del = useDeleteTemplate()

  // 에디터 다이얼로그: editorKey 로 remount(초기값 리셋). null=닫힘.
  const [editing, setEditing] = useState<{ template: TemplateDto | null; nonce: number } | null>(
    null
  )
  const [toDelete, setToDelete] = useState<TemplateDto | null>(null)

  // 에디터를 열 때마다 단조 증가하는 nonce 로 remount(초기값 리셋).
  // Date.now() 는 렌더 중 불순 호출(react-hooks/purity)이라 ref 카운터를 쓴다.
  const nonceRef = useRef(0)
  const nextNonce = () => (nonceRef.current += 1)
  const openCreate = () => setEditing({ template: null, nonce: nextNonce() })
  const openEdit = (t: TemplateDto) => setEditing({ template: t, nonce: nextNonce() })

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.key)
      toast.success(`템플릿 '${toDelete.key}' 을(를) 삭제했습니다.`)
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '삭제에 실패했습니다.')
    }
  }

  const list = templates.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">템플릿</h1>
          <p className="mt-1 text-sm text-text-muted">
            알림 종류별 채널·제목·본문 정의. 발송 시 변수만 넘기면 됩니다.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 새 템플릿
        </Button>
      </div>

      {templates.isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </CardContent>
        </Card>
      ) : templates.isError ? (
        <ErrorState
          title="템플릿을 불러오지 못했습니다"
          description="네트워크 또는 인증 문제일 수 있습니다. 다시 시도해 주세요."
          onRetry={() => void templates.refetch()}
          retrying={templates.isFetching}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="아직 템플릿이 없습니다"
          description="첫 템플릿을 만들어 알림 본문을 재사용하세요."
          action={
            <Button size="sm" variant="accent" onClick={openCreate}>
              <Plus className="size-4" /> 템플릿 만들기
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>key</TH>
                <TH>채널</TH>
                <TH>제목</TH>
                <TH>수정일</TH>
                <TH className="text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((t) => (
                <TR key={t.key}>
                  <TD className="font-mono text-[0.8125rem]">{t.key}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {t.channels.map((c) => (
                        <ChannelBadge key={c} channel={c} />
                      ))}
                    </div>
                  </TD>
                  <TD className="max-w-[20ch] truncate text-text-muted">{t.subject ?? '—'}</TD>
                  <TD className="text-text-subtle">{formatDate(t.updatedAt)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="수정">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${t.key} 수정`}
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="삭제">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${t.key} 삭제`}
                          onClick={() => setToDelete(t)}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </Tooltip>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {editing ? (
        <TemplateEditorDialog
          key={editing.nonce}
          open
          onOpenChange={(v) => {
            if (!v) setEditing(null)
          }}
          template={editing.template}
        />
      ) : null}

      <Dialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿을 삭제할까요?</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-text">{toDelete?.key}</span> 템플릿을 삭제합니다. 이미
              발송된 알림은 영향받지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" loading={del.isPending} onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
