import {
  type TenantCredentialsDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@searchdesk/shared'
import { Gauge, RefreshCw, Save, Settings as SettingsIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { CredentialsReveal } from '@/components/feature/CredentialsReveal'
import { PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useRotateKeys, useTenant, useUpdateTenant, useUsage } from '@/services/searchdesk'

function SettingsForm() {
  const tenant = useTenant()

  if (tenant.isLoading) return <Skeleton className="h-64" />
  if (tenant.isError || !tenant.data) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={SettingsIcon}
            title="테넌트를 불러올 수 없습니다"
            description={
              tenant.error instanceof ApiError
                ? tenant.error.message
                : '잠시 후 다시 시도해 주세요.'
            }
            action={
              <Button size="sm" variant="secondary" onClick={() => void tenant.refetch()}>
                <RefreshCw className="size-4" /> 다시 시도
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  // 데이터가 준비된 뒤에만 폼을 마운트한다 → 서버 값을 useState 초기값으로 직접 쓰고
  // effect 내 setState(=cascading render) 를 피한다.
  return <SettingsFormFields tenant={tenant.data} />
}

function SettingsFormFields({ tenant }: { tenant: TenantDto }) {
  const update = useUpdateTenant()

  const [name, setName] = useState(tenant.name)
  const [cors, setCors] = useState(tenant.corsOrigins.join(', '))
  const [plan, setPlan] = useState<'free' | 'pro'>(tenant.plan)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const corsOrigins = cors
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const input: UpdateTenantInput = {
      name: name.trim(),
      corsOrigins,
      plan,
    }
    update.mutate(input, {
      onSuccess: () => toast.success('설정이 저장되었습니다.'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.'),
    })
  }

  return (
    <Card>
      <CardHeader action={<PlanBadge plan={tenant.plan} />}>
        <CardTitle>테넌트 설정</CardTitle>
        <CardDescription>이름 · CORS 허용 origin · 요금제</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="서비스 이름" htmlFor="set-name" required>
            <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="CORS 허용 origin"
            htmlFor="set-cors"
            hint="검색(pk_) 호출을 허용할 출처. 쉼표 구분. '*' 는 전체 허용."
          >
            <Input
              id="set-cors"
              value={cors}
              onChange={(e) => setCors(e.target.value)}
              placeholder="* 또는 https://app.example.com"
              className="font-mono"
            />
          </Field>
          <Field label="요금제" htmlFor="set-plan" hint="free 는 문서 소프트 캡, pro 는 무제한.">
            <Select
              id="set-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value as 'free' | 'pro')}
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </Select>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={update.isPending}>
              <Save className="size-4" /> 저장
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function UsageCard() {
  const usage = useUsage()
  if (usage.isLoading) return <Skeleton className="h-44" />
  if (usage.isError || !usage.data) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Gauge}
            title="사용량을 불러올 수 없습니다"
            description={
              usage.error instanceof ApiError ? usage.error.message : '잠시 후 다시 시도해 주세요.'
            }
            action={
              <Button size="sm" variant="secondary" onClick={() => void usage.refetch()}>
                <RefreshCw className="size-4" /> 다시 시도
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }
  const u = usage.data
  const capPct = u.docCap ? Math.min(100, Math.round((u.docCount / u.docCap) * 100)) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용량</CardTitle>
        <CardDescription>누적 문서·검색 호출 · 플랜 캡</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-text-muted">색인 문서</dt>
          <dd className="text-right font-mono tabular-nums text-text">
            {u.docCount.toLocaleString()}
            {u.docCap ? ` / ${u.docCap.toLocaleString()}` : ''}
          </dd>
          <dt className="text-text-muted">누적 검색 호출</dt>
          <dd className="text-right font-mono tabular-nums text-text">
            {u.searchCount.toLocaleString()}
          </dd>
          <dt className="text-text-muted">요금제</dt>
          <dd className="text-right font-mono text-text">{u.plan}</dd>
        </dl>
        {capPct != null ? (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-text-subtle">
              <span>free 캡 사용률</span>
              <span className="font-mono tabular-nums">{capPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div
                className={
                  capPct >= 90 ? 'h-full rounded-full bg-danger' : 'h-full rounded-full bg-accent'
                }
                style={{ width: `${Math.max(capPct, 2)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-subtle">pro 플랜 — 문서 캡 없음.</p>
        )}
      </CardContent>
    </Card>
  )
}

function RotateKeysCard() {
  const tenant = useTenant()
  const rotate = useRotateKeys()
  const setCreds = useAuthStore((s) => s.setCreds)
  const setPublishableKey = useAuthStore((s) => s.setPublishableKey)
  const [confirm, setConfirm] = useState(false)
  const [rotated, setRotated] = useState<TenantCredentialsDto | null>(null)

  const doRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (c) => {
        setRotated(c)
        setConfirm(false)
        // 새 secret 키로 현재 세션을 갱신(이전 키는 무효).
        setCreds({ secretKey: c.secretKey, tenantId: c.id, publishableKey: c.publishableKey })
        setPublishableKey(c.publishableKey)
        toast.success('키가 로테이션되었습니다.')
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : '로테이션에 실패했습니다.'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API 키</CardTitle>
        <CardDescription>publishable(pk_)·secret(sk_) 키 로테이션</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tenant.data ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2.5">
            <span className="text-xs font-medium text-text-subtle">pk_</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
              {tenant.data.publishableKey}
            </code>
            <CopyButton value={tenant.data.publishableKey} label="publishable 키 복사" />
          </div>
        ) : null}

        {rotated ? (
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <CredentialsReveal creds={rotated} />
          </div>
        ) : (
          <p className="text-xs text-text-subtle">
            secret 키(sk_)는 보안상 다시 표시되지 않습니다. 잃어버렸거나 노출됐다면 로테이션하세요 —
            새 키가 즉시 발급되고 이전 키는 무효가 됩니다.
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
            <RefreshCw className="size-4" /> 키 로테이션
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키를 로테이션할까요?</DialogTitle>
            <DialogDescription>
              새 publishable·secret 키가 발급되고, 이전 키는 즉시 무효가 됩니다. 임베드 코드·서버
              색인기의 키도 새 키로 교체해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" loading={rotate.isPending} onClick={doRotate}>
              로테이션
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function SettingsPage() {
  useDocumentTitle('설정')
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">설정</h1>
        <p className="mt-1 text-sm text-text-muted">테넌트 구성 · 사용량 · API 키 로테이션</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsForm />
        <div className="space-y-5">
          <UsageCard />
        </div>
      </div>

      <RotateKeysCard />
    </div>
  )
}
