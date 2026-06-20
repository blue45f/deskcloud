import { HardDrive, KeyRound, Plus, RefreshCw, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { RotateKeysResultDto } from '@mediadesk/shared'

import { KeyReveal, SecretKeyWarning } from '@/components/feature/KeyReveal'
import { UsageBar } from '@/components/feature/UsageBar'
import { Badge, PlanBadge, StorageBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/feedback'
import { Field, Input, Label } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMe, useRotateKeys, useStorageInfo, useUpdateTenant } from '@/services/media'

export default function SettingsPage() {
  useDocumentTitle('설정')
  const me = useMe()
  const storage = useStorageInfo()
  const update = useUpdateTenant()
  const rotate = useRotateKeys()

  const [name, setName] = useState('')
  const [origins, setOrigins] = useState<string[]>([])
  const [newOrigin, setNewOrigin] = useState('')
  const [pro, setPro] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<RotateKeysResultDto | null>(null)

  // me 로드되면 폼 초기화.
  useEffect(() => {
    if (me.data) {
      setName(me.data.name)
      setOrigins(me.data.corsOrigins)
      setPro(me.data.plan === 'pro')
    }
  }, [me.data])

  if (me.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!me.data) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        테넌트 정보를 불러오지 못했습니다. 마스터 토큰으로 로그인한 경우 단일 테넌트만 자동
        선택됩니다.
      </div>
    )
  }

  const tenant = me.data
  const allowAll = origins.includes('*')

  const addOrigin = () => {
    const v = newOrigin.trim()
    if (!v) return
    if (origins.includes(v)) {
      toast.error('이미 추가된 origin 입니다.')
      return
    }
    setOrigins((prev) => [...prev, v])
    setNewOrigin('')
  }

  const removeOrigin = (o: string) => setOrigins((prev) => prev.filter((x) => x !== o))

  const toggleAllowAll = (checked: boolean) => {
    setOrigins(checked ? ['*'] : origins.filter((o) => o !== '*'))
  }

  const save = () => {
    update.mutate(
      { name: name.trim() || tenant.name, plan: pro ? 'pro' : 'free', corsOrigins: origins },
      {
        onSuccess: () => toast.success('설정을 저장했습니다.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.'),
      }
    )
  }

  const confirmRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (res) => {
        setRotated(res)
        toast.success('키를 회전했습니다.')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : '키 회전에 실패했습니다.'),
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">설정</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-pretty text-text-muted">
          <span>{tenant.name}</span>
          <span className="text-text-subtle">·</span>
          <code className="font-mono text-text">{tenant.slug}</code>
          <PlanBadge plan={tenant.plan} />
          {storage.data ? <StorageBadge driver={storage.data.driver} /> : null}
        </p>
      </div>

      {/* 사용량 */}
      <Card>
        <CardHeader>
          <CardTitle>사용량</CardTitle>
          <CardDescription>현재 플랜 기준 저장 용량·자산 개수</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageBar usage={tenant.usage} />
        </CardContent>
      </Card>

      {/* 기본 + 플랜 */}
      <Card>
        <CardHeader>
          <CardTitle>워크스페이스</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="이름" htmlFor="settings-name">
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-4 py-3">
            <div>
              <Label htmlFor="settings-plan" className="mb-0.5">
                Pro 플랜
              </Label>
              <p className="text-xs text-text-subtle">
                켜면 저장 용량·개수 소프트 캡이 해제됩니다(데모).
              </p>
            </div>
            <Switch id="settings-plan" checked={pro} onCheckedChange={setPro} />
          </div>
        </CardContent>
      </Card>

      {/* CORS */}
      <Card>
        <CardHeader>
          <CardTitle>CORS 허용 Origin</CardTitle>
          <CardDescription>
            publishable 키로 브라우저에서 업로드/조회를 허용할 도메인. Origin 헤더가 이 목록에
            없으면 403.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-4 py-3">
            <div>
              <Label htmlFor="settings-allowall" className="mb-0.5">
                모든 Origin 허용 (*)
              </Label>
              <p className="text-xs text-text-subtle">
                개발/데모용. 운영에서는 명시 도메인만 허용하는 것을 권장합니다.
              </p>
            </div>
            <Switch id="settings-allowall" checked={allowAll} onCheckedChange={toggleAllowAll} />
          </div>

          {!allowAll ? (
            <>
              <div className="flex items-end gap-2">
                <Field
                  label="Origin 추가"
                  htmlFor="settings-neworigin"
                  hint="예: https://app.example.com"
                >
                  <Input
                    id="settings-neworigin"
                    value={newOrigin}
                    onChange={(e) => setNewOrigin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addOrigin()
                      }
                    }}
                    placeholder="https://app.example.com"
                    className="font-mono"
                  />
                </Field>
                <Button variant="secondary" onClick={addOrigin}>
                  <Plus className="size-4" />
                  추가
                </Button>
              </div>

              {origins.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {origins.map((o) => (
                    <li key={o}>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-text">
                        {o}
                        <button
                          type="button"
                          onClick={() => removeOrigin(o)}
                          aria-label={`${o} 제거`}
                          className="inline-grid size-4 place-items-center rounded text-text-subtle hover:text-danger focus-visible:ring-2 focus-visible:ring-accent-strong"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-subtle">
                  아직 허용된 origin 이 없습니다. 브라우저 업로드가 모두 차단됩니다(서버-투-서버는
                  키만으로 통과).
                </p>
              )}
            </>
          ) : (
            <Badge tone="warning">모든 Origin 허용 중</Badge>
          )}
        </CardContent>
      </Card>

      {/* 저장 */}
      <div className="flex justify-end">
        <Button onClick={save} loading={update.isPending}>
          <Save className="size-4" />
          설정 저장
        </Button>
      </div>

      {/* 스토리지 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>스토리지 어댑터</CardTitle>
        </CardHeader>
        <CardContent>
          {storage.data ? (
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-text-muted">
                <HardDrive className="size-4.5" aria-hidden />
              </div>
              <div className="min-w-0 text-sm">
                <p className="flex items-center gap-2 font-medium text-text">
                  <StorageBadge driver={storage.data.driver} />
                  {storage.data.transformAvailable ? (
                    <Badge tone="success" size="sm">
                      sharp 변환 ON
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      변환 OFF(원본 서빙)
                    </Badge>
                  )}
                </p>
                <p className="mt-1 font-mono text-xs break-all text-text-muted">
                  {storage.data.location}
                </p>
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </CardContent>
      </Card>

      {/* 키 회전 */}
      <Card>
        <CardHeader>
          <CardTitle>API 키</CardTitle>
          <CardDescription>
            회전하면 새 publishable/secret 키가 발급되고 이전 키는 즉시 무효가 됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeyReveal label="현재 Publishable 키 (pk_)" value={tenant.publishableKey} />
          <Button variant="secondary" onClick={() => setRotateOpen(true)}>
            <RefreshCw className="size-4" />키 회전
          </Button>
        </CardContent>
      </Card>

      {/* 회전 확인/결과 다이얼로그 */}
      <Dialog
        open={rotateOpen}
        onOpenChange={(open) => {
          setRotateOpen(open)
          if (!open) setRotated(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <KeyRound className="size-4" />키 회전
              </span>
            </DialogTitle>
            <DialogDescription>
              {rotated
                ? '새 키가 발급되었습니다. secret 키는 지금만 볼 수 있습니다.'
                : '이전 키로 동작하던 모든 임베드가 즉시 중단됩니다. 계속할까요?'}
            </DialogDescription>
          </DialogHeader>

          {rotated ? (
            <div className="space-y-3">
              <SecretKeyWarning />
              <KeyReveal label="새 Publishable 키 (pk_)" value={rotated.publishableKey} />
              <KeyReveal label="새 Secret 키 (sk_) · 1회 노출" value={rotated.secretKey} secret />
            </div>
          ) : null}

          <DialogFooter>
            {rotated ? (
              <Button
                onClick={() => {
                  setRotateOpen(false)
                  setRotated(null)
                }}
              >
                확인
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setRotateOpen(false)}>
                  취소
                </Button>
                <Button variant="danger" onClick={confirmRotate} loading={rotate.isPending}>
                  회전 실행
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
