import { Pencil, Plus, RotateCw, ScanText, ShieldX, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { RuleDto } from '@moderationdesk/shared'

import { RuleDialog } from '@/components/feature/RuleDialog'
import { RuleActionBadge, RuleKindBadge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDeleteRule, useRules, useUpdateRule } from '@/services/moderation'
import { formatDate } from '@/utils/format'

export default function RulesPage() {
  useDocumentTitle('금칙 규칙')
  const credKey = useCredKey()
  const rulesQ = useRules(credKey)
  const updateRule = useUpdateRule(credKey)
  const deleteRule = useDeleteRule(credKey)

  const [editing, setEditing] = useState<RuleDto | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toDelete, setToDelete] = useState<RuleDto | null>(null)

  const rules = rulesQ.data ?? []

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (rule: RuleDto) => {
    setEditing(rule)
    setDialogOpen(true)
  }

  const toggleEnabled = (rule: RuleDto, next: boolean) => {
    updateRule.mutate(
      { id: rule.id, input: { enabled: next } },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : '변경에 실패했습니다.'),
      }
    )
  }

  const confirmDelete = () => {
    if (!toDelete) return
    deleteRule.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('규칙이 삭제되었습니다.')
        setToDelete(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.'),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">금칙 규칙</h1>
          <p className="mt-1 max-w-2xl text-sm text-pretty text-text-muted">
            금칙어·부분일치·정규식 규칙을 정의합니다. 검사 시 활성 규칙만 평가되고, 매칭된 액션 중
            가장 강한 것(block &gt; flag)이 verdict 가 됩니다.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          규칙 추가
        </Button>
      </div>

      <Card>
        {rulesQ.isLoading ? (
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        ) : rulesQ.isError ? (
          <CardContent>
            <EmptyState
              icon={ShieldX}
              title="규칙을 불러오지 못했습니다"
              description={
                rulesQ.error instanceof Error ? rulesQ.error.message : '잠시 후 다시 시도해 주세요.'
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void rulesQ.refetch()}
                  loading={rulesQ.isFetching}
                >
                  <RotateCw className="size-4" />
                  다시 시도
                </Button>
              }
            />
          </CardContent>
        ) : rules.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={ScanText}
              title="아직 규칙이 없습니다"
              description="첫 금칙 규칙을 추가하면 검사가 해당 패턴을 차단·주의로 분류하기 시작합니다."
              action={
                <Button size="sm" variant="accent" onClick={openCreate}>
                  규칙 추가
                </Button>
              }
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>패턴</TH>
                <TH>종류</TH>
                <TH>액션</TH>
                <TH>생성</TH>
                <TH className="text-center">활성</TH>
                <TH className="text-right">관리</TH>
              </TR>
            </THead>
            <TBody>
              {rules.map((r) => (
                <TR key={r.id} className="hover:bg-surface-2/60">
                  <TD className="max-w-xs">
                    <div className="min-w-0">
                      <code className="block truncate font-mono text-[0.8125rem] text-text">
                        {r.pattern}
                      </code>
                      {r.label ? <span className="text-xs text-text-subtle">{r.label}</span> : null}
                    </div>
                  </TD>
                  <TD>
                    <RuleKindBadge kind={r.kind} />
                  </TD>
                  <TD>
                    <RuleActionBadge action={r.action} />
                  </TD>
                  <TD className="whitespace-nowrap text-text-muted">{formatDate(r.createdAt)}</TD>
                  <TD className="text-center">
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => toggleEnabled(r, v)}
                      aria-label={`${r.pattern} 규칙 ${r.enabled ? '비활성화' : '활성화'}`}
                    />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="수정">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(r)}
                          aria-label="규칙 수정"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="삭제">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(r)}
                          aria-label="규칙 삭제"
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
        )}
      </Card>

      <RuleDialog rule={editing} credKey={credKey} open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>규칙을 삭제할까요?</DialogTitle>
            <DialogDescription>
              <code className="font-mono text-text">{toDelete?.pattern}</code> 규칙을 영구
              삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">취소</Button>
            </DialogClose>
            <Button variant="danger" onClick={confirmDelete} loading={deleteRule.isPending}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
