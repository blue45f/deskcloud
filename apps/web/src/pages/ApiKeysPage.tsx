import { API_KEY_SCOPES, type ApiKeyCreatedDto, type ApiKeyScope } from '@termsdesk/shared'
import { KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useConfirm } from '@/app/useConfirm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CopyButton, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Label } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/services/admin'
import { formatDate, formatRelative } from '@/utils/format'

const SCOPE_LABEL: Record<ApiKeyScope, string> = {
  'read:current': '현재 버전 조회',
  'write:consent': '동의 기록',
  'read:consent': '동의 조회',
}

export default function ApiKeysPage() {
  useDocumentTitle('API 키')
  const keys = useApiKeys()
  const revoke = useRevokeApiKey()
  const confirm = useConfirm()
  const [created, setCreated] = useState<ApiKeyCreatedDto | null>(null)

  const onRevoke = async (id: string, name: string) => {
    const ok = await confirm({
      title: `'${name}' 키를 폐기할까요?`,
      description: '이 키로 동작하던 SDK·연동이 즉시 중단됩니다. 되돌릴 수 없습니다.',
      confirmText: '폐기',
      danger: true,
    })
    if (!ok) return
    revoke.mutate(id, {
      onSuccess: () => toast.success('키를 폐기했습니다'),
      onError: () => toast.error('폐기에 실패했습니다'),
    })
  }

  return (
    <>
      <PageHeader
        title="API 키"
        description="SDK가 현재 약관을 조회하고 동의 영수증을 기록할 때 사용하는 publishable 키입니다."
        actions={<CreateKeyDialog onCreated={setCreated} />}
      />

      {keys.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (keys.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="발급된 키가 없습니다"
          description="키를 발급해 앱에 SDK를 연동하세요."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <THead>
              <TR className="bg-surface-2/60">
                <TH>이름</TH>
                <TH>키</TH>
                <TH className="hidden md:table-cell">스코프</TH>
                <TH className="hidden sm:table-cell">마지막 사용</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {keys.data?.map((k) => (
                <TR key={k.id}>
                  <TD className="font-medium text-text">
                    {k.name}
                    {k.revokedAt ? (
                      <Badge tone="danger" size="sm" className="ml-2">
                        폐기됨
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-xs text-text-muted">{k.keyPrefix}…</TD>
                  <TD className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} tone="outline" size="sm">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD className="hidden text-xs text-text-subtle sm:table-cell">
                    {k.lastUsedAt ? formatRelative(k.lastUsedAt) : '사용 전'}
                  </TD>
                  <TD className="text-right">
                    {k.revokedAt ? (
                      <span className="text-xs text-text-subtle">{formatDate(k.revokedAt)}</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => void onRevoke(k.id, k.name)}
                      >
                        폐기
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Dialog open={created !== null} onOpenChange={(o) => !o && setCreated(null)}>
        {created ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API 키가 발급되었습니다</DialogTitle>
              <DialogDescription>
                이 키는 지금 한 번만 표시됩니다. 안전한 곳에 복사해 두세요.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
              <code className="truncate font-mono text-sm text-text">{created.plaintextKey}</code>
              <CopyButton value={created.plaintextKey} label="키 복사" />
            </div>
            <DialogFooter>
              <Button onClick={() => setCreated(null)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

function CreateKeyDialog({ onCreated }: { onCreated: (k: ApiKeyCreatedDto) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read:current', 'write:consent'])
  const create = useCreateApiKey()

  const toggle = (s: ApiKeyScope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const submit = () => {
    if (!name.trim() || scopes.length === 0) return
    create.mutate(
      { name: name.trim(), scopes },
      {
        onSuccess: (k) => {
          setOpen(false)
          setName('')
          onCreated(k)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '발급에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />키 발급
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API 키 발급</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="이름" htmlFor="keyname" required>
            <Input
              id="keyname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: Production Web"
            />
          </Field>
          <div>
            <Label>스코프</Label>
            <div className="space-y-2">
              {API_KEY_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-2.5 text-sm text-text">
                  <Checkbox checked={scopes.includes(s)} onChange={() => toggle(s)} />
                  <span>
                    <span className="font-mono text-xs text-text-muted">{s}</span>
                    <span className="ml-2 text-text-subtle">{SCOPE_LABEL[s]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!name.trim()}>
            발급
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
